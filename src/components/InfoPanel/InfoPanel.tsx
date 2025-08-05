import React from 'react';
import { AthleteInfo } from '../../utils/types';
import './InfoPanel.css';

interface InfoPanelProps {
  athleteInfo: AthleteInfo;
}

const InfoPanel: React.FC<InfoPanelProps> = ({ athleteInfo }) => {
  return (
    <div className="info-panel">
      <h2>Athlete Information</h2>
      <div className="info-grid">
        <div className="info-item">
          <label>Name</label>
          <span>{athleteInfo.name}</span>
        </div>
        <div className="info-item">
          <label>Sport</label>
          <span>{athleteInfo.sport}</span>
        </div>
        <div className="info-item">
          <label>Session Date</label>
          <span>{athleteInfo.sessionDate}</span>
        </div>
        {athleteInfo.coach && (
          <div className="info-item">
            <label>Coach</label>
            <span>{athleteInfo.coach}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default InfoPanel;