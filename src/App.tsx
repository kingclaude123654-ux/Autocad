import React, { useEffect, useRef, useCallback, useState } from 'react';
import { useCADEngine } from './hooks/useCADEngine';

const S = {
  app: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    width: '100vw',
    backgroundColor: '#1a1a2e',
    color: '#fff',
    fontFamily: 'sans-serif',
    overflow: 'hidden',
    userSelect: 'none',
    touchAction: 'none',
  } as React.CSSProperties,
  canvas: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#1a1a2e',
    touchAction: 'none',
  } as React.CSSProperties,
  bar: {
    display: 'flex',
    overflowX: 'auto',
    padding: '6px 8px',
    backgroundColor: '#16213e',
    borderBottom: '1px solid #0f3460',
    gap: 4,
    minHeight: 40,
    alignItems: 'center',
    flexWrap: 'nowrap',
  } as React.CSSProperties,
  bbar: {
    display: 'flex',
    overflowX: 'auto',
    padding: '6px 8px',
    backgroundColor: '#16213e',
    borderTop: '1px solid #0f3460',
    gap: 4,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  } as React.CSSProperties,
  status: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '3px 8px',
    backgroundColor: '#0f3460',
    fontSize: 10,
    color: '#aaa',
    minHeight: 22,
    alignItems: 'center',
  } as React.CSSProperties,
};

const B = (a: boolean): React.CSSProperties => ({
  padding: '6px 10px',
  backgroundColor: a ? '#e94560' : '#0f3460',
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  fontSize: 11,
  fontWeight: a ? 'bold' : 'normal',
  whiteSpace: 'nowrap',
  minWidth: 40,
  minHeight: 36,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
});

const SB: React.CSSProperties = {
  ...B(false),
  fontSize: 10,
  padding: '4px 8px',
  minHeight: 32,
};

const TB = (a: boolean): React.CSSProperties => ({
  ...B(a),
  borderRadius: 20,
});

const AB: React.CSSProperties = {
  ...B(false),
  fontSize: 11,
  padding: '8px 12px',
  minHeight: 40,
};

const Sep: React.CSSProperties = {
  width: 1,
  height: 24,
  backgroundColor: '#0f3460',
  margin: '0 2px',
};

const App: React.FC = () => {
  const ref = useRef<HTMLDivElement>(null);
  const finp = useRef<HTMLInputElement>(null);
  const e = useCADEngine();
  const {
    state,
    initScene,
    undo,
    redo,
    lockView,
    toggleOrthoMode,
    setSnapEnabled,
    setGridVisible,
    executeExtrude,
    executeFillet,
    executeRotate,
    executeScale,
    executeErase,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleResize,
    exportScene,
    importScene,
  } = e;
  const [ui, setUi] = useState(true);

  useEffect(() => {
    if (ref.current) initScene(ref.current);
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [initScene, handleResize]);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    c.addEventListener('touchstart', handleTouchStart, { passive: false });
    c.addEventListener('touchmove', handleTouchMove, { passive: false });
    c.addEventListener('touchend', handleTouchEnd, { passive: false });
    return () => {
      c.removeEventListener('touchstart', handleTouchStart);
      c.removeEventListener('touchmove', handleTouchMove);
      c.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  const save = useCallback(() => {
    const j = exportScene();
    const b = new Blob([j], { type: 'application/json' });
    const u = URL.createObjectURL(b);
    const a = document.createElement('a');
    a.href = u;
    a.download = 'cad-' + new Date().toISOString().slice(0, 10) + '.json';
    a.click();
    URL.revokeObjectURL(u);
  }, [exportScene]);

  const open = useCallback(() => {
    finp.current?.click();
  }, []);

  const onFile = useCallback((ev: React.ChangeEvent<HTMLInputElement>) => {
    const f = ev.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      if (typeof r.result === 'string') importScene(r.result);
    };
    r.readAsText(f);
    if (finp.current) finp.current.value = '';
  }, [importScene]);

  const sel = state.selectedId !== null;

  return (
    <div style={S.app}>
      <input ref={finp} type="file" accept=".json" style={{ display: 'none' }} onChange={onFile} />
      {ui && (
        <>
          <div style={S.bar}>
            <button onClick={() => lockView('isometric')} style={B(state.viewMode === 'isometric')}>3D</button>
            <button onClick={() => lockView('top')} style={B(state.viewMode === 'top')}>Top</button>
            <button onClick={() => lockView('front')} style={B(state.viewMode === 'front')}>Front</button>
            <button onClick={() => lockView('side')} style={B(state.viewMode === 'side')}>Side</button>
            <div style={Sep} />
            <button onClick={toggleOrthoMode} style={{ ...B(state.orthoMode), backgroundColor: state.orthoMode ? '#e94560' : '#0f3460' }}>{state.orthoMode ? 'Ortho' : 'Persp'}</button>
            <div style={Sep} />
            <button onClick={undo} style={SB} disabled={state.historyIndex <= 0}>Undo</button>
            <button onClick={redo} style={SB} disabled={state.historyIndex >= state.history.length - 1}>Redo</button>
            <div style={Sep} />
            <button onClick={save} style={SB}>Save</button>
            <button onClick={open} style={SB}>Open</button>
          </div>
          <div style={S.bar}>
            <button onClick={() => e.setActiveTool('select')} style={TB(state.activeTool === 'select')}>Sel</button>
            <button onClick={() => e.setActiveTool('line')} style={TB(state.activeTool === 'line')}>Line</button>
            <button onClick={() => e.setActiveTool('rectangle')} style={TB(state.activeTool === 'rectangle')}>Rect</button>
            <button onClick={() => e.setActiveTool('circle')} style={TB(state.activeTool === 'circle')}>Circ</button>
            <div style={Sep} />
            <button onClick={() => setSnapEnabled(!state.snapEnabled)} style={{ ...SB, backgroundColor: state.snapEnabled ? '#2d6a4f' : '#0f3460' }}>Snap</button>
            <button onClick={() => setGridVisible(!state.gridVisible)} style={{ ...SB, backgroundColor: state.gridVisible ? '#2d6a4f' : '#0f3460' }}>Grid</button>
          </div>
        </>
      )}
      <div ref={ref} style={S.canvas} onDoubleClick={() => setUi(!ui)} />
      {ui && (
        <>
          <div style={S.bbar}>
            <button onClick={() => { if (sel) executeExtrude(state.selectedId!, 2); }} style={AB} disabled={!sel}>Extrude</button>
            <button onClick={() => { if (sel) executeFillet(state.selectedId!, 0.3); }} style={AB} disabled={!sel}>Fillet</button>
            <button onClick={() => { if (sel) executeRotate(state.selectedId!, 'y', Math.PI / 4); }} style={AB} disabled={!sel}>Rotate</button>
            <button onClick={() => { if (sel) executeScale(state.selectedId!, 1.2, 1.2, 1.2); }} style={AB} disabled={!sel}>Scale</button>
            <button onClick={() => { if (sel) executeErase(state.selectedId!); }} style={{ ...AB, backgroundColor: '#e94560' }} disabled={!sel}>Del</button>
          </div>
          <div style={S.status}>
            <span>{state.activeTool}</span>
            <span>{state.touchCount > 1 ? 'CAM' : state.isDrawing ? 'DRAW' : ''}</span>
            <span>N:{state.objects.length}</span>
            <span>{state.viewMode}{state.orthoMode ? '(O)' : '(P)'}</span>
            <span>{state.selectedId ? '#' + state.selectedId.slice(-4) : '-'}</span>
          </div>
        </>
      )}
    </div>
  );
};

export default App;