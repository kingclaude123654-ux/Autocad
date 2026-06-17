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
  const [rotateAngle, setRotateAngle] = useState<number>(45); // Degrees
  const [scaleFactor, setScaleFactor] = useState<number>(1.2);

  const handleMove = useCallback(() => {
    if (selectedId) moveObject(selectedId, new THREE.Vector3(10, 0, 0));
  }, [selectedId, moveObject]);

  const handleCopy = useCallback(() => {
    if (selectedId) copyObject(selectedId);
  }, [selectedId, copyObject]);

  const handleRotate = useCallback(() => {
    if (selectedId) {
      const radians = (rotateAngle * Math.PI) / 180;
      executeRotate(selectedId, new THREE.Vector3(0, 0, 1), radians);
    }
  }, [selectedId, rotateAngle, executeRotate]);

  const handleScale = useCallback(() => {
    if (selectedId) executeScale(selectedId, new THREE.Vector3(scaleFactor, scaleFactor, scaleFactor));
  }, [selectedId, scaleFactor, executeScale]);

  const handleExtrude = useCallback(() => {
    if (selectedId) executeExtrude(selectedId, extrudeDepth);
  }, [selectedId, extrudeDepth, executeExtrude]);

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden', background: '#121212', color: '#e0e0e0', fontFamily: 'monospace' }}>
      <div style={{ width: '280px', background: '#1e1e1e', padding: '20px', borderRight: '1px solid #333', overflowY: 'auto' }}>
        <h1 style={{ fontSize: '1.4rem', color: '#3498db', marginBottom: '25px', borderBottom: '2px solid #3498db', paddingBottom: '10px' }}>PRO CAD 3D</h1>
        
        <section style={{ marginBottom: '25px' }}>
          <h3 style={{ fontSize: '0.9rem', color: '#888', textTransform: 'uppercase', marginBottom: '10px' }}>Draw Tools</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <button style={{ background: drawingMode === 'line' ? '#3498db' : '#333', padding: '8px', border: 'none', color: 'white' }} onClick={() => setDrawingMode('line')}>LINE</button>
            <button style={{ background: drawingMode === 'polyline' ? '#3498db' : '#333', padding: '8px', border: 'none', color: 'white' }} onClick={() => setDrawingMode('polyline')}>POLY</button>
            <button style={{ background: drawingMode === 'rectangle' ? '#3498db' : '#333', padding: '8px', border: 'none', color: 'white' }} onClick={() => setDrawingMode('rectangle')}>RECT</button>
            <button style={{ background: drawingMode === 'circle' ? '#3498db' : '#333', padding: '8px', border: 'none', color: 'white' }} onClick={() => setDrawingMode('circle')}>CIRC</button>
            <button style={{ gridColumn: 'span 2', background: drawingMode === 'none' ? '#e74c3c' : '#333', padding: '8px', border: 'none', color: 'white' }} onClick={() => setDrawingMode('none')}>CANCEL</button>
          </div>
        </section>

        <section style={{ marginBottom: '25px' }}>
          <h3 style={{ fontSize: '0.9rem', color: '#888', textTransform: 'uppercase', marginBottom: '10px' }}>Modify</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
            <button style={{ padding: '8px', background: '#333', border: 'none', color: 'white' }} onClick={handleMove} disabled={!selectedId}>MOVE X+</button>
            <button style={{ padding: '8px', background: '#333', border: 'none', color: 'white' }} onClick={handleCopy} disabled={!selectedId}>COPY</button>
          </div>
          <div style={{ marginBottom: '10px' }}>
            <label style={{ fontSize: '0.8rem' }}>ROT (°): </label>
            <input type="number" style={{ width: '50px', background: '#333', color: 'white', border: '1px solid #444' }} value={rotateAngle} onChange={(e) => setRotateAngle(parseFloat(e.target.value))} />
            <button style={{ marginLeft: '5px' }} onClick={handleRotate} disabled={!selectedId}>ROT Z</button>
          </div>
          <div style={{ marginBottom: '10px' }}>
            <label style={{ fontSize: '0.8rem' }}>SCALE: </label>
            <input type="number" step="0.1" style={{ width: '50px', background: '#333', color: 'white', border: '1px solid #444' }} value={scaleFactor} onChange={(e) => setScaleFactor(parseFloat(e.target.value))} />
            <button style={{ marginLeft: '5px' }} onClick={handleScale} disabled={!selectedId}>SCALE</button>
          </div>
          <button style={{ width: '100%', background: '#c0392b', padding: '8px', border: 'none', color: 'white' }} onClick={() => selectedId && executeErase(selectedId)} disabled={!selectedId}>ERASE</button>
        </section>

        <section style={{ marginBottom: '25px' }}>
          <h3 style={{ fontSize: '0.9rem', color: '#888', textTransform: 'uppercase', marginBottom: '10px' }}>3D Operations</h3>
          <div style={{ marginBottom: '10px' }}>
            <label style={{ fontSize: '0.8rem' }}>DEPTH: </label>
            <input type="number" style={{ width: '60px', background: '#333', color: 'white', border: '1px solid #444' }} value={extrudeDepth} onChange={(e) => setExtrudeDepth(parseFloat(e.target.value))} />
            <button style={{ marginLeft: '5px' }} onClick={handleExtrude} disabled={!selectedId}>EXTRUDE</button>
          </div>
        </section>

        <section style={{ marginBottom: '25px' }}>
          <h3 style={{ fontSize: '0.9rem', color: '#888', textTransform: 'uppercase', marginBottom: '10px' }}>View</h3>
          <div style={{ marginBottom: '10px' }}>
            <label style={{ fontSize: '0.8rem' }}><input type="checkbox" checked={orthoMode} onChange={() => setOrthoMode(!orthoMode)} /> ORTHO</label>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px' }}>
            <button onClick={() => setViewMode('top')} style={{ background: viewMode === 'top' ? '#3498db' : '#333', border: 'none', color: 'white' }}>TOP</button>
            <button onClick={() => setViewMode('front')} style={{ background: viewMode === 'front' ? '#3498db' : '#333', border: 'none', color: 'white' }}>FRONT</button>
            <button onClick={() => setViewMode('side')} style={{ background: viewMode === 'side' ? '#3498db' : '#333', border: 'none', color: 'white' }}>SIDE</button>
            <button onClick={() => setViewMode('isometric')} style={{ background: viewMode === 'isometric' ? '#3498db' : '#333', border: 'none', color: 'white' }}>ISO</button>
          </div>
        </section>

        <section style={{ marginTop: '30px', borderTop: '1px solid #333', paddingTop: '20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
            <button style={{ padding: '8px', background: '#333', color: 'white' }} onClick={undo}>UNDO</button>
            <button style={{ padding: '8px', background: '#333', color: 'white' }} onClick={redo}>REDO</button>
          </div>
          <button style={{ width: '100%', background: '#27ae60', padding: '10px', fontWeight: 'bold', border: 'none', color: 'white' }} onClick={exportToPDF}>EXPORT PNG</button>
        </section>
      </div>
      
      <div ref={canvasRef} style={{ flexGrow: 1, position: 'relative' }}>
        <div style={{ position: 'absolute', top: '10px', right: '10px', background: 'rgba(0,0,0,0.7)', padding: '10px', borderRadius: '5px', fontSize: '0.8rem' }}>
          {drawingMode !== 'none' ? `DRAWING: ${drawingMode.toUpperCase()}` : 'MODE: SELECT'}
        </div>
        {objects.map(obj => obj.id === selectedId && obj.dimensions && (
          <div key={`dim-${obj.id}`} style={{ position: 'absolute', bottom: '20px', left: '20px', background: 'rgba(52, 152, 219, 0.8)', padding: '5px 10px', borderRadius: '3px', fontSize: '0.9rem' }}>
            DIM: {obj.dimensions}
          </div>
        ))}
      </div>
    </div>
  );
};

export default App;
