import React from 'react';

interface Canvas3DProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  onCanvasClick: () => void;
}

export const Canvas3D: React.FC<Canvas3DProps> = ({ containerRef }) => {
  // Access state hooks through the direct window object context properties safely
  return (
    <div 
      ref={containerRef as unknown as React.LegacyRef<HTMLDivElement>} 
      style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, touchAction: 'none' }}
      
      // Desktop Mouse Controls
      onMouseDown={(e) => (window as any).cadDown?.(e.clientX, e.clientY)}
      onMouseMove={(e) => (window as any).cadMove?.(e.clientX, e.clientY)}
      onMouseUp={(e) => (window as any).cadUp?.(e.clientX, e.clientY)}

      // Mobile Touch Interaction Handlers
      onTouchStart={(e) => {
        if(e.touches.length > 0) (window as any).cadDown?.(e.touches[0].clientX, e.touches[0].clientY);
      }}
      onTouchMove={(e) => {
        if(e.touches.length > 0) (window as any).cadMove?.(e.touches[0].clientX, e.touches[0].clientY);
      }}
      onTouchEnd={(e) => {
        if(e.changedTouches.length > 0) (window as any).cadUp?.(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
      }}
    />
  );
};
