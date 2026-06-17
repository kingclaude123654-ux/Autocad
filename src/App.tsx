import React, { useState, useCallback } from 'react';
import { useCADEngine } from './hooks/useCADEngine';
import * as THREE from 'three';

const App: React.FC = () => {
  const {
    canvasRef,
    objects,
    selectedId,
    viewMode,
    orthoMode,
    drawingMode,
    setOrthoMode,
    setViewMode,
    setDrawingMode,
    moveObject,
    copyObject,
    executeExtrude,
    executeRotate,
    executeScale,
    executeErase,
    undo,
    redo,
    exportToPDF
  } = useCADEngine();

  const [extrudeDepth, setExtrudeDepth] = useState<number>(10);
  const [rotateAngle, setRotateAngle] = useState<number>(Math.PI / 4);
  const [scaleFactor, setScaleFactor] = useState<number>(1.2);

  const handleMove = useCallback(() => {
    if (selectedId) moveObject(selectedId, new THREE.Vector3(10, 0, 0));
  }, [selectedId, moveObject]);

  const handleCopy = useCallback(() => {
    if (selectedId) copyObject(selectedId);
  }, [selectedId, copyObject]);

  const handleRotate = useCallback(() => {
    if (selectedId) executeRotate(selectedId, new THREE.Vector3(0, 0, 1), rotateAngle);
  }, [selectedId, rotateAngle, executeRotate]);

  const handleScale = useCallback(() => {
    if (selectedId) executeScale(selectedId, new THREE.Vector3(scaleFactor, scaleFactor, scaleFactor));
  }, [selectedId, scaleFactor, executeScale]);

  const handleExtrude = useCallback(() => {
    if (selectedId) executeExtrude(selectedId, extrudeDepth);
  }, [selectedId, extrudeDepth, executeExtrude]);

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden', background: '#121212', color: '#e0e0e0', fontFamily: 'monospace' }}>
      <div style={{ width: '280px', background: '#1e1e1e', padding: '20px', borderRight: '1px solid #333', overflowY: 'auto', boxShadow: '2px 0 10px rgba(0,0,0,0.5)' }}>
        <h1 style={{ fontSize: '1.4rem', color: '#3498db', marginBottom: '25px', borderBottom: '2px solid #3498db', paddingBottom: '10px' }}>PRO CAD 3D</h1>
        
        <section style={{ marginBottom: '25px' }}>
          <h3 style={{ fontSize: '0.9rem', color: '#888', textTransform: 'uppercase', marginBottom: '10px' }}>Draw Tools</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <button style={{ background: drawingMode === 'line' ? '#3498db' : '#333' }} onClick={() => setDrawingMode('line')}>LINE</button>
            <button style={{ background: drawingMode === 'polyline' ? '#3498db' : '#333' }} onClick={() => setDrawingMode('polyline')}>POLY</button>
            <button style={{ background: drawingMode === 'rectangle' ? '#3498db' : '#333' }} onClick={() => setDrawingMode('rectangle')}>RECT</button>
            <button style={{ background: drawingMode === 'circle' ? '#3498db' : '#333' }} onClick={() => setDrawingMode('circle')}>CIRC</button>
            <button style={{ gridColumn: 'span 2', background: drawingMode === 'none' ? '#e74c3c' : '#333' }} onClick={() => setDrawingMode('none')}>CANCEL</button>
          </div>
        </section>

        <section style={{ marginBottom: '25px' }}>
          <h3 style={{ fontSize: '0.9rem', color: '#888', textTransform: 'uppercase', marginBottom: '10px' }}>Modify</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <button onClick={handleMove} disabled={!selectedId}>MOVE X+</button>
            <button onClick={handleCopy} disabled={!selectedId}>COPY</button>
            <button onClick={handleRotate} disabled={!selectedId}>ROT Z</button>
            <button onClick={handleScale} disabled={!selectedId}>SCALE</button>
            <button style={{ gridColumn: 'span 2', background: '#c0392b' }} onClick={() => selectedId && executeErase(selectedId)} disabled={!selectedId}>ERASE</button>
          </div>
        </section>

        <section style={{ marginBottom: '25px' }}>
          <h3 style={{ fontSize: '0.9rem', color: '#888', textTransform: 'uppercase', marginBottom: '10px' }}>3D Operations</h3>
          <div style={{ marginBottom: '10px' }}>
            <label style={{ fontSize: '0.8rem' }}>DEPTH: </label>
            <input type="number" style={{ width: '60px', background: '#333', border: '1px solid #444', color: '#fff' }} value={extrudeDepth} onChange={(e) => setExtrudeDepth(parseFloat(e.target.value))} />
            <button style={{ marginLeft: '5px' }} onClick={handleExtrude} disabled={!selectedId}>EXTRUDE</button>
          </div>
        </section>

        <section style={{ marginBottom: '25px' }}>
          <h3 style={{ fontSize: '0.9rem', color: '#888', textTransform: 'uppercase', marginBottom: '10px' }}>View Settings</h3>
          <div style={{ marginBottom: '10px' }}>
            <label style={{ fontSize: '0.8rem' }}><input type="checkbox" checked={orthoMode} onChange={() => setOrthoMode(!orthoMode)} /> ORTHOGRAPHIC</label>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px' }}>
            <button onClick={() => setViewMode('top')} style={{ background: viewMode === 'top' ? '#3498db' : '#333' }}>TOP</button>
            <button onClick={() => setViewMode('front')} style={{ background: viewMode === 'front' ? '#3498db' : '#333' }}>FRONT</button>
            <button onClick={() => setViewMode('side')} style={{ background: viewMode === 'side' ? '#3498db' : '#333' }}>SIDE</button>
            <button onClick={() => setViewMode('isometric')} style={{ background: viewMode === 'isometric' ? '#3498db' : '#333' }}>ISO</button>
          </div>
        </section>

        <section style={{ marginTop: '30px', borderTop: '1px solid #333', paddingTop: '20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
            <button onClick={undo}>UNDO</button>
            <button onClick={redo}>REDO</button>
          </div>
          <button style={{ width: '100%', background: '#27ae60', padding: '10px', fontWeight: 'bold' }} onClick={exportToPDF}>EXPORT PNG</button>
        </section>

        <div style={{ marginTop: '20px', fontSize: '0.7rem', color: '#666' }}>
          <p>Selected ID:</p>
          <p style={{ color: '#3498db', wordBreak: 'break-all' }}>{selectedId || 'NONE'}</p>
          <p style={{ marginTop: '10px' }}>Total Objects: {objects.length}</p>
        </div>
      </div>
      
      <div ref={canvasRef} style={{ flexGrow: 1, position: 'relative' }}>
        <div style={{ position: 'absolute', top: '10px', right: '10px', background: 'rgba(0,0,0,0.7)', padding: '10px', borderRadius: '5px', fontSize: '0.8rem', pointerEvents: 'none' }}>
          {drawingMode !== 'none' ? `MODE: DRAWING ${drawingMode.toUpperCase()}` : 'MODE: SELECTION'}
        </div>
        {objects.map(obj => obj.id === selectedId && obj.dimensions && (
          <div key={`dim-${obj.id}`} style={{ position: 'absolute', bottom: '20px', left: '20px', background: 'rgba(52, 152, 219, 0.8)', padding: '5px 10px', borderRadius: '3px', fontSize: '0.9rem', color: '#fff' }}>
            DIMENSIONS: {obj.dimensions}
          </div>
        ))}
      </div>
    </div>
  );
};

export default App;
