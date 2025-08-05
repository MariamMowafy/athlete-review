import React from 'react';
import { PerformanceMetrics } from '../../utils/types';
import './MetricsCard.css';

interface MetricsCardProps {
  metrics: PerformanceMetrics;
}

const MetricsCard: React.FC<MetricsCardProps> = ({ metrics }) => {
  return (
    <div className="metrics-card">
      <h2>Performance Metrics</h2>
      <div className="metrics-grid">
        <div className="metric-item">
          <label>Repetitions</label>
          <span>{metrics.repetitionCount}</span>
        </div>
        {Object.entries(metrics.jointAngles).map(([joint, angle]) => (
          <div key={joint} className="metric-item">
            <label>{joint}</label>
            <span>{angle}°</span>
          </div>
        ))}
        <div className="metric-item">
          <label>Form Score</label>
          <span>{metrics.formScore}/10</span>
        </div>
      </div>
    </div>
  );
};

export default MetricsCard;