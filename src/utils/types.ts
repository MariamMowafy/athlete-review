export interface Joint {
  name: string;
  position: {
    x: number;
    y: number;
  };
  side?: 'left' | 'right';
  angle?: number;
  note?: string;
}

export interface AthleteInfo {
  name: string;
  sport: string;
  sessionDate: string;
  coach?: string;
}

export interface PerformanceMetrics {
  repetitionCount: number;
  jointAngles: {
    [key: string]: number;
  };
  formScore: number;
}