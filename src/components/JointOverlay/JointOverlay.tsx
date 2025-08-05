import React from 'react';
import JointMarker from './JointMarker';
import { Joint } from '../../utils/types';
import './JointOverlay.css';

const JointOverlay: React.FC = () => {
  const joints: Joint[] = [
    {
      name: 'Head',
      position: { x: 0, y: 0 },
    },
    {
      name: 'Left Wrist',
      position: { x: 0, y: 0 },
      side: 'left'
    },
    {
      name: 'Right Wrist',
      position: { x: 0, y: 0 },
      side: 'right'
    },
    {
      name: 'Left Ankle',
      position: { x: 0, y: 0 },
      side: 'left'
    },
    {
      name: 'Right Ankle',
      position: { x: 0, y: 0 },
      side: 'right'
    }
  ];

  return (
    <div className="joint-overlay">
      {joints.map((joint, index) => (
        <JointMarker
          key={index}
          joint={joint}
        />
      ))}
    </div>
  );
};

export default JointOverlay;