import React, { useEffect, useState, useCallback } from 'react';
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
    selectObject,
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
  const [filletRadius, setFilletRadius] = useState<number>(5);
  const [offsetDistance, setOffsetDistance] = useState<number>(5);
  const [rotateAngle, setRotateAngle] = useState<number>(Math.PI / 4);
  const [scaleFactor, setScaleFactor] = useState<number>(1.5);
  const [objectId1, setObjectId1] = useState<string>('');
  const [objectId2, setObjectId2] = useState<string>('');

  useEffect(() => {
    if (objects.length > 0 && !selectedId) {
      selectObject(objects[0].id);
    }
  }, [objects, selectedId, selectObject]);

  const handleMoveObject = useCallback(() => {
    if (selectedId) moveObject(selectedId, new THREE.Vector3(10, 0, 0));
  }, [selectedId, moveObject]);

  const handleCopyObject = useCallback(() => {
    if (selectedId) copyObject(selectedId);
  }, [selectedId, copyObject]);

  const handleExtrude = useCallback(() => {
    if (selectedId) executeExtrude(selectedId, extrudeDepth);
  }, [selectedId, extrudeDepth, executeExtrude]);

  const handleFillet = useCallback(() => {
    if (selectedId) executeFillet(selectedId, filletRadius);
  }, [selectedId, filletRadius, executeFillet]);

  const handleTrim = useCallback(() => {
    if (objectId1 && objectId2) executeTrim(objectId1, objectId2);
  }, [objectId1, objectId2, executeTrim]);

  const handleExtend = useCallback(() => {
    if (objectId1 && objectId2) executeExtend(objectId1, objectId2);
  }, [objectId1, objectId2, executeExtend]);

  const handleRotate = useCallback(() => {
    if (selectedId) executeRotate(selectedId, new THREE.Vector3(0, 0, 1), rotateAngle);
  }, [selectedId, rotateAngle, executeRotate]);

  const handleOffset = useCallback(() => {
    if (selectedId) executeOffset(selectedId, offsetDistance);
  }, [selectedId, offsetDistance, executeOffset]);

  const handleScale = useCallback(() => {
    if (selectedId) executeScale(selectedId, new THREE.Vector3(scaleFactor, scaleFactor, scaleFactor));
  }, [selectedId, scaleFactor, executeScale]);

  const handleUnion = useCallback(() => {
    if (objectId1 && objectId2) executeUnion(objectId1, objectId2);
  }, [objectId1, objectId2, executeUnion]);

  const handleSubtract = useCallback(() => {
    if (objectId1 && objectId2) executeSubtract(objectId1, objectId2);
  }, [objectId1, objectId2, executeSubtract]);

  const handleErase = useCallback(() => {
    if (selectedId) executeErase(selectedId);
  }, [selectedId, executeErase]);

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden', fontFamily: 'sans-serif' }}>
      <div style={{ width: '260px', background: '#2c3e50', color: 'white', padding: '15px', borderRight: '1px solid #1a252f', overflowY: 'auto' }}>
        <h2 style={{ fontSize: '1.2rem', marginBottom: '20px' }}>CAD Controls</h2>
        
        <section style={{ marginBottom: '20px' }}>
          <h4 style={{ borderBottom: '1px solid #34495e', paddingBottom: '5px' }}>Drawing</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px' }}>
            <button style={{ background: drawingMode === 'line' ? '#3498db' : '' }} onClick={() => setDrawingMode('line')}>Line</button>
            <button style={{ background: drawingMode === 'polyline' ? '#3498db' : '' }} onClick={() => setDrawingMode('polyline')}>Poly</button>
            <button style={{ background: drawingMode === 'rectangle' ? '#3498db' : '' }} onClick={() => setDrawingMode('rectangle')}>Rect</button>
            <button style={{ background: drawingMode === 'circle' ? '#3498db' : '' }} onClick={() => setDrawingMode('circle')}>Circle</button>
            <button style={{ gridColumn: 'span 2', background: drawingMode === 'none' ? '#e74c3c' : '' }} onClick={() => setDrawingMode('none')}>Cancel</button>
          </div>
        </section>

        <section style={{ marginBottom: '20px' }}>
          <h4 style={{ borderBottom: '1px solid #34495e', paddingBottom: '5px' }}>Transform</h4>
          <div style={{ fontSize: '0.8rem' }}>
            <div style={{ marginBottom: '5px' }}>
              <label>Extrude: </label>
              <input type="number" style={{ width: '40px' }} value={extrudeDepth} onChange={(e) => setExtrudeDepth(parseFloat(e.target.value))} />
              <button onClick={handleExtrude} disabled={!selectedId}>OK</button>
            </div>
            <div style={{ marginBottom: '5px' }}>
              <label>Fillet: </label>
              <input type="number" style={{ width: '40px' }} value={filletRadius} onChange={(e) => setFilletRadius(parseFloat(e.target.value))} />
              <button onClick={handleFillet} disabled={!selectedId}>OK</button>
            </div>
            <div style={{ marginBottom: '5px' }}>
              <label>Rotate: </label>
              <input type="number" style={{ width: '40px' }} value={rotateAngle} onChange={(e) => setRotateAngle(parseFloat(e.target.value))} />
              <button onClick={handleRotate} disabled={!selectedId}>OK</button>
            </div>
            <div style={{ marginBottom: '5px' }}>
              <label>Offset: </label>
              <input type="number" style={{ width: '40px' }} value={offsetDistance} onChange={(e) => setOffsetDistance(parseFloat(e.target.value))} />
              <button onClick={handleOffset} disabled={!selectedId}>OK</button>
            </div>
            <div style={{ marginBottom: '5px' }}>
              <label>Scale: </label>
              <input type="number" style={{ width: '40px' }} value={scaleFactor} onChange={(e) => setScaleFactor(parseFloat(e.target.value))} />
              <button onClick={handleScale} disabled={!selectedId}>OK</button>
            </div>
          </div>
        </section>

        <section style={{ marginBottom: '20px' }}>
          <h4 style={{ borderBottom: '1px solid #34495e', paddingBottom: '5px' }}>Edit</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px' }}>
            <button onClick={handleMoveObject} disabled={!selectedId}>Move</button>
            <button onClick={handleCopyObject} disabled={!selectedId}>Copy</button>
            <button style={{ gridColumn: 'span 2', background: '#e74c3c' }} onClick={handleErase} disabled={!selectedId}>Erase</button>
          </div>
        </section>

        <section style={{ marginBottom: '20px' }}>
          <h4 style={{ borderBottom: '1px solid #34495e', paddingBottom: '5px' }}>Boolean</h4>
          <input type="text" placeholder="ID 1" style={{ width: '100%', marginBottom: '2px' }} value={objectId1} onChange={(e) => setObjectId1(e.target.value)} />
          <input type="text" placeholder="ID 2" style={{ width: '100%', marginBottom: '5px' }} value={objectId2} onChange={(e) => setObjectId2(e.target.value)} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px' }}>
            <button onClick={handleUnion}>Union</button>
            <button onClick={handleSubtract}>Sub</button>
            <button onClick={handleTrim}>Trim</button>
            <button onClick={handleExtend}>Ext</button>
          </div>
        </section>

        <section style={{ marginBottom: '20px' }}>
          <h4 style={{ borderBottom: '1px solid #34495e', paddingBottom: '5px' }}>View</h4>
          <div style={{ marginBottom: '5px' }}>
            <label style={{ fontSize: '0.8rem' }}><input type="checkbox" checked={orthoMode} onChange={() => setOrthoMode(!orthoMode)} /> Ortho</label>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '2px' }}>
            <button onClick={() => setViewMode('top')} disabled={viewMode === 'top'}>T</button>
            <button onClick={() => setViewMode('front')} disabled={viewMode === 'front'}>F</button>
            <button onClick={() => setViewMode('side')} disabled={viewMode === 'side'}>S</button>
            <button onClick={() => setViewMode('isometric')} disabled={viewMode === 'isometric'}>I</button>
          </div>
        </section>

        <section>
          <button style={{ width: '100%', marginBottom: '5px' }} onClick={undo}>Undo</button>
          <button style={{ width: '100%', marginBottom: '5px' }} onClick={redo}>Redo</button>
          <button style={{ width: '100%', background: '#27ae60' }} onClick={exportToPDF}>Export PNG</button>
        </section>
      </div>
      <div ref={canvasRef} style={{ flexGrow: 1, background: '#000', cursor: 'crosshair' }} />
    </div>
  );
};

export default App;
