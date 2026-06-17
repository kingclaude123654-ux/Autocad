// App.tsx
import React, { useEffect, useRef, useCallback } from 'react';
import { useCADEngine } from './useCADEngine';
import * as THREE from 'three';

const App: React.FC = () => {
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const {
    state,
    initScene,
    undo,
    redo,
    setActiveTool,
    syncCameraMatrix,
    toggleOrthoMode,
    createLine,
    createPolyline,
    createRectangle,
    createCircle,
    executeExtrude,
    executeFillet,
    executeTrim,
    executeExtend,
    executeRotate,
    executeOffset,
    executeScale,
    executeUnion,
    executeSubtract,
    executeErase,
    handleCanvasClick,
    handleResize,
  } = useCADEngine();

  // Initialize scene on mount
  useEffect(() => {
    if (canvasContainerRef.current) {
      initScene(canvasContainerRef.current);
    }

    // Add resize listener
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [initScene, handleResize]);

  // Setup canvas click handler
  useEffect(() => {
    const container = canvasContainerRef.current;
    if (container) {
      container.addEventListener('click', handleCanvasClick);
      return () => {
        container.removeEventListener('click', handleCanvasClick);
      };
    }
  }, [handleCanvasClick]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent)