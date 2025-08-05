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

interface JointDetails {
  name: string;
  side: string | null;
  angle: number | null;
  note: string | null;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ videoUrl, showDimming, onError }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [detector, setDetector] = useState<poseDetection.PoseDetector | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [isPlaying, setIsPlaying] = useState(false);
  const [hoveredJoint, setHoveredJoint] = useState<JointDetails | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  // Define pausePoints constant
  const pausePoints = [3, 7]; // Pause at 3 and 7 seconds

  // Define color scheme for different body parts
  const colors = {
    head: '#FF0000',    // Red for head
    torso: '#00FF00',   // Green for torso
    arms: '#0000FF',    // Blue for arms
    legs: '#FFA500',    // Orange for legs
    default: '#FFFFFF'  // White for default
  };

  // Add getJointColor function
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

  const getJointSide = (jointName: string): string | null => {
    if (jointName.includes('left')) return 'Left';
    if (jointName.includes('right')) return 'Right';
    return null;
  };

  const calculateJointAngle = (keypointMap: { [key: string]: KeypointWithName }, jointName: string): number | null => {
    // Calculate angles for specific joints
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
    }
    else if (jointName.includes('knee')) {
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
  };

  const getJointNote = (jointName: string): string | null => {
    const notes: { [key: string]: string } = {
      'left_knee': 'Check knee alignment',
      'right_knee': 'Check knee alignment',
      'left_ankle': 'Monitor foot strike',
      'right_ankle': 'Monitor foot strike',
      'left_hip': 'Check hip rotation',
      'right_hip': 'Check hip rotation',
      'left_shoulder': 'Check shoulder level',
      'right_shoulder': 'Check shoulder level',
      'left_elbow': 'Check arm swing',
      'right_elbow': 'Check arm swing'
    };
    return notes[jointName] || null;
  };

  // Initialize TensorFlow and pose detector
  useEffect(() => {
    const initDetector = async () => {
      try {
        console.log('Initializing TensorFlow...');
        await tf.ready();
        console.log('TensorFlow ready, creating detector...');
        const model = poseDetection.SupportedModels.MoveNet;
        const detector = await poseDetection.createDetector(model, {
          modelType: poseDetection.movenet.modelType.SINGLEPOSE_THUNDER,
          enableTracking: true,
          trackerType: poseDetection.TrackerType.BoundingBox,
          minPoseScore: 0.3
        });
        console.log('Detector created successfully');
        setDetector(detector);
      } catch (err) {
        console.error('Pose detector initialization error:', err);
        setError(`Failed to initialize pose detector: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    };

    initDetector();
  }, []);

  // Handle window resize
  const updateDimensions = useCallback(() => {
    if (!containerRef.current || !videoRef.current) return;
    
    const video = videoRef.current;
    const container = containerRef.current;
    
    // Get the actual rendered size of the video element
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

  // Improved coordinate mapping
  const mapToDisplaySpace = useCallback((x: number, y: number) => {
    if (!videoRef.current) return { x, y };
    
    const video = videoRef.current;
    const videoRect = video.getBoundingClientRect();
    
    // Calculate scale based on the actual rendered size vs natural size
    const scaleX = videoRect.width / video.videoWidth;
    const scaleY = videoRect.height / video.videoHeight;
    
    return {
      x: x * scaleX,
      y: y * scaleY
    };
  }, []);

  // Draw skeleton connections
  const drawSkeleton = useCallback((
    ctx: CanvasRenderingContext2D,
    keypoints: KeypointWithName[]
  ) => {
    // Only draw skeleton when video is paused
    if (!videoRef.current?.paused) return;

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

      if (startPoint?.score && endPoint?.score && 
          startPoint.score > 0.3 && endPoint.score > 0.3) {
        const startMapped = mapToDisplaySpace(startPoint.x, startPoint.y);
        const endMapped = mapToDisplaySpace(endPoint.x, endPoint.y);

        ctx.beginPath();
        ctx.moveTo(startMapped.x, startMapped.y);
        ctx.lineTo(endMapped.x, endMapped.y);
        ctx.stroke();
      }
    });
  }, [mapToDisplaySpace]);

  // Updated drawJointTooltip function
  const drawJointTooltip = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    joint: {
      name: string;
      angle: number | null;
    }
  ) => {
    const padding = 8;
    const lineHeight = 20;
    const boxWidth = 150;
    const boxHeight = joint.angle !== null ? 60 : 40;

    // Position the tooltip to avoid going off screen
    let tooltipX = x + 15;
    let tooltipY = y - boxHeight / 2;

    // Adjust if tooltip would go off screen
    if (tooltipX + boxWidth > ctx.canvas.width) {
      tooltipX = x - boxWidth - 15;
    }
    if (tooltipY + boxHeight > ctx.canvas.height) {
      tooltipY = ctx.canvas.height - boxHeight - padding;
    }
    if (tooltipY < padding) {
      tooltipY = padding;
    }

    // Draw semi-transparent background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(tooltipX, tooltipY, boxWidth, boxHeight, 5);
    ctx.fill();
    ctx.stroke();

    // Draw text
    ctx.fillStyle = 'white';
    ctx.font = '14px Arial';
    ctx.fillText(joint.name, tooltipX + padding, tooltipY + lineHeight);
    
    if (joint.angle !== null) {
      ctx.fillText(`Angle: ${joint.angle}°`, tooltipX + padding, tooltipY + lineHeight * 2);
    }
  };

  // Enhanced pose detection
  const detectAndDraw = useCallback(async () => {
    if (!detector || !videoRef.current || !canvasRef.current || !isVideoReady) {
      console.log('Skipping detection, prerequisites not met:', {
        hasDetector: !!detector,
        hasVideo: !!videoRef.current,
        hasCanvas: !!canvasRef.current,
        isVideoReady,
        videoTime: videoRef.current?.currentTime
      });
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      console.log('Video dimensions not ready:', {
        width: video.videoWidth,
        height: video.videoHeight,
        currentTime: video.currentTime,
        readyState: video.readyState
      });
      return;
    }

    try {
      // Get the actual rendered size of the video
      const videoRect = video.getBoundingClientRect();
      
      // Update canvas size to match video rendered size
      canvas.width = videoRect.width;
      canvas.height = videoRect.height;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        console.error('Failed to get canvas context');
        return;
      }

      // Clear previous frame
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Add a small delay to ensure the video frame is ready
      await new Promise(resolve => setTimeout(resolve, 100));

      const poses = await detector.estimatePoses(video, {
        flipHorizontal: false,
        maxPoses: 1,
      });
      
      // Add additional check for valid poses
      if (!poses || poses.length === 0 || !poses[0] || !poses[0].keypoints) {
        console.log('No valid poses detected');
        return;
      }

      poses.forEach(pose => {
        // Add additional check for pose score
        if (!pose || !pose.score || pose.score < 0.3) {
          return;
        }

        const keypointsWithName = pose.keypoints as KeypointWithName[];
        
        // Check for valid keypoints
        if (!keypointsWithName || keypointsWithName.length === 0) {
          return;
        }

        // Create keypointMap
        const keypointMap = keypointsWithName.reduce((map, kp) => {
          if (kp && kp.name) map[kp.name] = kp;
          return map;
        }, {} as { [key: string]: KeypointWithName });

        // Draw skeleton first
        drawSkeleton(ctx, keypointsWithName);

        // Updated keypoints drawing section
        keypointsWithName.forEach(keypoint => {
          if (!keypoint || !keypoint.score || keypoint.score < 0.3) {
            return;
          }

          const mapped = mapToDisplaySpace(keypoint.x, keypoint.y);

          // Only draw joints and handle hover when video is paused
          if (videoRef.current?.paused) {
            // Draw joint marker
            ctx.beginPath();
            ctx.arc(mapped.x, mapped.y, 6, 0, 2 * Math.PI);
            ctx.fillStyle = getJointColor(keypoint.name);
            ctx.fill();
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 2;
            ctx.stroke();

            // Check if mouse is near this joint
            const dx = mousePos.x - mapped.x;
            const dy = mousePos.y - mapped.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < 15) { // 15px hover radius
              const angle = calculateJointAngle(keypointMap, keypoint.name || '');
              drawJointTooltip(ctx, mapped.x, mapped.y, {
                name: keypoint.name || 'Unknown Joint',
                angle: angle
              });
            }
          }
        });

        // Add check before applying dimming effect
        if (showDimming) {
          const boundingBox = calculateBoundingBox(keypointsWithName);
          if (boundingBox && 
              boundingBox.width > 0 && 
              boundingBox.height > 0) {
            applyDimmingEffect(ctx, boundingBox);
          }
        }
      });
    } catch (error) {
      console.error('Error in pose detection:', error);
      if (error instanceof Error) {
        console.error('Error details:', error.message, error.stack);
      }
      // Don't throw the error, just log it and continue
    }
  }, [detector, isVideoReady, showDimming, drawSkeleton, mapToDisplaySpace, mousePos]);

  const calculateBoundingBox = (keypoints: KeypointWithName[]) => {
    const validKeypoints = keypoints.filter(kp => kp.score && kp.score > 0.3);
    if (validKeypoints.length === 0) return null;

    const xs = validKeypoints.map(kp => kp.x);
    const ys = validKeypoints.map(kp => kp.y);

    return {
      x: Math.min(...xs),
      y: Math.min(...ys),
      width: Math.max(...xs) - Math.min(...xs),
      height: Math.max(...ys) - Math.min(...ys)
    };
  };

  const applyDimmingEffect = (
    ctx: CanvasRenderingContext2D,
    boundingBox: { x: number; y: number; width: number; height: number }
  ) => {
    const topLeft = mapToDisplaySpace(boundingBox.x, boundingBox.y);
    const bottomRight = mapToDisplaySpace(
      boundingBox.x + boundingBox.width,
      boundingBox.y + boundingBox.height
    );

    const mapped = {
      x: topLeft.x,
      y: topLeft.y,
      width: bottomRight.x - topLeft.x,
      height: bottomRight.y - topLeft.y
    };

    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, dimensions.width, dimensions.height);
    
    ctx.globalCompositeOperation = 'destination-out';
    const padding = 50;
    ctx.fillRect(
      mapped.x - padding,
      mapped.y - padding,
      mapped.width + (padding * 2),
      mapped.height + (padding * 2)
    );
    ctx.globalCompositeOperation = 'source-over';
  };

  // Handle video events
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleCanPlay = () => {
      console.log('Video can play');
      setIsVideoReady(true);
      setError(null);
      updateDimensions();
    };

    const handleLoadedMetadata = () => {
      console.log('Video metadata loaded', {
        width: video.videoWidth,
        height: video.videoHeight,
        duration: video.duration
      });
      updateDimensions();
      setIsVideoReady(true);
    };

    const handlePause = () => {
      console.log('Pause event triggered');
      setIsPlaying(false);
      setIsPaused(true);
      detectAndDraw();
    };

    const handlePlay = () => {
      console.log('Play event triggered');
      setIsPaused(false);
      setIsPlaying(true);
      detectAndDraw();
    };

    const handleTimeUpdate = async () => {
      const currentTime = videoRef.current?.currentTime;
      if (!currentTime) return;

      // Check if we're within 0.1 seconds of any pause point
      const shouldPause = pausePoints.some(point => 
        Math.abs(currentTime - point) < 0.1 
      );

      if (shouldPause && !videoRef.current?.paused) {
        videoRef.current?.pause();
        setIsPaused(true);
        // Add a small delay before detecting poses
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

  // Animation loop - only run when video is playing
  useEffect(() => {
    let animationFrame: number;
    let lastDrawTime = 0;
    let isAnimating = false;

    const animate = () => {
      if (!isAnimating) return;

      const now = Date.now();
      if (!videoRef.current?.paused) {
        if (now - lastDrawTime > 1000/30) { // Limit to 30fps
          console.log('Animation frame running', {
            videoTime: videoRef.current?.currentTime,
            readyState: videoRef.current?.readyState,
            isPaused: videoRef.current?.paused
          });
          detectAndDraw();
          lastDrawTime = now;
        }
      }
      animationFrame = requestAnimationFrame(animate);
    };

    if (isVideoReady && !error && detector) {
      console.log('Starting animation loop', {
        isVideoReady,
        hasError: !!error,
        hasDetector: !!detector
      });
      isAnimating = true;
      animate();
    }

    return () => {
      console.log('Cleaning up animation loop', {
        hasAnimationFrame: !!animationFrame
      });
      isAnimating = false;
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, [detectAndDraw, isVideoReady, error, detector]); // Add detector to dependencies

  return (
    <div className="video-player" ref={containerRef}>
      <video
        ref={videoRef}
        className="video"
        playsInline
        controls
        preload="auto"
        src={videoUrl}
        onLoadStart={() => console.log('Video load started')}
        onLoadedData={() => console.log('Video data loaded')}
        onPlay={() => console.log('Video play event')}
        onPause={() => console.log('Video pause event')}
        onError={(e) => {
          console.error('Video loading error:', e.currentTarget.error);
          setError(`Video loading error: ${e.currentTarget.error?.message || 'Unknown error'}`);
        }}
      />
      <canvas
        ref={canvasRef}
        className="overlay"
        onMouseMove={(e) => {
          const rect = canvasRef.current?.getBoundingClientRect();
          if (rect) {
            setMousePos({
              x: e.clientX - rect.left,
              y: e.clientY - rect.top
            });
          }
        }}
      />
      {isPaused && (
        <button 
          className="continue-button" 
          onClick={async () => {
            console.log('Continue button clicked');
            if (videoRef.current) {
              try {
                console.log('Attempting to play video');
                await videoRef.current.play();
                console.log('Video play succeeded');
                setIsPaused(false);
                setIsPlaying(true);
              } catch (error) {
                console.error('Video play failed:', error);
                setError(`Failed to play video: ${error instanceof Error ? error.message : 'Unknown error'}`);
              }
            }
          }}
        >
          Continue
        </button>
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