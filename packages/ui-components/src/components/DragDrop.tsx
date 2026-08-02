import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { UploadCloud } from 'lucide-react';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface DragDropProps extends React.HTMLAttributes<HTMLDivElement> {
  onFileDrop?: (file: File) => void;
}

export const DragDrop: React.FC<DragDropProps> = ({ className, onFileDrop, ...props }) => {
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      if (onFileDrop) onFileDrop(e.dataTransfer.files[0]);
    }
  };

  return (
    <div 
      className={cn(
        "flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-border rounded-lg bg-background hover:border-accent hover:bg-accent/5 transition-colors cursor-pointer text-secondaryText hover:text-accent",
        className
      )}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      {...props}
    >
      <UploadCloud className="w-8 h-8 mb-2" />
      <p className="text-sm font-medium">Drag & Drop media here</p>
      <p className="text-xs opacity-70">or click to browse</p>
    </div>
  );
};
