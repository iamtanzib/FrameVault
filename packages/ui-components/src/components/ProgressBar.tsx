import React from 'react';

export interface ProgressBarProps {
  progress: number; // 0 to 100
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ progress }) => {
  const safeProgress = Math.min(100, Math.max(0, progress));

  return (
    <div className="w-full h-[4px] bg-border rounded-full overflow-hidden mt-2">
      <div 
        className="h-full bg-accent transition-all duration-300 ease-out"
        style={{ width: `${safeProgress}%` }}
      />
    </div>
  );
};
