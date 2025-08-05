import React, { useState } from 'react';
import { Joint } from '../../utils/types';
import './JointOverlay.css';

interface JointMarkerProps {
  joint: Joint;
}

const JointMarker: React.FC<JointMarkerProps> = ({ joint }) => {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div
      className="joint-marker"
      style={{
        left: `${joint.position.x}px`,
        top: `${joint.position.y}px`
      }}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div className="marker-dot" />
      {showTooltip && (
        <div className="joint-tooltip">
          <h4>{joint.name}</h4>
          {joint.side && <p>Side: {joint.side}</p>}
          {joint.angle && <p>Angle: {joint.angle}°</p>}
          {joint.note && <p>{joint.note}</p>}
        </div>
      )}
    </div>
  );
};

export default JointMarker;