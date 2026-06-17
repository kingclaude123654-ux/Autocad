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
    executeExtrude,
    executeFillet,
    executeTrim,
    executeExtend,
    executeRotate,
    executeOffset,
    executeScale,
    executeErase,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleResize,
    addObject,
  } = useCADEngine();

  // Initialize scene on mount with mobile considerations
  useEffect(() => {
    if (canvasContainerRef.current) {
      initScene(canvasContainerRef.current);
    }

    window.addEventListener('resize', handleResize);
    
    // Prevent default touch behaviors
    document.body.style.overscrollBehavior = 'none';
    document.body.style.touchAction = 'none';
    
    return () => {
      window.removeEventListener('resize', handleResize);
      document.body.style.overscrollBehavior = '';
      document.body.style.touchAction = '';
    };
  }, [initScene, handleResize]);

  // Setup touch event handlers
  useEffect(() => {
    const container = canvasContainerRef.current;
    if (container) {
      container.addEventListener('touchstart', handleTouchStart as any, { passive: false });
      container.addEventListener('touchmove', handleTouchMove as any, { passive: false });
      container.addEventListener('touchend', handleTouchEnd as any, { passive: false });
      
      return () => {
        container.removeEventListener('touchstart', handleTouchStart as any);
        container.removeEventListener('touchmove', handleTouchMove as any);
        container.removeEventListener('touchend', handleTouchEnd as any);
      };
    }
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  // Quick add functions for mobile testing
  const handleQuickAddBox = useCallback(() => {
    const geometry = new THREE.BoxGeometry(1.5, 1.5, 1.5);
    const material = new THREE.MeshStandardMaterial({ 
      color: 0x4a90e2,
      roughness: 0.7,
      metalness: 0.1,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(Math.random() * 4 - 2, Math.random() * 4 - 2, Math.random() * 4 - 2);
    addObject(mesh, 'rectangle');
  }, [addObject]);

  const handleQuickAddSphere = useCallback(() => {
    const geometry = new THREE.SphereGeometry(0.8, 24, 24); // Reduced segments for mobile
    const material = new THREE.MeshStandardMaterial({ 
      color: 0xe24a4a,
      roughness: 0.7,
      metalness: 0.1,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(Math.random() * 4 - 2, Math.random() * 4 - 2, Math.random() * 4 - 2);
    addObject(mesh, 'circle');
  }, [addObject]);

  const handleQuickAddCylinder = useCallback(() => {
    const geometry = new THREE.CylinderGeometry(0.8, 0.8, 2, 24); // Reduced segments
    const material = new THREE.MeshStandardMaterial({ 
      color: 0x50c878,
      roughness: 0.7,
      metalness: 0.1,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(Math.random() * 4 - 2, Math.random() * 4 - 2, Math.random() * 4 - 2);
    addObject(mesh, 'extrude');
  }, [addObject]);

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100vh', 
      width: '100vw',
      backgroundColor: '#1a1a2e',
      color: '#ffffff',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      overflow: 'hidden',
      userSelect: 'none',
      WebkitUserSelect: 'none',
      touchAction: 'none',
    }}>
      {/* Mobile-optimized Toolbar - Horizontal Scroll */}
      <div style={{
        display: 'flex',
        overflowX: 'auto',
        padding: '8px',
        backgroundColor: '#16213e',
        borderBottom: '1px solid #0f3460',
        gap: '6px',
        WebkitOverflowScrolling: 'touch',
        msOverflowStyle: 'none',
        scrollbarWidth: 'none',
        minHeight: '44px',
        alignItems: 'center',
      }}>
        {/* View Controls */}
        <button 
          onClick={() => syncCameraMatrix('isometric')}
          style={mobileButtonStyle(state.viewMode === 'isometric')}
        >
          3D
        </button>
        <button 
          onClick={() => syncCameraMatrix('top')}
          style={mobileButtonStyle(state.viewMode === 'top')}
        >
          Top
        </button>
        <button 
          onClick={() => syncCameraMatrix('front')}
          style={mobileButtonStyle(state.viewMode === 'front')}
        >
          Front
        </button>
        <button 
          onClick={() => syncCameraMatrix('side')}
          style={mobileButtonStyle(state.viewMode === 'side')}
        >
          Side
        </button>
        
        <div style={{ width: '1px', height: '24px', backgroundColor: '#0f3460', margin: '0 4px' }} />
        
        {/* Ortho Toggle */}
        <button 
          onClick={toggleOrthoMode}
          style={{
            ...mobileButtonStyle(state.orthoMode),
            backgroundColor: state.orthoMode ? '#e94560' : '#0f3460',
            fontSize: '11px',
          }}
        >
          {state.orthoMode ? 'Ortho' : 'Persp'}
        </button>
        
        <div style={{ width: '1px', height: '24px', backgroundColor: '#0f3460', margin: '0 4px' }} />
        
        {/* Undo/Redo */}
        <button onClick={undo} style={mobileIconButtonStyle} disabled={state.historyIndex <= 0}>
          ↩
        </button>
        <button onClick={redo} style={mobileIconButtonStyle} disabled={state.historyIndex >= state.history.length - 1}>
          ↪
        </button>
      </div>

      {/* Drawing Tools */}
      <div style={{
        display: 'flex',
        overflowX: 'auto',
        padding: '6px 8px',
        backgroundColor: '#16213e',
        borderBottom: '1px solid #0f3460',
        gap: '5px',
        WebkitOverflowScrolling: 'touch',
        msOverflowStyle: 'none',
        scrollbarWidth: 'none',
        minHeight: '40px',
        alignItems: 'center',
      }}>
        <button 
          onClick={() => setActiveTool('select')}
          style={mobileToolButtonStyle(state.activeTool === 'select')}
        >
          👆
        </button>
        <button 
          onClick={() => setActiveTool('move')}
          style={mobileToolButtonStyle(state.activeTool === 'move')}
        >
          ↔️
        </button>
        <button 
          onClick={() => setActiveTool('line')}
          style={mobileToolButtonStyle(state.activeTool === 'line')}
        >
          📏
        </button>
        <button 
          onClick={() => setActiveTool('rectangle')}
          style={mobileToolButtonStyle(state.activeTool === 'rectangle')}
        >
          ⬜
        </button>
        <button 
          onClick={() => setActiveTool('circle')}
          style={mobileToolButtonStyle(state.activeTool === 'circle')}
        >
          ⭕
        </button>
      </div>

      {/* Canvas Container - Main Area */}
      <div 
        ref={canvasContainerRef}
        style={{
          flex: 1,
          position: 'relative',
          overflow: 'hidden',
          backgroundColor: '#1a1a2e',
          touchAction: 'none',
        }}
      />

      {/* Bottom Action Bar */}
      <div style={{
        display: 'flex',
        overflowX: 'auto',
        padding: '6px 8px',
        backgroundColor: '#16213e',
        borderTop: '1px solid #0f3460',
        gap: '5px',
        WebkitOverflowScrolling: 'touch',
        msOverflowStyle: 'none',
        scrollbarWidth: 'none',
        minHeight: '44px',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <button 
          onClick={() => state.selectedId && executeExtrude(state.selectedId, 1)}
          style={mobileActionButtonStyle}
          disabled={!state.selectedId}
        >
          Extrude
        </button>
        <button 
          onClick={() => state.selectedId && executeFillet(state.selectedId, 0.3)}
          style={mobileActionButtonStyle}
          disabled={!state.selectedId}
        >
          Fillet
        </button>
        <button 
          onClick={() => state.selectedId && executeRotate(state.selectedId, 'y', Math.PI/4)}
          style={mobileActionButtonStyle}
          disabled={!state.selectedId}
        >
          Rotate
        </button>
        <button 
          onClick={() => state.selectedId && executeScale(state.selectedId, 1.2, 1.2, 1.2)}
          style={mobileActionButtonStyle}
          disabled={!state.selectedId}
        >
          Scale
        </button>
        <button 
          onClick={() => state.selectedId && executeErase(state.selectedId)}
          style={{
            ...mobileActionButtonStyle,
            backgroundColor: '#e94560',
            color: '#ffffff',
          }}
          disabled={!state.selectedId}
        >
          Delete
        </button>
      </div>

      {/* Quick Add Panel */}
      <div style={{
        display: 'flex',
        padding: '6px 8px',
        backgroundColor: '#16213e',
        borderTop: '1px solid #0f3460',
        gap: '8px',
        justifyContent: 'center',
        minHeight: '40px',
        alignItems: 'center',
      }}>
        <button onClick={handleQuickAddBox} style={quickAddButtonStyle}>
          + Box
        </button>
        <button onClick={handleQuickAddSphere} style={quickAddButtonStyle}>
          + Sphere
        </button>
        <button onClick={handleQuickAddCylinder} style={quickAddButtonStyle}>
          + Cylinder
        </button>
      </div>

      {/* Mobile Status Bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        padding: '4px 8px',
        backgroundColor: '#0f3460',
        fontSize: '10px',
        color: '#aaa',
        minHeight: '24px',
        alignItems: 'center',
      }}>
        <span>{state.activeTool.toUpperCase()}</span>
        <span>Objs: {state.objects.length}</span>
        <span>{state.viewMode}</span>
        <span>{state.orthoMode ? 'ORTHO' : 'PERSP'}</span>
      </div>
    </div>
  );
};

// Mobile-optimized style helpers
const mobileButtonStyle = (active: boolean): React.CSSProperties => ({
  padding: '8px 12px',
  backgroundColor: active ? '#e94560' : '#0f3460',
  color: 'white',
  border: 'none',
  borderRadius: '6px',
  fontSize: '12px',
  fontWeight: active ? 'bold' : 'normal',
  whiteSpace: 'nowrap',
  minWidth: '44px',
  minHeight: '44px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  WebkitTapHighlightColor: 'transparent',
  touchAction: 'manipulation',
});

const mobileIconButtonStyle: React.CSSProperties = {
  padding: '8px',
  backgroundColor: '#0f3460',
  color: 'white',
  border: 'none',
  borderRadius: '6px',
  fontSize: '18px',
  minWidth: '44px',
  minHeight: '44px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  WebkitTapHighlightColor: 'transparent',
};

const mobileToolButtonStyle = (active: boolean): React.CSSProperties => ({
  padding: '8px',
  backgroundColor: active ? '#e94560' : '#0f3460',
  color: 'white',
  border: 'none',
  borderRadius: '50%',
  fontSize: '20px',
  minWidth: '44px',
  minHeight: '44px',
  width: '44px',
  height: '44px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  WebkitTapHighlightColor: 'transparent',
});

const mobileActionButtonStyle: React.CSSProperties = {
  padding: '8px 12px',
  backgroundColor: '#0f3460',
  color: 'white',
  border: 'none',
  borderRadius: '6px',
  fontSize: '11px',
  fontWeight: 'bold',
  whiteSpace: 'nowrap',
  minHeight: '44px',
  cursor: 'pointer',
  WebkitTapHighlightColor: 'transparent',
  opacity: 1,
};

const quickAddButtonStyle: React.CSSProperties = {
  padding: '6px 12px',
  backgroundColor: '#533483',
  color: 'white',
  border: 'none',
  borderRadius: '6px',
  fontSize: '12px',
  minHeight: '36px',
  cursor: 'pointer',
  WebkitTapHighlightColor: 'transparent',
};

export default App;