import React from 'react';
import './Controls.css';

interface ControlsProps {
  showKeypoints: boolean;
  showDimming: boolean;
  onToggleKeypoints: () => void;
  onToggleDimming: () => void;
  onSaveFrame: () => void;
}

const Controls: React.FC<ControlsProps> = ({
  showKeypoints,
  showDimming,
  onToggleKeypoints,
  onToggleDimming,
  onSaveFrame,
}) => {
  return (
    <div className="controls">
      <div className="toggle-controls">
        <button
          className={`toggle-button ${showKeypoints ? 'active' : ''}`}
          onClick={onToggleKeypoints}
        >
          {showKeypoints ? 'Hide' : 'Show'} Keypoints
        </button>
        <button
          className={`toggle-button ${showDimming ? 'active' : ''}`}
          onClick={onToggleDimming}
        >
          {showDimming ? 'Hide' : 'Show'} Dimming
        </button>
      </div>
      <button className="save-button" onClick={onSaveFrame}>
        Save Frame
      </button>
    </div>
  );
};

export default Controls;