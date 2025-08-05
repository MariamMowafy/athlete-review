import * as tf from '@tensorflow/tfjs';
import * as poseDetection from '@tensorflow-models/pose-detection';

export const initializeTensorFlow = async () => {
  await tf.ready();
  const model = poseDetection.SupportedModels.BlazePose;
  const detectorConfig = {
    runtime: 'tfjs',
    modelType: 'full'
  };
  return await poseDetection.createDetector(model, detectorConfig);
};

export const captureFrame = (video: HTMLVideoElement, canvas: HTMLCanvasElement) => {
  const context = canvas.getContext('2d');
  if (!context) return null;

  // Draw the current video frame
  context.drawImage(video, 0, 0, canvas.width, canvas.height);

  // Convert to blob and create download
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `athlete-frame-${new Date().getTime()}.png`;
    a.click();
    URL.revokeObjectURL(url);
  }, 'image/png');
};