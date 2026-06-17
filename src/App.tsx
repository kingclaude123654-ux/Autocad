import React, { useEffect, useState } from 'react';
import { useCADEngine } from './hooks/useCADEngine';

import * as THREE from 'three';

const App: React.FC = () => {
  const { 
    canvasRef, 
    objects, 
    selectedId, 
    viewMode, 
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

  // State for drawing tool parameters (example)
  const [lineStart, setLineStart] = useState<THREE.Vector3 | null>(null);
  const [lineEnd, setLineEnd] = useState<THREE.Vector3 | null>(null);
  const [extrudeDepth, setExtrudeDepth] = useState<number>(10);
  const [filletRadius, setFilletRadius] = useState<number>(5);
  const [offsetDistance, setOffsetDistance] = useState<number>(5);
  const [rotateAngle, setRotateAngle] = useState<number>(Math.PI / 4); // 45 degrees
  const [scaleFactor, setScaleFactor] = useState<number>(1.5);

  // Dummy IDs for operations requiring two objects
  const [objectId1, setObjectId1] = useState<string>('');
  const [objectId2, setObjectId2] = useState<string>('');

  useEffect(() => {
    // Example: automatically select the first object if available
    if (objects.length > 0 && !selectedId) {
      selectObject(objects[0].id);
    }
  }, [objects, selectedId, selectObject]);

  const handleDrawLine = () => {
    if (lineStart && lineEnd) {
      drawLine(lineStart, lineEnd);
      setLineStart(null);
      setLineEnd(null);
    } else {
      // For demonstration, use dummy points
      const start = new THREE.Vector3(Math.random() * 50 - 25, Math.random() * 50 - 25, 0);
      const end = new THREE.Vector3(Math.random() * 50 - 25, Math.random() * 50 - 25, 0);
      drawLine(start, end);
    }
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
    if (selectedId) {
      executeExtrude(selectedId, extrudeDepth);
    }
  };

  const handleFillet = () => {
    if (selectedId) {
      executeFillet(selectedId, filletRadius);
    }
  };

  const handleTrim = () => {
    if (objectId1 && objectId2) {
      executeTrim(objectId1, objectId2);
    }
  };

  const handleExtend = () => {
    if (objectId1 && objectId2) {
      executeExtend(objectId1, objectId2);
    }
  };

  const handleRotate = () => {
    if (selectedId) {
      const axis = new THREE.Vector3(0, 0, 1); // Rotate around Z-axis
      executeRotate(selectedId, axis, rotateAngle);
    }
  };

  const handleOffset = () => {
    if (selectedId) {
      executeOffset(selectedId, offsetDistance);
    }
  };

  const handleScale = () => {
    if (selectedId) {
      executeScale(selectedId, new THREE.Vector3(scaleFactor, scaleFactor, scaleFactor));
    }
  };

  const handleUnion = () => {
    if (objectId1 && objectId2) {
      executeUnion(objectId1, objectId2);
    }
  };

  const handleSubtract = () => {
    if (objectId1 && objectId2) {
      executeSubtract(objectId1, objectId2);
    }
  };

  const handleErase = () => {
    if (selectedId) {
      executeErase(selectedId);
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden' }}>
      <div style={{ width: '200px', background: '#f0f0f0', padding: '10px', borderRight: '1px solid #ccc', overflowY: 'auto' }}>
        <h3>CAD Tools</h3>
        <div>
          <button onClick={handleDrawLine}>Draw Line</button>
          <button onClick={handleDrawPolyline}>Draw Polyline</button>
          <button onClick={handleDrawRectangle}>Draw Rectangle</button>
          <button onClick={handleDrawCircle}>Draw Circle</button>
        </div>
        <hr />
        <h3>Selection & Manipulation</h3>
        <div>
          <button onClick={() => selectObject(null)}>Deselect</button>
          <button onClick={handleMoveObject} disabled={!selectedId}>Move Selected</button>
          <p>Selected: {selectedId || 'None'}</p>
          <p>Objects:</p>
          <ul>
            {objects.map((obj: { id: string; type: string; }) => (
              <li key={obj.id} onClick={() => selectObject(obj.id)} style={{ cursor: 'pointer', fontWeight: obj.id === selectedId ? 'bold' : 'normal' }}>
                {obj.type} - {obj.id.substring(0, 8)}
              </li>
            ))}
          </ul>
        </div>
        <hr />
        <h3>Transformations</h3>
        <div>
          <label>Extrude Depth: </label>
          <input type="number" value={extrudeDepth} onChange={(e) => setExtrudeDepth(parseFloat(e.target.value))} />
          <button onClick={handleExtrude} disabled={!selectedId}>Extrude</button>
        </div>
        <div>
          <label>Fillet Radius: </label>
          <input type="number" value={filletRadius} onChange={(e) => setFilletRadius(parseFloat(e.target.value))} />
          <button onClick={handleFillet} disabled={!selectedId}>Fillet</button>
        </div>
        <div>
          <label>Rotate Angle (rad): </label>
          <input type="number" value={rotateAngle} onChange={(e) => setRotateAngle(parseFloat(e.target.value))} />
          <button onClick={handleRotate} disabled={!selectedId}>Rotate</button>
        </div>
        <div>
          <label>Offset Distance: </label>
          <input type="number" value={offsetDistance} onChange={(e) => setOffsetDistance(parseFloat(e.target.value))} />
          <button onClick={handleOffset} disabled={!selectedId}>Offset</button>
        </div>
        <div>
          <label>Scale Factor: </label>
          <input type="number" value={scaleFactor} onChange={(e) => setScaleFactor(parseFloat(e.target.value))} />
          <button onClick={handleScale} disabled={!selectedId}>Scale</button>
        </div>
        <div>
          <label>Object 1 ID: </label>
          <input type="text" value={objectId1} onChange={(e) => setObjectId1(e.target.value)} />
          <label>Object 2 ID: </label>
          <input type="text" value={objectId2} onChange={(e) => setObjectId2(e.target.value)} />
          <button onClick={handleTrim} disabled={!objectId1 || !objectId2}>Trim</button>
          <button onClick={handleExtend} disabled={!objectId1 || !objectId2}>Extend</button>
          <button onClick={handleUnion} disabled={!objectId1 || !objectId2}>Union</button>
          <button onClick={handleSubtract} disabled={!objectId1 || !objectId2}>Subtract</button>
        </div>
        <div>
          <button onClick={handleErase} disabled={!selectedId}>Erase Selected</button>
        </div>
        <hr />
        <h3>View Controls</h3>
        <div>
          <label>
            <input type="checkbox" checked={orthoMode} onChange={() => setOrthoMode(!orthoMode)} />
            Orthographic View
          </label>
        </div>
        <div>
          <button onClick={() => setViewMode('top')} disabled={viewMode === 'top'}>Top View</button>
          <button onClick={() => setViewMode('front')} disabled={viewMode === 'front'}>Front View</button>
          <button onClick={() => setViewMode('side')} disabled={viewMode === 'side'}>Side View</button>
          <button onClick={() => setViewMode('isometric')} disabled={viewMode === 'isometric'}>Isometric View</button>
        </div>
        <hr />
        <h3>History</h3>
        <div>
          <button onClick={undo}>Undo</button>
          <button onClick={redo}>Redo</button>
        </div>
      </div>
      <div ref={canvasRef} style={{ flexGrow: 1, background: '#eee' }}>
        {/* Three.js canvas will be appended here by the hook */}
      </div>
    </div>
  );
};

export default App;
