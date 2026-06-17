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
    executeFillet,
    executeTrim,
    executeExtend,
    executeRotate,
    executeOffset,
    executeScale,
    executeUnion,
    executeSubtract,
    executeErase,
    undo,
    redo,
    exportToPDF
  } = useCADEngine();

  const [extrudeDepth, setExtrudeDepth] = useState<number>(10);
  const [rotateAngle, setRotateAngle] = useState<number>(45);
  const [scaleFactor, setScaleFactor] = useState<number>(1.2);
  const [filletRadius, setFilletRadius] = useState<number>(5);
  const [offsetDistance, setOffsetDistance] = useState<number>(10);
  const [id1, setId1] = useState<string>('');
  const [id2, setId2] = useState<string>('');

  const handleMove = useCallback(() => { if (selectedId) moveObject(selectedId, new THREE.Vector3(10, 0, 0)); }, [selectedId, moveObject]);
  const handleCopy = useCallback(() => { if (selectedId) copyObject(selectedId); }, [selectedId, copyObject]);
  const handleRotate = useCallback(() => { if (selectedId) executeRotate(selectedId, new THREE.Vector3(0, 0, 1), (rotateAngle * Math.PI) / 180); }, [selectedId, rotateAngle, executeRotate]);
  const handleScale = useCallback(() => { if (selectedId) executeScale(selectedId, new THREE.Vector3(scaleFactor, scaleFactor, scaleFactor)); }, [selectedId, scaleFactor, executeScale]);
  const handleExtrude = useCallback(() => { if (selectedId) executeExtrude(selectedId, extrudeDepth); }, [selectedId, extrudeDepth, executeExtrude]);
  const handleFillet = useCallback(() => { if (selectedId) executeFillet(selectedId, filletRadius); }, [selectedId, filletRadius, executeFillet]);
  const handleOffset = useCallback(() => { if (selectedId) executeOffset(selectedId, offsetDistance); }, [selectedId, offsetDistance, executeOffset]);
  const handleTrim = useCallback(() => { if (id1 && id2) executeTrim(id1, id2); }, [id1, id2, executeTrim]);
  const handleExtend = useCallback(() => { if (id1 && id2) executeExtend(id1, id2); }, [id1, id2, executeExtend]);
  const handleUnion = useCallback(() => { if (id1 && id2) executeUnion(id1, id2); }, [id1, id2, executeUnion]);
  const handleSubtract = useCallback(() => { if (id1 && id2) executeSubtract(id1, id2); }, [id1, id2, executeSubtract]);

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden', background: '#121212', color: '#e0e0e0', fontFamily: 'monospace' }}>
      <div style={{ width: '300px', background: '#1e1e1e', padding: '15px', borderRight: '1px solid #333', overflowY: 'auto' }}>
        <h1 style={{ fontSize: '1.2rem', color: '#3498db', marginBottom: '20px', borderBottom: '2px solid #3498db', paddingBottom: '10px' }}>CAD ENGINE PRO</h1>
        
        <section style={{ marginBottom: '20px' }}>
          <h3 style={{ fontSize: '0.8rem', color: '#888', marginBottom: '8px' }}>DRAW</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px' }}>
            <button style={{ background: drawingMode === 'line' ? '#3498db' : '#333', padding: '5px', border: 'none', color: 'white' }} onClick={() => setDrawingMode('line')}>LINE</button>
            <button style={{ background: drawingMode === 'polyline' ? '#3498db' : '#333', padding: '5px', border: 'none', color: 'white' }} onClick={() => setDrawingMode('polyline')}>POLY</button>
            <button style={{ background: drawingMode === 'rectangle' ? '#3498db' : '#333', padding: '5px', border: 'none', color: 'white' }} onClick={() => setDrawingMode('rectangle')}>RECT</button>
            <button style={{ background: drawingMode === 'circle' ? '#3498db' : '#333', padding: '5px', border: 'none', color: 'white' }} onClick={() => setDrawingMode('circle')}>CIRC</button>
            <button style={{ gridColumn: 'span 2', background: drawingMode === 'none' ? '#e74c3c' : '#333', padding: '5px', border: 'none', color: 'white' }} onClick={() => setDrawingMode('none')}>CANCEL</button>
          </div>
        </section>

        <section style={{ marginBottom: '20px' }}>
          <h3 style={{ fontSize: '0.8rem', color: '#888', marginBottom: '8px' }}>BASIC TRANSFORM</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px', marginBottom: '10px' }}>
            <button onClick={handleMove} disabled={!selectedId}>MOVE X+</button>
            <button onClick={handleCopy} disabled={!selectedId}>COPY</button>
            <button style={{ gridColumn: 'span 2', background: '#c0392b' }} onClick={() => selectedId && executeErase(selectedId)} disabled={!selectedId}>ERASE</button>
          </div>
          <div style={{ fontSize: '0.7rem' }}>
            <div style={{ marginBottom: '5px' }}>
              <label>ROT: </label><input type="number" style={{ width: '40px' }} value={rotateAngle} onChange={(e) => setRotateAngle(parseFloat(e.target.value))} />
              <button style={{ marginLeft: '5px' }} onClick={handleRotate} disabled={!selectedId}>ROT Z</button>
            </div>
            <div style={{ marginBottom: '5px' }}>
              <label>SCL: </label><input type="number" step="0.1" style={{ width: '40px' }} value={scaleFactor} onChange={(e) => setScaleFactor(parseFloat(e.target.value))} />
              <button style={{ marginLeft: '5px' }} onClick={handleScale} disabled={!selectedId}>SCALE</button>
            </div>
          </div>
        </section>

        <section style={{ marginBottom: '20px' }}>
          <h3 style={{ fontSize: '0.8rem', color: '#888', marginBottom: '8px' }}>ADVANCED TOOLS</h3>
          <div style={{ fontSize: '0.7rem' }}>
            <div style={{ marginBottom: '5px' }}>
              <label>EXT: </label><input type="number" style={{ width: '40px' }} value={extrudeDepth} onChange={(e) => setExtrudeDepth(parseFloat(e.target.value))} />
              <button style={{ marginLeft: '5px' }} onClick={handleExtrude} disabled={!selectedId}>EXTRUDE</button>
            </div>
            <div style={{ marginBottom: '5px' }}>
              <label>FIL: </label><input type="number" style={{ width: '40px' }} value={filletRadius} onChange={(e) => setFilletRadius(parseFloat(e.target.value))} />
              <button style={{ marginLeft: '5px' }} onClick={handleFillet} disabled={!selectedId}>FILLET</button>
            </div>
            <div style={{ marginBottom: '5px' }}>
              <label>OFF: </label><input type="number" style={{ width: '40px' }} value={offsetDistance} onChange={(e) => setOffsetDistance(parseFloat(e.target.value))} />
              <button style={{ marginLeft: '5px' }} onClick={handleOffset} disabled={!selectedId}>OFFSET</button>
            </div>
          </div>
        </section>

        <section style={{ marginBottom: '20px' }}>
          <h3 style={{ fontSize: '0.8rem', color: '#888', marginBottom: '8px' }}>BOOLEAN / INTERACTION</h3>
          <div style={{ fontSize: '0.7rem' }}>
            <input type="text" placeholder="ID 1" style={{ width: '100%', marginBottom: '2px' }} value={id1} onChange={(e) => setId1(e.target.value)} />
            <input type="text" placeholder="ID 2" style={{ width: '100%', marginBottom: '5px' }} value={id2} onChange={(e) => setId2(e.target.value)} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px' }}>
              <button onClick={handleUnion}>UNION</button>
              <button onClick={handleSubtract}>SUB</button>
              <button onClick={handleTrim}>TRIM</button>
              <button onClick={handleExtend}>EXTEND</button>
            </div>
          </div>
        </section>

        <section style={{ marginBottom: '20px' }}>
          <h3 style={{ fontSize: '0.8rem', color: '#888', marginBottom: '8px' }}>VIEW</h3>
          <div style={{ marginBottom: '5px' }}>
            <label style={{ fontSize: '0.7rem' }}><input type="checkbox" checked={orthoMode} onChange={() => setOrthoMode(!orthoMode)} /> ORTHO</label>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '2px' }}>
            <button onClick={() => setViewMode('top')}>T</button>
            <button onClick={() => setViewMode('front')}>F</button>
            <button onClick={() => setViewMode('side')}>S</button>
            <button onClick={() => setViewMode('isometric')}>I</button>
          </div>
        </section>

        <section style={{ marginTop: '20px', borderTop: '1px solid #333', paddingTop: '15px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px', marginBottom: '10px' }}>
            <button onClick={undo}>UNDO</button>
            <button onClick={redo}>REDO</button>
          </div>
          <button style={{ width: '100%', background: '#27ae60', padding: '8px', border: 'none', color: 'white' }} onClick={exportToPDF}>EXPORT PNG</button>
        </section>

        <div style={{ marginTop: '15px', fontSize: '0.6rem', color: '#666' }}>
          <p>Selected: <span style={{ color: '#3498db' }}>{selectedId || 'NONE'}</span></p>
          <p>Objects: {objects.length}</p>
        </div>
      </div>
      
      <div ref={canvasRef} style={{ flexGrow: 1, position: 'relative' }}>
        <div style={{ position: 'absolute', top: '10px', right: '10px', background: 'rgba(0,0,0,0.7)', padding: '8px', borderRadius: '4px', fontSize: '0.7rem' }}>
          {drawingMode !== 'none' ? `DRAWING: ${drawingMode.toUpperCase()}` : 'SELECT MODE'}
        </div>
        {objects.map(obj => obj.id === selectedId && obj.dimensions && (
          <div key={`dim-${obj.id}`} style={{ position: 'absolute', bottom: '20px', left: '20px', background: 'rgba(52, 152, 219, 0.8)', padding: '5px 10px', borderRadius: '3px', fontSize: '0.8rem' }}>
            {obj.dimensions}
          </div>
        ))}
      </div>
    </div>
  );
};

export default App;
