import React, { useEffect, useRef, useState } from 'react';
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
  } as React.CSSProperties,
  canvas: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  } as React.CSSProperties,
  bar: {
    display: 'flex',
    padding: '8px',
    backgroundColor: '#16213e',
    gap: 8,
    overflowX: 'auto',
  } as React.CSSProperties,
  btn: (active: boolean): React.CSSProperties => ({
    padding: '8px 16px',
    backgroundColor: active ? '#e94560' : '#0f3460',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    fontSize: 12,
    cursor: 'pointer',
    minWidth: 60,
  }),
};

const App: React.FC = () => {
  const ref = useRef<HTMLDivElement>(null);
  const e = useCADEngine();
  const { state, initScene, setTool, setView, selectObject, executeExtrude, executeErase } = e;

  useEffect(() => {
    if (ref.current) initScene(ref.current);
  }, [initScene]);

  return (
    <div style={S.app}>
      <div style={S.bar}>
        <button style={S.btn(state.viewMode === 'top')} onClick={() => setView('top')}>Top</button>
        <button style={S.btn(state.viewMode === 'front')} onClick={() => setView('front')}>Front</button>
        <button style={S.btn(state.viewMode === 'side')} onClick={() => setView('side')}>Side</button>
        <button style={S.btn(state.viewMode === 'isometric')} onClick={() => setView('isometric')}>3D</button>
      </div>

      <div style={S.bar}>
        <button style={S.btn(state.activeTool === 'select')} onClick={() => setTool('select')}>Select</button>
        <button style={S.btn(state.activeTool === 'line')} onClick={() => setTool('line')}>Line</button>
        <button style={S.btn(state.activeTool === 'rectangle')} onClick={() => setTool('rectangle')}>Rect</button>
        <button style={S.btn(state.activeTool === 'circle')} onClick={() => setTool('circle')}>Circle</button>
      </div>

      <div ref={ref} style={S.canvas} />

      {state.selectedId && (
        <div style={S.bar}>
          <button style={{ ...S.btn(false), minWidth: 80 }} onClick={() => executeExtrude(state.selectedId!, 2)}>Extrude</button>
          <button style={{ ...S.btn(false), minWidth: 80, backgroundColor: '#e94560' }} onClick={() => executeErase(state.selectedId!)}>Delete</button>
          <span style={{ padding: '8px' }}>Selected: {state.selectedId.slice(-4)}</span>
        </div>
      )}

      <div style={{ padding: '4px 8px', fontSize: 10, color: '#aaa', backgroundColor: '#0f3460' }}>
        Tool: {state.activeTool} | Objects: {state.objects.length} | View: {state.viewMode}
      </div>
    </div>
  );
};

export default App;