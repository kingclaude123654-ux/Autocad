import React from 'react';

interface Canvas3DProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  onCanvasClick: (e: React.MouseEvent<HTMLDivElement>) => void;
}

export const Canvas3D: React.FC<Canvas3DProps> = ({ containerRef, onCanvasClick }) => {
  return (
    <div 
      ref={containerRef as unknown as React.LegacyRef<HTMLDivElement>} 
      onClick={onCanvasClick}
      className="flex-1 w-full h-full relative cursor-crosshair overflow-hidden touch-none select-none"
    />
  );
};
