import React, { useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { useCADEngine } from './hooks/useCADEngine';

const App: React.FC = () => {
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const engine = useCADEngine();
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
    executeRotate,
    executeScale,
    executeErase,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleResize,
    addObject,
  } = engine;

  useEffect(() => {
    if (canvasContainerRef.current) {
      initScene(canvasContainerRef.current);
    }
    window.addEventListener('resize', handleResize);
    document.body.style.overscrollBehavior = 'none';
    document.body.style.touchAction = 'none';
    return () => {
      window.removeEventListener('resize', handleResize);
      document.body.style.overscrollBehavior = '';
      document.body.style.touchAction = '';
    };
  }, [initScene, handleResize]);

  useEffect(() => {
    const container = canvasContainerRef.current;
    if (!container) return;
    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd, { passive: false });
    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  const handleQuickAddBox = useCallback((): void => {
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

  const handleQuickAddSphere = useCallback((): void => {
    const geometry = new THREE.SphereGeometry(0.8, 24, 24);
    const material = new THREE.MeshStandardMaterial({ 
      color: 0xe24a4a,
      roughness: 0.7,
      metalness: 0.1,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(Math.random() * 4 - 2, Math.random() * 4 - 2, Math.random() * 4 - 2);
    addObject(mesh, 'circle');
  }, [addObject]);

  const handleQuickAddCylinder = useCallback((): void => {
    const geometry = new THREE.CylinderGeometry(0.8, 0.8, 2, 24);
    const material = new THREE.MeshStandardMaterial({ 
      color: 0x50c878,
      roughness: 0.7,
      metalness: 0.1,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(Math.random() * 4 - 2, Math.random() * 4 - 2, Math.random() * 4 - 2);
    addObject(mesh, 'extrude');
  }, [addObject]);

  const handleExtrudeSelected = useCallback((): void => {
    if (state.selectedId) {
      executeExtrude(state.selectedId, 1);
    }
  }, [state.selectedId, executeExtrude]);

  const handleFilletSelected = useCallback((): void => {
    if (state.selectedId) {
      executeFillet(state.selectedId, 0.3);
    }
  }, [state.selectedId, executeFillet]);

  const handleRotateSelected = useCallback((): void => {
    if (state.selectedId) {
      executeRotate(state.selectedId, 'y', Math.PI / 4);
    }
  }, [state.selectedId, executeRotate]);

  const handleScaleSelected = useCallback((): void => {
    if (state.selectedId) {
      executeScale(state.selectedId, 1.2, 1.2, 1.2);
    }
  }, [state.selectedId, executeScale]);

  const handleEraseSelected = useCallback((): void => {
    if (state.selectedId) {
      executeErase(state.selectedId);
    }
  }, [state.selectedId, executeErase]);

  const isSelected = state.selectedId !== null;

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
      <div style={{
        display: 'flex',
        overflowX: 'auto',
        padding: '8px',
        backgroundColor: '#16213e',
        borderBottom: '1px solid #0f3460',
        gap: '6px',
        minHeight: '44px',
        alignItems: 'center',
      }}>
        <button onClick={() => syncCameraMatrix('isometric')} style={btn(state.viewMode === 'isometric')}>3D</button>
        <button onClick={() => syncCameraMatrix('top')} style={btn(state.viewMode === 'top')}>Top</button>
        <button onClick={() => syncCameraMatrix('front')} style={btn(state.viewMode === 'front')}>Front</button>
        <button onClick={() => syncCameraMatrix('side')} style={btn(state.viewMode === 'side')}>Side</button>
        <div style={sep} />
        <button onClick={toggleOrthoMode} style={{
          ...btn(state.orthoMode),
          backgroundColor: state.orthoMode ? '#e94560' : '#0f3460',
          fontSize: '11px',
        }}>{state.orthoMode ? 'Ortho' : 'Persp'}</button>
        <div style={sep} />
        <button onClick={undo} style={iconBtn} disabled={state.historyIndex <= 0}>Undo</button>
        <button onClick={redo} style={iconBtn} disabled={state.historyIndex >= state.history.length - 1}>Redo</button>
      </div>
      <div style={{
        display: 'flex',
        overflowX: 'auto',
        padding: '6px 8px',
        backgroundColor: '#16213e',
        borderBottom: '1px solid #0f3460',
        gap: '5px',
        minHeight: '40px',
        alignItems: 'center',
      }}>
        <button onClick={() => setActiveTool('select')} style={toolBtn(state.activeTool === 'select')}>Sel</button>
        <button onClick={() => setActiveTool('move')} style={toolBtn(state.activeTool === 'move')}>Mov</button>
        <button onClick={() => setActiveTool('line')} style={toolBtn(state.activeTool === 'line')}>Line</button>
        <button onClick={() => setActiveTool('rectangle')} style={toolBtn(state.activeTool === 'rectangle')}>Rect</button>
        <button onClick={() => setActiveTool('circle')} style={toolBtn(state.activeTool === 'circle')}>Circ</button>
      </div>
      <div ref={canvasContainerRef} style={{
        flex: 1,
        position: 'relative',
        overflow: 'hidden',
        backgroundColor: '#1a1a2e',
        touchAction: 'none',
      }} />
      <div style={{
        display: 'flex',
        overflowX: 'auto',
        padding: '6px 8px',
        backgroundColor: '#16213e',
        borderTop: '1px solid #0f3460',
        gap: '5px',
        minHeight: '44px',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <button onClick={handleExtrudeSelected} style={actBtn} disabled={!isSelected}>Extrude</button>
        <button onClick={handleFilletSelected} style={actBtn} disabled={!isSelected}>Fillet</button>
        <button onClick={handleRotateSelected} style={actBtn} disabled={!isSelected}>Rotate</button>
        <button onClick={handleScaleSelected} style={actBtn} disabled={!isSelected}>Scale</button>
        <button onClick={handleEraseSelected} style={{...actBtn, backgroundColor: '#e94560'}} disabled={!isSelected}>Delete</button>
      </div>
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
        <button onClick={handleQuickAddBox} style={qaddBtn}>+ Box</button>
        <button onClick={handleQuickAddSphere} style={qaddBtn}>+ Sphere</button>
        <button onClick={handleQuickAddCylinder} style={qaddBtn}>+ Cylinder</button>
      </div>
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

const sep: React.CSSProperties = {
  width: '1px',
  height: '24px',
  backgroundColor: '#0f3460',
  margin: '0 4px',
};

const btn = (active: boolean): React.CSSProperties => ({
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
});

const iconBtn: React.CSSProperties = {
  padding: '8px 12px',
  backgroundColor: '#0f3460',
  color: 'white',
  border: 'none',
  borderRadius: '6px',
  fontSize: '12px',
  minWidth: '44px',
  minHeight: '44px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
};

const toolBtn = (active: boolean): React.CSSProperties => ({
  padding: '8px 12px',
  backgroundColor: active ? '#e94560' : '#0f3460',
  color: 'white',
  border: 'none',
  borderRadius: '20px',
  fontSize: '12px',
  minWidth: '44px',
  minHeight: '44px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
});

const actBtn: React.CSSProperties = {
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
};

const qaddBtn: React.CSSProperties = {
  padding: '6px 12px',
  backgroundColor: '#533483',
  color: 'white',
  border: 'none',
  borderRadius: '6px',
  fontSize: '12px',
  minHeight: '36px',
  cursor: 'pointer',
};

export default App;