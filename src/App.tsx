import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

// --- SYSTEM TYPES ---
export type ViewMode = 'top' | 'front' | 'side' | 'isometric';
export type ToolType = 
  | 'select' | 'pan' | 'move' | 'copy' | 'erase'
  | 'line' | 'polyline' | 'rectangle' | 'triangle' | 'circle'
  | 'extrude' | 'fillet' | 'chamfer' | 'union' | 'subtract';

export interface Point2D { x: number; y: number; }

export interface CADObject {
  id: string;
  type: string;
  points: Point2D[];
  color: string;
  is3D: boolean;
  extrusionHeight?: number;
  properties?: { radius?: number; [key: string]: any; };
}

export default function App() {
  // --- APPLICATION STATE ---
  const [objects, setObjects] = useState<CADObject[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [currentTool, setCurrentTool] = useState<ToolType>('line');
  const [viewMode, setViewMode] = useState<ViewMode>('top');
  const [hudFeedback, setHudFeedback] = useState<string>('System Initialized. Ready.');
  
  const [snapToGrid, setSnapToGrid] = useState<boolean>(false);
  const [orthoMode, setOrthoMode] = useState<boolean>(false);
  
  const [history, setHistory] = useState<CADObject[][]>([[]]);
  const [historyIndex, setHistoryIndex] = useState<number>(0);

  // --- THREE.JS ENGINE REFS ---
  const mountRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const previewLineRef = useRef<THREE.Line | null>(null);
  const objectsGroupRef = useRef<THREE.Group | null>(null);

  // --- INTERACTION REFS ---
  const isDrawing = useRef(false);
  const isPanning = useRef(false);
  const startPt = useRef<Point2D | null>(null);
  const currentPt = useRef<Point2D | null>(null);
  const panStart = useRef({ x: 0, y: 0 });
  const polylinePoints = useRef<Point2D[]>([]);
  
  const camOffset = useRef(new THREE.Vector3(0, 0, 0));
  const camZoom = useRef(1.0);

  // Sync state to ref for safe event listeners without closure staleness
  const state = useRef({ currentTool, objects, selectedId, orthoMode, snapToGrid, viewMode });
  useEffect(() => {
    state.current = { currentTool, objects, selectedId, orthoMode, snapToGrid, viewMode };
  }, [currentTool, objects, selectedId, orthoMode, snapToGrid, viewMode]);

  const generateId = () => Math.random().toString(36).substring(2, 9);

  // --- HISTORY MANAGEMENT ---
  const commitState = (newObjects: CADObject[]) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newObjects);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    setObjects(newObjects);
  };

  const undo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setObjects(history[historyIndex - 1]);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setObjects(history[historyIndex + 1]);
    }
  };

  // --- CAMERA CONTROLLER ---
  const updateCamera = () => {
    if (!cameraRef.current || !rendererRef.current || !sceneRef.current) return;
    const cam = cameraRef.current;
    const dist = 500 * camZoom.current;
    const off = camOffset.current;

    switch (state.current.viewMode) {
      case 'top': cam.position.set(off.x, dist, off.z + 0.1); break;
      case 'front': cam.position.set(off.x, off.y, dist); break;
      case 'side': cam.position.set(dist, off.y, off.z); break;
      case 'isometric': cam.position.set(off.x + dist*0.7, off.y + dist*0.7, off.z + dist*0.7); break;
    }
    
    cam.lookAt(off.x, off.y, off.z);
    cam.updateProjectionMatrix();
    rendererRef.current.render(sceneRef.current, cam);
  };

  useEffect(() => { updateCamera(); }, [viewMode]);

  // --- MATH & RAYCASTING ---
  const getWorkspaceCoord = (clientX: number, clientY: number): Point2D | null => {
    if (!mountRef.current || !cameraRef.current) return null;
    const rect = mountRef.current.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((clientY - rect.top) / rect.height) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(x, y), cameraRef.current);

    const planeNormal = new THREE.Vector3(0, 1, 0);
    if (state.current.viewMode === 'front') planeNormal.set(0, 0, 1);
    if (state.current.viewMode === 'side') planeNormal.set(1, 0, 0);

    const targetPlane = new THREE.Plane(planeNormal, 0);
    const intersect = new THREE.Vector3();

    if (raycaster.ray.intersectPlane(targetPlane, intersect)) {
      let finalX = intersect.x;
      let finalY = (state.current.viewMode === 'front' || state.current.viewMode === 'side') ? intersect.y : intersect.z;
      
      if (state.current.snapToGrid) {
        finalX = Math.round(finalX / 20) * 20;
        finalY = Math.round(finalY / 20) * 20;
      }
      return { x: finalX, y: finalY };
    }
    return null;
  };

  // --- EVENT HANDLERS (POINTER) ---
  const onPointerDown = (e: React.PointerEvent) => {
    const tool = state.current.currentTool;
    
    if (tool === 'pan' || e.button === 1 || e.button === 2) {
      isPanning.current = true;
      panStart.current = { x: e.clientX, y: e.clientY };
      return;
    }

    const coord = getWorkspaceCoord(e.clientX, e.clientY);
    if (!coord) return;

    if (['select', 'erase', 'extrude', 'fillet', 'chamfer'].includes(tool)) {
      const hit = state.current.objects.find(o => o.points.some(p => Math.abs(p.x - coord.x) < 15 && Math.abs(p.y - coord.y) < 15));
      if (hit) {
        setSelectedId(hit.id);
        if (tool === 'erase') {
          commitState(state.current.objects.filter(o => o.id !== hit.id));
          setSelectedId(null);
        }
      } else {
        setSelectedId(null);
      }
      return;
    }

    isDrawing.current = true;
    startPt.current = coord;
    currentPt.current = coord;

    if (tool === 'polyline') {
      if (polylinePoints.current.length === 0) polylinePoints.current.push(coord);
      startPt.current = polylinePoints.current[polylinePoints.current.length - 1];
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (isPanning.current) {
      const dx = e.clientX - panStart.current.x;
      const dy = e.clientY - panStart.current.y;
      panStart.current = { x: e.clientX, y: e.clientY };
      
      const speed = 0.5 * camZoom.current;
      if (state.current.viewMode === 'top') {
        camOffset.current.x -= dx * speed;
        camOffset.current.z -= dy * speed;
      } else {
        camOffset.current.x -= dx * speed;
        camOffset.current.y += dy * speed;
      }
      updateCamera();
      return;
    }

    if (!isDrawing.current || !startPt.current) return;

    let coord = getWorkspaceCoord(e.clientX, e.clientY);
    if (!coord) return;

    if (state.current.orthoMode) {
      const dx = Math.abs(coord.x - startPt.current.x);
      const dy = Math.abs(coord.y - startPt.current.y);
      coord = dx > dy ? { x: coord.x, y: startPt.current.y } : { x: startPt.current.x, y: coord.y };
    }

    currentPt.current = coord;

    // Render Preview
    if (previewLineRef.current && rendererRef.current && sceneRef.current && cameraRef.current) {
      const pts: THREE.Vector3[] = [];
      const origin = startPt.current;
      const dist = Math.hypot(coord.x - origin.x, coord.y - origin.y);
      const tool = state.current.currentTool;

      if (tool === 'line' || tool === 'polyline') {
        pts.push(new THREE.Vector3(origin.x, 0.5, origin.y), new THREE.Vector3(coord.x, 0.5, coord.y));
      } else if (tool === 'rectangle') {
        pts.push(
          new THREE.Vector3(origin.x, 0.5, origin.y), new THREE.Vector3(coord.x, 0.5, origin.y),
          new THREE.Vector3(coord.x, 0.5, coord.y), new THREE.Vector3(origin.x, 0.5, coord.y),
          new THREE.Vector3(origin.x, 0.5, origin.y)
        );
      } else if (tool === 'circle' || tool === 'triangle') {
        const segments = tool === 'circle' ? 64 : 3;
        for (let i = 0; i <= segments; i++) {
          const angle = (i / segments) * Math.PI * 2;
          pts.push(new THREE.Vector3(origin.x + Math.cos(angle)*dist, 0.5, origin.y + Math.sin(angle)*dist));
        }
      }

      previewLineRef.current.geometry.setFromPoints(pts);
      rendererRef.current.render(sceneRef.current, cameraRef.current);
    }
  };

  const onPointerUp = () => {
    isPanning.current = false;
    
    if (!isDrawing.current || !startPt.current || !currentPt.current) {
      isDrawing.current = false;
      return;
    }

    isDrawing.current = false;
    const origin = startPt.current;
    const end = currentPt.current;
    const dist = Math.hypot(end.x - origin.x, end.y - origin.y);

    if (dist > 1) {
      const tool = state.current.currentTool;
      let newObj: CADObject | null = null;

      if (tool === 'line') {
        newObj = { id: generateId(), type: 'line', points: [origin, end], color: '#3b82f6', is3D: false };
      } else if (tool === 'polyline') {
        polylinePoints.current.push(end);
        setObjects(prev => [...prev.filter(o => o.id !== 'temp_pline'), { id: 'temp_pline', type: 'polyline', points: [...polylinePoints.current], color: '#38bdf8', is3D: false }]);
        return; 
      } else if (tool === 'rectangle') {
        newObj = { id: generateId(), type: 'rectangle', points: [origin, {x: end.x, y: origin.y}, end, {x: origin.x, y: end.y}], color: '#10b981', is3D: false };
      } else if (tool === 'triangle' || tool === 'circle') {
        const segments = tool === 'circle' ? 64 : 3;
        const pts: Point2D[] = [];
        for (let i = 0; i < segments; i++) {
          const angle = (i / segments) * Math.PI * 2;
          pts.push({ x: origin.x + Math.cos(angle)*dist, y: origin.y + Math.sin(angle)*dist });
        }
        newObj = { id: generateId(), type: tool, points: pts, color: tool === 'circle' ? '#a855f7' : '#f59e0b', is3D: false, properties: { radius: dist } };
      }

      if (newObj) {
        commitState([...state.current.objects.filter(o => o.id !== 'temp_pline'), newObj]);
        setHudFeedback(`${newObj.type.toUpperCase()} created.`);
      }
    }

    startPt.current = null; currentPt.current = null;
    if (previewLineRef.current) previewLineRef.current.geometry.setFromPoints([]);
    updateCamera();
  };

  // Safe pan/zoom via wheel
  const onWheel = (e: React.WheelEvent) => {
    camZoom.current = Math.max(0.1, Math.min(5, camZoom.current + e.deltaY * 0.001));
    updateCamera();
  };

  // --- ENGINE SETUP (RUNS ONCE) ---
  useEffect(() => {
    if (!mountRef.current) return;
    
    const w = mountRef.current.clientWidth;
    const h = mountRef.current.clientHeight;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: false }); // preserveDrawingBuffer: false prevents crashes on mobile
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0f1d);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, w / h, 1, 10000);
    cameraRef.current = camera;

    scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.5);
    dirLight.position.set(100, 500, 100);
    scene.add(dirLight);

    const grid = new THREE.GridHelper(1000, 50, 0x4f46e5, 0x111827);
    scene.add(grid);

    const previewMat = new THREE.LineBasicMaterial({ color: 0xf43f5e, linewidth: 2, depthTest: false });
    const previewLine = new THREE.Line(new THREE.BufferGeometry(), previewMat);
    previewLine.renderOrder = 999;
    scene.add(previewLine);
    previewLineRef.current = previewLine;

    const objGroup = new THREE.Group();
    scene.add(objGroup);
    objectsGroupRef.current = objGroup;

    updateCamera();

    const handleResize = () => {
      if (!mountRef.current || !cameraRef.current || !rendererRef.current) return;
      const nw = mountRef.current.clientWidth;
      const nh = mountRef.current.clientHeight;
      cameraRef.current.aspect = nw / nh;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(nw, nh);
      updateCamera();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      mountRef.current?.removeChild(renderer.domElement);
    };
  }, []);

  // --- RE-RENDER COMMITTED OBJECTS ONLY ---
  useEffect(() => {
    if (!objectsGroupRef.current || !rendererRef.current || !sceneRef.current || !cameraRef.current) return;
    
    objectsGroupRef.current.clear(); // Safe clear of just the objects, not the whole scene

    objects.forEach(obj => {
      if (!obj.points || obj.points.length < 2) return;
      const color = obj.id === selectedId ? 0xf43f5e : new THREE.Color(obj.color).getHex();
      
      if (obj.is3D && obj.extrusionHeight) {
        const shape = new THREE.Shape();
        shape.moveTo(obj.points[0].x, obj.points[0].y);
        for(let i=1; i<obj.points.length; i++) shape.lineTo(obj.points[i].x, obj.points[i].y);
        if (obj.type !== 'line') shape.lineTo(obj.points[0].x, obj.points[0].y);

        const geo = new THREE.ExtrudeGeometry(shape, { depth: obj.extrusionHeight, bevelEnabled: false });
        geo.rotateX(-Math.PI/2);
        const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide }));
        objectsGroupRef.current!.add(mesh);
      } else {
        const pts = obj.points.map(p => new THREE.Vector3(p.x, 0.1, p.y));
        if (obj.type !== 'line' && obj.type !== 'polyline') pts.push(pts[0].clone());
        const geo = new THREE.BufferGeometry().setFromPoints(pts);
        const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color, depthTest: false }));
        objectsGroupRef.current!.add(line);
      }
    });
    rendererRef.current.render(sceneRef.current, cameraRef.current);
  }, [objects, selectedId]);

  return (
    <div className="fixed inset-0 w-full h-full flex flex-col bg-slate-900 text-slate-100 overflow-hidden select-none touch-none">
      
      {/* HEADER */}
      <header className="h-12 flex items-center justify-between px-2 bg-slate-950 border-b border-slate-800 shrink-0">
        <span className="font-bold text-xs text-indigo-400">PRO_CAD</span>
        <div className="flex gap-1">
          <button onClick={() => { setObjects([]); setHistory([[]]); setHistoryIndex(0); }} className="px-2 py-1 text-[10px] bg-slate-800 rounded">NEW</button>
          <button onClick={() => window.print()} className="px-2 py-1 text-[10px] bg-emerald-600 rounded">PDF</button>
          <button onClick={undo} className="px-2 py-1 text-[10px] bg-slate-800 rounded">UNDO</button>
          <button onClick={redo} className="px-2 py-1 text-[10px] bg-slate-800 rounded">REDO</button>
          <label className="text-[10px] flex items-center gap-1 bg-slate-800 px-1 rounded"><input type="checkbox" checked={snapToGrid} onChange={e => setSnapToGrid(e.target.checked)}/> SNAP</label>
        </div>
      </header>

      {/* MAIN LAYOUT */}
      <div className="flex-1 flex flex-col relative w-full h-full touch-none">
        
        {/* RENDERER - explicitly locking touch actions so Android doesn't swallow pointerup */}
        <div 
          ref={mountRef} 
          className="absolute inset-0 w-full h-full bg-black touch-none"
          style={{ touchAction: 'none' }} 
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp} 
          onPointerOut={onPointerUp} 
          onWheel={onWheel}
        />

        {/* BOTTOM TOOLBAR */}
        <div className="absolute bottom-6 left-2 right-2 bg-slate-900/90 backdrop-blur border border-slate-700 p-2 rounded-lg flex flex-wrap gap-1 max-h-48 overflow-y-auto">
           {(['select', 'pan', 'line', 'polyline', 'rectangle', 'triangle', 'circle', 'erase', 'extrude'] as ToolType[]).map(t => (
            <button key={t} onClick={() => {
              if (t !== 'polyline') { polylinePoints.current = []; setObjects(p => p.filter(o=>o.id !== 'temp_pline')); }
              setCurrentTool(t);
            }} className={`px-2 py-1 text-[10px] font-bold rounded uppercase ${currentTool === t ? 'bg-indigo-600' : 'bg-slate-800'}`}>
              {t}
            </button>
          ))}
          {currentTool === 'polyline' && (
            <button onClick={() => { 
                if(polylinePoints.current.length > 1) commitState([...state.current.objects.filter(o=>o.id !== 'temp_pline'), {id: generateId(), type: 'polyline', points: [...polylinePoints.current], color: '#06b6d4', is3D: false}]); 
                polylinePoints.current = []; setCurrentTool('select'); 
            }} className="px-2 py-1 text-[10px] bg-cyan-600 rounded uppercase">FINISH PATH</button>
          )}
          <div className="w-full h-px bg-slate-700 my-1"/>
          {(['top', 'front', 'side', 'isometric'] as ViewMode[]).map(v => (
            <button key={v} onClick={() => setViewMode(v)} className={`px-2 py-1 text-[10px] rounded uppercase ${viewMode === v ? 'bg-amber-600' : 'bg-slate-800'}`}>{v}</button>
          ))}
        </div>
        
        {/* STATUS FOOTER */}
        <div className="absolute bottom-0 left-0 right-0 bg-slate-950 px-2 py-1 text-[9px] text-slate-400 flex justify-between">
          <span>{hudFeedback}</span>
          <span>{currentTool.toUpperCase()} | NODES: {objects.length}</span>
        </div>
      </div>
    </div>
  );
}
