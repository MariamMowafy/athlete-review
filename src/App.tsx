import React, { useState } from 'react';
import VideoPlayer from './components/VideoPlayer/VideoPlayer';
import JointOverlay from './components/JointOverlay/JointOverlay';
import InfoPanel from './components/InfoPanel/InfoPanel';
import MetricsCard from './components/MetricsCard/MetricsCard';
import Controls from './components/Controls/Controls';
import { AthleteInfo, PerformanceMetrics } from './utils/types';
import './App.css';

const App: React.FC = () => {
  const [showKeypoints, setShowKeypoints] = useState(true);
  const [showDimming, setShowDimming] = useState(true);

  const athleteInfo: AthleteInfo = {
    name: "Mohamed Ahmed",
    sport: "Trail Running",
    sessionDate: "2025-08-04",
    coach: "Coach Mahmoud"
  };

  const performanceMetrics: PerformanceMetrics = {
    repetitionCount: 5,
    jointAngles: {
      "Left Knee": 85,
      "Right Knee": 87
    },
    formScore: 8.5
  };


  const videoPath = `${process.env.PUBLIC_URL}/running.mp4?v=${Date.now()}`;
  console.log('Video Path:', videoPath);

  return (
    <div className="app">
      <div className="main-content">
        <div className="video-container">
          <VideoPlayer
            videoUrl={videoPath}
            showDimming={showDimming}
            showKeypoints={showKeypoints}
          />
          {showKeypoints && <JointOverlay />}
        </div>
        <Controls
          showKeypoints={showKeypoints}
          showDimming={showDimming}
          onToggleKeypoints={() => setShowKeypoints(!showKeypoints)}
          onToggleDimming={() => setShowDimming(!showDimming)}
          onSaveFrame={() => {
            const video = document.querySelector('video');
            const canvas = document.createElement('canvas');
            if (video) {
              canvas.width = video.videoWidth;
              canvas.height = video.videoHeight;
              const ctx = canvas.getContext('2d');
              if (ctx) {
                ctx.drawImage(video, 0, 0);
                canvas.toBlob((blob) => {
                  if (blob) {
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `athlete-frame-${Date.now()}.png`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                  }
                }, 'image/png');
              }
            }
          }}
        />
      </div>
      <div className="sidebar">
        <InfoPanel athleteInfo={athleteInfo} />
        <MetricsCard metrics={performanceMetrics} />
      </div>
    </div>
  );
};

export default App;