import React, { useRef, useState, useCallback, useEffect } from 'react';
import { twMerge } from 'tailwind-merge';

export interface RangeSliderProps {
  min: number;
  max: number;
  value: [number, number];
  onChange: (value: [number, number]) => void;
  className?: string;
}

export function RangeSlider({ min, max, value, onChange, className }: RangeSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<'start' | 'end' | null>(null);

  const getPercent = (val: number) => {
    if (max === min) return 0;
    return Math.max(0, Math.min(((val - min) / (max - min)) * 100, 100));
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const percent = x / rect.width;
    const val = min + percent * (max - min);

    const distToStart = Math.abs(val - value[0]);
    const distToEnd = Math.abs(val - value[1]);

    if (distToStart <= distToEnd) {
      setDragging('start');
      onChange([val, value[1]]);
    } else {
      setDragging('end');
      onChange([value[0], val]);
    }
  };

  const handlePointerMove = useCallback((e: PointerEvent) => {
    if (!dragging || !trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const percent = x / rect.width;
    const val = min + percent * (max - min);

    if (dragging === 'start') {
      onChange([Math.min(val, value[1]), value[1]]);
    } else {
      onChange([value[0], Math.max(val, value[0])]);
    }
  }, [dragging, min, max, value, onChange]);

  const handlePointerUp = useCallback(() => {
    setDragging(null);
  }, []);

  useEffect(() => {
    if (dragging) {
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
    }
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [dragging, handlePointerMove, handlePointerUp]);

  return (
    <div 
      className={twMerge("relative w-full h-6 flex items-center cursor-pointer group select-none", className)}
      onPointerDown={handlePointerDown}
      ref={trackRef}
    >
      <div className="absolute w-full h-1 bg-border rounded-full pointer-events-none" />
      <div 
        className="absolute h-1 bg-accent rounded-full pointer-events-none"
        style={{ left: `${getPercent(value[0])}%`, width: `${getPercent(value[1]) - getPercent(value[0])}%` }}
      />
      <div 
        className="absolute h-3 w-3 bg-accent rounded-full shadow transition-transform group-hover:scale-125 -ml-1.5 pointer-events-none"
        style={{ left: `${getPercent(value[0])}%` }}
      />
      <div 
        className="absolute h-3 w-3 bg-accent rounded-full shadow transition-transform group-hover:scale-125 -ml-1.5 pointer-events-none"
        style={{ left: `${getPercent(value[1])}%` }}
      />
    </div>
  );
}
