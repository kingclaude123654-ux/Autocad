import React, { useEffect, useState } from 'react';
import { useCADEngine } from './hooks/useCADEngine';
import * as THREE from 'three';

const App: React.FC = () => {
  const { 
    canvasRef, 
    objects, 
    selectedId, 
    orthoMode, 
    setOrthoMode, 
    setViewMode, 
    drawLine, 
    drawPolyline, 
    drawRectangle, 
    drawCircle, 
    selectObject, 
    moveObject, 
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
    redo 
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

  const handleDrawLine = () => {
    const start = new THREE.Vector3(Math.random() * 50 - 25, Math.random() * 50 - 25, 0);
    const end = new THREE.Vector3(Math.random() * 50 - 25, Math.random() * 50 - 25, 0);
    drawLine(start, end);
  };

  const handleDrawPolyline = () => {
    const points = [
      new THREE.Vector3(Math.random() * 50 - 25, Math.random() * 50 - 25, 0),
      new THREE.Vector3(Math.random() * 50 - 25, Math.random() * 50 - 25, 0),
      new THREE.Vector3(Math.random() * 50 - 25, Math.random() * 50 - 25, 0),
    ];
    drawPolyline(points);
  };

  const handleDrawRectangle = () => {
    const p1 = new THREE.Vector3(Math.random() * 50 - 25, Math.random() * 50 - 25, 0);
    const p2 = new THREE.Vector3(p1.x + 20, p1.y + 15, 0);
    drawRectangle(p1, p2);
  };

  const handleDrawCircle = () => {
    const center = new THREE.Vector3(Math.random() * 50 - 25, Math.random() * 50 - 25, 0);
    const radius = Math.random() * 10 + 5;
    drawCircle(center, radius);
  };

  const handleMoveObject = () => {
    if (selectedId) {
      const delta = new THREE.Vector3(Math.random() * 10 - 5, Math.random() * 10 - 5, 0);
      moveObject(selectedId, delta);
    }
  };

  const handleExtrude = () => {
    if (selectedId) executeExtrude(selectedId, extrudeDepth);
  };

  const handleFillet = () => {
    if (selectedId) executeFillet(selectedId, filletRadius);
  };

  const handleTrim = () => {
    if (objectId1 && objectId2) executeTrim(objectId1, objectId2);
  };

  const handleExtend = () => {
    if (objectId1 && objectId2) executeExtend(objectId1, objectId2);
  };

  const handleRotate = () => {
    if (selectedId) {
      const axis = new THREE.Vector3(0, 0, 1);
      executeRotate(selectedId, axis, rotateAngle);
    }
  };

  const handleOffset = () => {
    if (selectedId) executeOffset(selectedId, offsetDistance);
  };

  const handleScale = () => {
    if (selectedId) {
      executeScale(selectedId, new THREE.Vector3(scaleFactor, scaleFactor, scaleFactor));
    }
  };

  const handleUnion = () => {
    if (objectId1 && objectId2) executeUnion(objectId1, objectId2);
  };

  const handleSubtract = () => {
    if (objectId1 && objectId2) executeSubtract(objectId1, objectId2);
  };

  const handleErase = () => {
    if (selectedId) executeErase(selectedId);
  };

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden', fontFamily: 'sans-serif' }}>
      <div style={{ width: '260px', background: '#2c3e50', color: 'white', padding: '15px', borderRight: '1px solid #1a252f', overflowY: 'auto' }}>
        <h2 style={{ fontSize: '1.2rem', marginBottom: '20px' }}>CAD Controls</h2>
        
        <section style={{ marginBottom: '20px' }}>
          <h4 style={{ borderBottom: '1px solid #34495e', paddingBottom: '5px' }}>Drawing Tools</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px' }}>
            <button onClick={handleDrawLine}>Line</button>
            <button onClick={handleDrawPolyline}>Polyline</button>
            <button onClick={handleDrawRectangle}>Rect</button>
            <button onClick={handleDrawCircle}>Circle</button>
          </div>
        </section>

        <section style={{ marginBottom: '20px' }}>
          <h4 style={{ borderBottom: '1px solid #34495e', paddingBottom: '5px' }}>Transform</h4>
          <div style={{ fontSize: '0.8rem' }}>
            <div style={{ marginBottom: '5px' }}>
              <label>Extrude: </label>
              <input type="number" style={{ width: '50px' }} value={extrudeDepth} onChange={(e) => setExtrudeDepth(parseFloat(e.target.value))} />
              <button onClick={handleExtrude} disabled={!selectedId}>Apply</button>
            </div>
            <div style={{ marginBottom: '5px' }}>
              <label>Fillet: </label>
              <input type="number" style={{ width: '50px' }} value={filletRadius} onChange={(e) => setFilletRadius(parseFloat(e.target.value))} />
              <button onClick={handleFillet} disabled={!selectedId}>Apply</button>
            </div>
            <div style={{ marginBottom: '5px' }}>
              <label>Rotate: </label>
              <input type="number" style={{ width: '50px' }} value={rotateAngle} onChange={(e) => setRotateAngle(parseFloat(e.target.value))} />
              <button onClick={handleRotate} disabled={!selectedId}>Apply</button>
            </div>
            <div style={{ marginBottom: '5px' }}>
              <label>Offset: </label>
              <input type="number" style={{ width: '50px' }} value={offsetDistance} onChange={(e) => setOffsetDistance(parseFloat(e.target.value))} />
              <button onClick={handleOffset} disabled={!selectedId}>Apply</button>
            </div>
            <div style={{ marginBottom: '5px' }}>
              <label>Scale: </label>
              <input type="number" style={{ width: '50px' }} value={scaleFactor} onChange={(e) => setScaleFactor(parseFloat(e.target.value))} />
              <button onClick={handleScale} disabled={!selectedId}>Apply</button>
            </div>
          </div>
        </section>

        <section style={{ marginBottom: '20px' }}>
          <h4 style={{ borderBottom: '1px solid #34495e', paddingBottom: '5px' }}>Boolean Ops</h4>
          <div style={{ fontSize: '0.8rem' }}>
            <input type="text" placeholder="Obj ID 1" style={{ width: '100%', marginBottom: '5px' }} value={objectId1} onChange={(e) => setObjectId1(e.target.value)} />
            <input type="text" placeholder="Obj ID 2" style={{ width: '100%', marginBottom: '5px' }} value={objectId2} onChange={(e) => setObjectId2(e.target.value)} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px' }}>
              <button onClick={handleUnion}>Union</button>
              <button onClick={handleSubtract}>Subtract</button>
              <button onClick={handleTrim}>Trim</button>
              <button onClick={handleExtend}>Extend</button>
            </div>
          </div>
        </section>

        <section style={{ marginBottom: '20px' }}>
          <h4 style={{ borderBottom: '1px solid #34495e', paddingBottom: '5px' }}>Selection</h4>
          <button style={{ width: '100%', marginBottom: '5px' }} onClick={handleMoveObject} disabled={!selectedId}>Move Selected</button>
          <button style={{ width: '100%', background: '#e74c3c' }} onClick={handleErase} disabled={!selectedId}>Erase</button>
          <p style={{ fontSize: '0.8rem', marginTop: '10px' }}>Selected: {selectedId ? selectedId.substring(0, 12) : 'None'}</p>
        </section>

        <section style={{ marginBottom: '20px' }}>
          <h4 style={{ borderBottom: '1px solid #34495e', paddingBottom: '5px' }}>View</h4>
          <div style={{ marginBottom: '10px' }}>
            <label style={{ fontSize: '0.9rem' }}>
              <input type="checkbox" checked={orthoMode} onChange={() => setOrthoMode(!orthoMode)} /> Orthographic
            </label>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px' }}>
            <button onClick={() => setViewMode('top')}>Top</button>
            <button onClick={() => setViewMode('front')}>Front</button>
            <button onClick={() => setViewMode('side')}>Side</button>
            <button onClick={() => setViewMode('isometric')}>Iso</button>
          </div>
        </section>

        <section>
          <h4 style={{ borderBottom: '1px solid #34495e', paddingBottom: '5px' }}>History</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px' }}>
            <button onClick={undo}>Undo</button>
            <button onClick={redo}>Redo</button>
          </div>
        </section>
      </div>
      
      <div ref={canvasRef} style={{ flexGrow: 1, background: '#000', cursor: 'crosshair' }} />
    </div>
  );
};

export default App;