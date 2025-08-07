import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as tf from '@tensorflow/tfjs';
import * as poseDetection from '@tensorflow-models/pose-detection';
import './VideoPlayer.css';

interface VideoPlayerProps {
  videoUrl: string;
  showDimming: boolean;
  onError?: (error: string) => void;
}

interface KeypointWithName extends poseDetection.Keypoint {
  name: string;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ videoUrl, showDimming, onError }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const skeletonCanvasRef = useRef<HTMLCanvasElement>(null);

  const [isPaused, setIsPaused] = useState(false);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [detector, setDetector] = useState<poseDetection.PoseDetector | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [currentKeypoints, setCurrentKeypoints] = useState<KeypointWithName[] | null>(null);
  const [clickedJoint, setClickedJoint] = useState<{
    name: string;
    angle: number | null;
    x: number;
    y: number;
  } | null>(null);

  const pausePoints = [6, 10]; // Example pause points in seconds

  const colors = {
    head: '#FF0000',
    torso: '#00FF00',
    arms: '#0000FF',
    legs: '#FFA500',
    default: '#FFFFFF'
  };

  const getJointColor = (jointName: string | undefined): string => {
    if (!jointName) return colors.default;
    if (jointName.includes('nose') || jointName.includes('eye') || jointName.includes('ear')) {
      return colors.head;
    }
    if (jointName.includes('shoulder') || jointName.includes('hip')) {
      return colors.torso;
    }
    if (jointName.includes('elbow') || jointName.includes('wrist')) {
      return colors.arms;
    }
    if (jointName.includes('knee') || jointName.includes('ankle')) {
      return colors.legs;
    }
    return colors.default;
  };

  const calculateJointAngle = useCallback((keypointMap: { [key: string]: KeypointWithName }, jointName: string): number | null => {
    if (jointName.includes('elbow')) {
      const side = jointName.includes('left') ? 'left' : 'right';
      const shoulder = keypointMap[`${side}_shoulder`];
      const elbow = keypointMap[`${side}_elbow`];
      const wrist = keypointMap[`${side}_wrist`];
      if (shoulder && elbow && wrist) {
        const angle = Math.atan2(wrist.y - elbow.y, wrist.x - elbow.x) -
          Math.atan2(shoulder.y - elbow.y, shoulder.x - elbow.x);
        return Math.abs(Math.round(angle * (180 / Math.PI)));
      }
    } else if (jointName.includes('knee')) {
      const side = jointName.includes('left') ? 'left' : 'right';
      const hip = keypointMap[`${side}_hip`];
      const knee = keypointMap[`${side}_knee`];
      const ankle = keypointMap[`${side}_ankle`];
      if (hip && knee && ankle) {
        const angle = Math.atan2(ankle.y - knee.y, ankle.x - knee.x) -
          Math.atan2(hip.y - knee.y, hip.x - knee.x);
        return Math.abs(Math.round(angle * (180 / Math.PI)));
      }
    }
    return null;
  }, []);

  const updateDimensions = useCallback(() => {
    if (!containerRef.current || !videoRef.current) return;
    const video = videoRef.current;
    const videoRect = video.getBoundingClientRect();
    setDimensions({
      width: videoRect.width,
      height: videoRect.height
    });
  }, []);

  useEffect(() => {
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, [updateDimensions]);

  const mapToDisplaySpace = useCallback((x: number, y: number) => {
    if (!videoRef.current) return { x, y };
    const video = videoRef.current;
    const videoRect = video.getBoundingClientRect();
    const scaleX = videoRect.width / video.videoWidth;
    const scaleY = videoRect.height / video.videoHeight;
    return {
      x: x * scaleX,
      y: y * scaleY
    };
  }, []);

  const drawSkeleton = useCallback((ctx: CanvasRenderingContext2D, keypoints: KeypointWithName[]) => {
    const connections = [
      ['nose', 'left_eye'], ['nose', 'right_eye'],
      ['left_eye', 'left_ear'], ['right_eye', 'right_ear'],
      ['left_shoulder', 'right_shoulder'],
      ['left_shoulder', 'left_elbow'],
      ['right_shoulder', 'right_elbow'],
      ['left_elbow', 'left_wrist'],
      ['right_elbow', 'right_wrist'],
      ['left_shoulder', 'left_hip'],
      ['right_shoulder', 'right_hip'],
      ['left_hip', 'right_hip'],
      ['left_hip', 'left_knee'],
      ['right_hip', 'right_knee'],
      ['left_knee', 'left_ankle'],
      ['right_knee', 'right_ankle']
    ];
    const keypointMap = keypoints.reduce((map, kp) => {
      if (kp.name) map[kp.name] = kp;
      return map;
    }, {} as { [key: string]: KeypointWithName });

    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    connections.forEach(([start, end]) => {
      const startPoint = keypointMap[start];
      const endPoint = keypointMap[end];
      if (startPoint?.score && endPoint?.score && startPoint.score > 0.3 && endPoint.score > 0.3) {
        const startMapped = mapToDisplaySpace(startPoint.x, startPoint.y);
        const endMapped = mapToDisplaySpace(endPoint.x, endPoint.y);
        ctx.beginPath();
        ctx.moveTo(startMapped.x, startMapped.y);
        ctx.lineTo(endMapped.x, endMapped.y);
        ctx.stroke();
      }
    });
  }, [mapToDisplaySpace]);

  const detectAndDraw = useCallback(async () => {
    if (!detector || !videoRef.current || !skeletonCanvasRef.current || !isVideoReady) {
      return;
    }

    const video = videoRef.current;
    const skeletonCanvas = skeletonCanvasRef.current;
    const videoRect = video.getBoundingClientRect();
    skeletonCanvas.width = videoRect.width;
    skeletonCanvas.height = videoRect.height;
    const ctx = skeletonCanvas.getContext('2d');
    if (!ctx) {
      return;
    }

    ctx.clearRect(0, 0, skeletonCanvas.width, skeletonCanvas.height);

    if (video.paused) {
      try {
        const poses = await detector.estimatePoses(video, {
          flipHorizontal: false,
          maxPoses: 1,
        });

        if (!poses || poses.length === 0 || !poses[0] || !poses[0].keypoints) {
          setCurrentKeypoints(null);
          return;
        }

        const keypointsWithName = poses[0].keypoints as KeypointWithName[];
        setCurrentKeypoints(keypointsWithName);


        if (showDimming) {
          applyDimmingEffect(ctx, keypointsWithName);
        }

        drawSkeleton(ctx, keypointsWithName);

        keypointsWithName.forEach(keypoint => {
          if (keypoint.score && keypoint.score > 0.3) {
            const mapped = mapToDisplaySpace(keypoint.x, keypoint.y);
            ctx.beginPath();
            ctx.arc(mapped.x, mapped.y, 6, 0, 2 * Math.PI);
            ctx.fillStyle = getJointColor(keypoint.name);
            ctx.fill();
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 2;
            ctx.stroke();
          }
        });
      } catch (error) {
        console.error('Error in pose detection:', error);
      }
    }
  }, [detector, isVideoReady, showDimming, drawSkeleton, mapToDisplaySpace]);


  const applyDimmingEffect = (ctx: CanvasRenderingContext2D, keypoints: KeypointWithName[]) => {
    const validKeypoints = keypoints.filter(kp => kp.score && kp.score > 0.3);
    if (validKeypoints.length === 0) return;

    // Create a polygon path to encompass the body
    const path = new Path2D();
    const padding = 50;
    const mappedPoints = validKeypoints.map(kp => mapToDisplaySpace(kp.x, kp.y));

    // A simple convex hull approximation for the polygon
    const xs = mappedPoints.map(p => p.x);
    const ys = mappedPoints.map(p => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    path.rect(minX - padding, minY - padding, maxX - minX + 2 * padding, maxY - minY + 2 * padding);

    // Draw the dimming layer
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, dimensions.width, dimensions.height);

    // Create the "spotlight" hole
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fill(path);

    // Reset composite operation for subsequent drawings
    ctx.globalCompositeOperation = 'source-over';
  };

  const saveFrameWithOverlays = async () => {
    if (!videoRef.current || !skeletonCanvasRef.current) {
      console.error("Video or canvas not ready.");
      return;
    }

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = videoRef.current.videoWidth;
    tempCanvas.height = videoRef.current.videoHeight;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return;

    // 1. Draw the current video frame
    tempCtx.drawImage(videoRef.current, 0, 0, tempCanvas.width, tempCanvas.height);

    // 2. Draw the existing overlays from the skeleton canvas, scaled to video size
    const scaleX = tempCanvas.width / skeletonCanvasRef.current.width;
    const scaleY = tempCanvas.height / skeletonCanvasRef.current.height;

    tempCtx.save();
    tempCtx.scale(scaleX, scaleY);
    tempCtx.drawImage(skeletonCanvasRef.current, 0, 0);
    tempCtx.restore();

    // 3. Draw the clicked joint popup if it exists
    if (clickedJoint) {
        const popupWidth = 200;
        const padding = 15;
        const mappedX = clickedJoint.x * scaleX + 15;
        const mappedY = clickedJoint.y * scaleY;
        const fontSize = 16;
        const titleSize = 18;
        
        // Background box
        tempCtx.fillStyle = 'white';
        tempCtx.strokeStyle = '#d1d5db';
        tempCtx.lineWidth = 2;
        const boxHeight = clickedJoint.angle !== null ? 75 : 50;
        tempCtx.fillRect(mappedX, mappedY, popupWidth, boxHeight);
        tempCtx.strokeRect(mappedX, mappedY, popupWidth, boxHeight);
        
        tempCtx.fillStyle = 'black';
        tempCtx.font = `bold ${titleSize}px sans-serif`;
        tempCtx.fillText(`JOINT: ${clickedJoint.name.toUpperCase()}`, mappedX + padding, mappedY + padding + titleSize);
        
        if (clickedJoint.angle !== null) {
            tempCtx.font = `${fontSize}px sans-serif`;
            tempCtx.fillText(`Angle: ${clickedJoint.angle}°`, mappedX + padding, mappedY + padding + titleSize + fontSize + 5);
        }
    }

    // 4. Trigger download
    const image = tempCanvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = image;
    link.download = `frame_${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Handle click on the single canvas
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!videoRef.current?.paused || !currentKeypoints || !skeletonCanvasRef.current) return;

    const rect = skeletonCanvasRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const jointClicked = currentKeypoints.find(keypoint => {
        if (!keypoint || !keypoint.score || keypoint.score < 0.3) {
            return false;
        }
        const mapped = mapToDisplaySpace(keypoint.x, keypoint.y);
        const distance = Math.sqrt(Math.pow(clickX - mapped.x, 2) + Math.pow(clickY - mapped.y, 2));
        return distance < 15;
    });

    if (jointClicked) {
        const mapped = mapToDisplaySpace(jointClicked.x, jointClicked.y);
        const keypointMap = currentKeypoints.reduce((map, kp) => {
            if (kp.name) map[kp.name] = kp;
            return map;
        }, {} as { [key: string]: KeypointWithName });
        const angle = calculateJointAngle(keypointMap, jointClicked.name || '');
        setClickedJoint({
            name: jointClicked.name || 'Unknown Joint',
            angle: angle,
            x: mapped.x,
            y: mapped.y,
        });
    } else {
        setClickedJoint(null);
    }
  }, [currentKeypoints, mapToDisplaySpace, calculateJointAngle]);


  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const handleCanPlay = () => {
      setIsVideoReady(true);
      setError(null);
      updateDimensions();
    };
    const handleLoadedMetadata = () => {
      updateDimensions();
      setIsVideoReady(true);
    };
    const handlePause = () => {
      setIsPaused(true);
      detectAndDraw();
    };
    const handlePlay = () => {
      setIsPaused(false);
      detectAndDraw();
    };
    const handleTimeUpdate = async () => {
      const currentTime = videoRef.current?.currentTime;
      if (!currentTime) return;
      const shouldPause = pausePoints.some(point => Math.abs(currentTime - point) < 0.1);
      if (shouldPause && !videoRef.current?.paused) {
        videoRef.current?.pause();
        setIsPaused(true);
        await new Promise(resolve => setTimeout(resolve, 200));
        await detectAndDraw();
      }
    };
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('pause', handlePause);
    video.addEventListener('play', handlePlay);
    video.addEventListener('timeupdate', handleTimeUpdate);
    window.addEventListener('resize', updateDimensions);
    return () => {
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      window.removeEventListener('resize', updateDimensions);
    };
  }, [updateDimensions, detectAndDraw]);

  useEffect(() => {
    const initDetector = async () => {
      try {
        await tf.ready();
        const model = poseDetection.SupportedModels.MoveNet;
        const detector = await poseDetection.createDetector(model, {
          modelType: poseDetection.movenet.modelType.SINGLEPOSE_THUNDER,
          enableTracking: true,
          trackerType: poseDetection.TrackerType.BoundingBox,
          minPoseScore: 0.3
        });
        setDetector(detector);
      } catch (err) {
        setError(`Failed to initialize pose detector: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    };
    initDetector();
  }, []);

  useEffect(() => {
    let animationFrame: number;
    let lastDrawTime = 0;
    const animate = () => {
      if (!videoRef.current?.paused && isVideoReady && detector) {
        const now = Date.now();
        if (now - lastDrawTime > 1000 / 30) {
          detectAndDraw();
          lastDrawTime = now;
        }
      }
      animationFrame = requestAnimationFrame(animate);
    };
    animate();
    return () => {
      cancelAnimationFrame(animationFrame);
    };
  }, [detectAndDraw, isVideoReady, detector]);

  return (
    <div className="video-player" ref={containerRef}>
      <video
        ref={videoRef}
        className="video"
        playsInline
        controls
        preload="auto"
        src={videoUrl}
        onError={(e) => {
          setError(`Video loading error: ${e.currentTarget.error?.message || 'Unknown error'}`);
        }}
      />
      <canvas
        ref={skeletonCanvasRef}
        className={`overlay ${isPaused ? 'clickable' : ''}`}
        onClick={isPaused ? handleCanvasClick : undefined}
      />
      {isPaused && (
        <div 
          className="control-buttons" 
          style={{
            position: 'absolute',
            bottom: '10px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 100,
            display: 'flex',
            gap: '10px',
            pointerEvents: 'auto',
          }}
        >

          <button
            className="continue-button"
            onClick={async () => {
              if (videoRef.current) {
                try {
                  await videoRef.current.play();
                  setIsPaused(false);
                  setClickedJoint(null);
                } catch (error) {
                  setError(`Failed to play video: ${error instanceof Error ? error.message : 'Unknown error'}`);
                }
              }
            }}
          >
            Continue
          </button>
          <button
            className="save-frame-button"
            onClick={saveFrameWithOverlays}
            style={{
              padding: '10px 10px',
              backgroundColor: '#3498db',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer'
            }}
          >
            Save Frame
          </button>
        </div>
      )}
      {clickedJoint && (
        <div
          style={{
            position: 'absolute',
            left: `${clickedJoint.x + 15}px`,
            top: `${clickedJoint.y}px`,
            background: 'white',
            color: 'black',
            padding: '10px',
            borderRadius: '8px',
            fontSize: '16px',
            pointerEvents: 'none',
            zIndex: 1000,
            minWidth: '50px',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
            border: '2px solid #d1d5db',
          }}
        >
          <p style={{ fontWeight: 'bold', marginBottom: '8px', textTransform: 'uppercase' }}>
            Joint: {clickedJoint.name}
          </p>
          {clickedJoint.angle !== null && (
            <p>Angle: {clickedJoint.angle}°</p>
          )}
        </div>
      )}
      {!isVideoReady && !error && (
        <div className="loading-overlay">
          <p>Loading video...</p>
        </div>
      )}
      {error && (
        <div className="error-overlay">
          <p>{error}</p>
        </div>
      )}
    </div>
  );
};

export default VideoPlayer;