import React, { useEffect, useRef, useCallback, useState } from 'react';
import { useCADEngine } from './hooks/useCADEngine';

const S = {
  app: { display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', backgroundColor: '#1a1a2e', color: '#fff', fontFamily: 'sans-serif', overflow: 'hidden', userSelect: 'none', touchAction: 'none' } as React.CSSProperties,
  canvas: { flex: 1, position: 'relative', overflow: 'hidden', backgroundColor: '#1a1a2e', touchAction: 'none' } as React.CSSProperties,
  bar: { display: 'flex', overflowX: 'auto', padding: '6px 8px', backgroundColor: '#16213e', borderBottom: '1px solid #0f3460', gap: 4, minHeight: 40, alignItems: 'center', flexWrap: 'nowrap' } as React.CSSProperties,
  bbar: { display: 'flex', overflowX: 'auto', padding: '6px 8px', backgroundColor: '#16213e', borderTop: '1px solid #0f3460', gap: 4, minHeight: 44, alignItems: 'center', justifyContent: 'center' } as React.CSSProperties,
  status: { display: 'flex', justifyContent: 'space-between', padding: '3px 8px', backgroundColor: '#0f3460', fontSize: 10, color: '#aaa', minHeight: 22, alignItems: 'center' } as React.CSSProperties,
};

const B = (a: boolean): React.CSSProperties => ({ padding: '6px 10px', backgroundColor: a ? '#e94560' : '#0f3460', color: '#fff', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: a ? 'bold' : 'normal', whiteSpace: 'nowrap', minWidth: 40, minHeight: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' });
const SB: React.CSSProperties = { ...B(false), fontSize: 10, padding: '4px 8px', minHeight: 32 };
const TB = (a: boolean): React.CSSProperties => ({ ...B(a), borderRadius: 20 });
const AB: React.CSSProperties = { ...B(false), fontSize: 11, padding: '8px 12px', minHeight: 40 };
const Sep: React.CSSProperties = { width: 1, height: 24, backgroundColor: '#0f3460', margin: '0 2px' };

const App: React.FC = () => {
  const ref = useRef<HTMLDivElement>(null);
  const finp = useRef<HTMLInputElement>(null);
  const e = useCADEngine();
  const { state, initScene, undo, redo, lockView, toggleOrthoMode, setSnapEnabled, setGridVisible, executeExtrude, executeFillet, executeRotate, executeScale, executeErase, handleTouchStart, handleTouchMove, handleTouchEnd, handleResize, exportScene, importScene } = e;
  const [ui, setUi] = useState(true);

  useEffect(() => {
    if (ref.current) initScene(ref.current);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [initScene, handleResize]);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    c.addEventListener('touchstart', handleTouchStart, { passive: false });
    c.addEventListener('touchmove', handleTouchMove,