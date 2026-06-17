import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

// --- TYPE CONTEXT MATRIX ---
export type ViewMode = 'top' | 'front' | 'side' | 'isometric';
export type ToolType = 'select' | 'pan' | 'move' | 'copy' | 'line' | 'polyline' | 'rectangle' | 'polygon' | 'circle';

export interface Point2D {
  x: number;
  y: number;
}

export interface CADObject {
  id: string;
  type: string;
  points: Point2D[];
  color: string;
  layer: string;
  is3D: boolean;
  extrusionHeight?: number;
  properties?: Record<string, any>;
}

export default function App() {
  // --- CORE ENGINE STATES ---
  const [objects, setObjects] = useState<CADObject[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [currentTool, setCurrentTool] = useState<ToolType>('line');
  const [viewMode, setViewMode] = useState<ViewMode>('top');
  const [isDarkMode] = useState<boolean>(true); // Locked dark mode canvas setup
  const [hudFeedback, setHudFeedback] = useState<string>('System Active. Select tool to begin drafting.');

  // Workspace Configurations
  const [unit] = useState<string>('mm');
  const [snapToGrid, setSnapToGrid] = useState<boolean>(false);
  const [orthoMode, setOrthoMode] = useState<boolean>(false);
  const workspaceSize = 500;
  const gridSpacing = 10;

  // Global Time-Travel History Management (Undo / Redo)
  const [history, setHistory] = useState<CADObject[][]>([[]]);
  const [historyIndex, setHistoryIndex] = useState<number>(0);

  // --- CORE THREE.JS PIPELINE REFERENCES ---
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<THREE.Scene>(new THREE.Scene());
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const visualObjectsRef = useRef<Map<string, THREE.Object3D>>(new Map());
  const previewLineRef = useRef<THREE.Line | null>(null);

  // Real-Time Interaction Trackers
  const isDrawingRef = useRef<boolean>(false);
  const startPointRef = useRef<Point2D | null>(null);
  const currentPointRef = useRef<Point2D | null>(null);
  const chainAnchorRef = useRef<Point2D | null>(null);
  const moveStartPointRef = useRef<Point2D | null>(null);
  const polylinePointsRef = useRef<Point2D[]>([]);
  const isCopyingRef = useRef<boolean>(false);

  // Camera Matrix Navigation Metrics
  const cameraOffsetRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 0));
  const cameraZoomRef = useRef<number>(1.2);
  const isPanningRef = useRef<boolean>(false);
  const panStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Thread-Safe Synchronization State Mirror
  const stateRef = useRef({
    currentTool,
    objects,
    selectedId,
    orthoMode,
    snapToGrid,
    viewMode,
    gridSpacing,
    unit,
    workspaceSize
  });

  useEffect(() => {
    stateRef.current = {
      currentTool,
      objects,
      selectedId,
      orthoMode,
      snapToGrid,
      viewMode,
      gridSpacing,
      unit,
      workspaceSize
    };
  }, [currentTool, objects, selectedId, orthoMode, snapToGrid, viewMode, unit]);

  const generateId = () => Math.random().toString(36).substring(2, 9);

  // --- ENGINE CAMERA CONTROLLER ---
  const syncCameraMatrix = (forcedMode?: ViewMode) => {
    if (!cameraRef.current) return;
    const activeMode = forcedMode || viewMode;
    const offset = cameraOffsetRef.current;
    const dist = 240 * cameraZoomRef.current;

    if (activeMode === 'top') {
      cameraRef.current.position.set(offset.x, dist, offset.z + 0.001);
    } else if (activeMode === 'front') {
      cameraRef.current.position.set(offset.x, offset.y, dist);
    } else if (activeMode === 'side') {
      cameraRef.current.position.set(dist, offset.y, offset.z);
    } else {
      cameraRef.current.position.set(offset.x + dist * 0.7, offset.y + dist * 0.7, offset.z + dist * 0.7);
    }
    cameraRef.current.lookAt(offset.x, offset.y, offset.z);
    cameraRef.current.updateProjectionMatrix();

    if (rendererRef.current) {
      rendererRef.current.render(sceneRef.current, cameraRef.current);
    }
  };

  const updateHistory = (nextState: CADObject[]) => {
    const trimmed = history.slice(0, historyIndex + 1);
    setHistory([...trimmed, nextState]);
    setHistoryIndex(trimmed.length);
    setObjects(nextState);
  };

  // --- TIME TRAVEL MODIFIERS (UNDO / REDO) ---
  const executeUndo = () => {
    if (historyIndex > 0) {
      const nextIdx = historyIndex - 1;
      setHistoryIndex(nextIdx);
      setObjects(history[nextIdx]);
      setHudFeedback("Undo operation completed.");
    } else {
      setHudFeedback("History bounds reached. Nothing to Undo.");
    }
  };

  const executeRedo = () => {
    if (historyIndex < history.length - 1) {
      const nextIdx = historyIndex + 1;
      setHistoryIndex(nextIdx);
      setObjects(history[nextIdx]);
      setHudFeedback("Redo operation completed.");
    } else {
      setHudFeedback("History bounds reached. Nothing to Redo.");
    }
  };

  // --- WORKSPACE BOUNDS RAYCASTER ---
  const get3DPoint = (clientX: number, clientY: number): Point2D | null => {
    if (!containerRef.current || !cameraRef.current) return null;
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((clientY - rect.top) / rect.height) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(x, y), cameraRef.current);

    let norm = new THREE.Vector3(0, 1, 0);
    if (stateRef.current.viewMode === 'front') norm.set(0, 0, 1);
    if (stateRef.current.viewMode === 'side') norm.set(1, 0, 0);

    const plane = new THREE.Plane(norm, 0);
    const intersect = new THREE.Vector3();
    if (raycaster.ray.intersectPlane(plane, intersect)) {
      let calcX = intersect.x;
      let calcY = (stateRef.current.viewMode === 'front' || stateRef.current.viewMode === 'side') ? intersect.y : intersect.z;

      if (stateRef.current.snapToGrid) {
        calcX = Math.round(calcX / stateRef.current.gridSpacing) * stateRef.current.gridSpacing;
        calcY = Math.round(calcY / stateRef.current.gridSpacing) * stateRef.current.gridSpacing;
      }
      return { x: calcX, y: calcY };
    }
    return null;
  };

  // --- INTERACTION EVENT CONTROLLERS ---
  const handlePointerDown = (clientX: number, clientY: number, isRightClick = false) => {
    if (isRightClick || stateRef.current.currentTool === 'pan') {
      isPanningRef.current = true;
      panStartRef.current = { x: clientX, y: clientY };
      return;
    }

    const pts = get3DPoint(clientX, clientY);
    if (!pts) return;

    if (stateRef.current.currentTool === 'select') {
      const found = stateRef.current.objects.find((o) => o && o.points && o.points.some((p) => Math.abs(p.x - pts.x) < (stateRef.current.gridSpacing * 2.5) && Math.abs(p.y - pts.y) < (stateRef.current.gridSpacing * 2.5)));
      setSelectedId(found ? found.id : null);
      if (found) setHudFeedback(`Selected element: ${found.type.toUpperCase()}`);
      return;
    }

    if (stateRef.current.currentTool === 'move' || stateRef.current.currentTool === 'copy') {
      if (!stateRef.current.selectedId) return setHudFeedback("Action Rejected: Select an object first.");
      isDrawingRef.current = true;
      moveStartPointRef.current = pts;
      isCopyingRef.current = stateRef.current.currentTool === 'copy';
      return;
    }

    isDrawingRef.current = true;
    if (stateRef.current.currentTool === 'polyline') {
      if (polylinePointsRef.current.length === 0) { polylinePointsRef.current.push(pts); }
      startPointRef.current = polylinePointsRef.current[polylinePointsRef.current.length - 1];
    } else {
      startPointRef.current = chainAnchorRef.current ? chainAnchorRef.current : pts;
    }
    currentPointRef.current = pts;
  };

  const handlePointerMove = (clientX: number, clientY: number) => {
    if (isPanningRef.current) {
      const dx = clientX - panStartRef.current.x; const dy = clientY - panStartRef.current.y;
      panStartRef.current = { x: clientX, y: clientY };
      
      const factor = 0.35 * cameraZoomRef.current;
      if (stateRef.current.viewMode === 'top') { cameraOffsetRef.current.x -= dx * factor; cameraOffsetRef.current.z -= dy * factor; }
      else if (stateRef.current.viewMode === 'front') { cameraOffsetRef.current.x -= dx * factor; cameraOffsetRef.current.y += dy * factor; }
      else if (stateRef.current.viewMode === 'side') { cameraOffsetRef.current.z += dx * factor; cameraOffsetRef.current.y += dy * factor; }
      syncCameraMatrix();
      return;
    }

    if (!isDrawingRef.current || !startPointRef.current) {
      // Allow move/copy modifications tracking even without structural draw origins
      if (isDrawingRef.current && moveStartPointRef.current && stateRef.current.selectedId) {
        const pts = get3DPoint(clientX, clientY);
        if (!pts) return;
        const dx = pts.x - moveStartPointRef.current.x; const dy = pts.y - moveStartPointRef.current.y;
        moveStartPointRef.current = pts;

        setObjects((prev) => prev.map((o) => o.id === stateRef.current.selectedId ? { ...o, points: o.points.map((p) => ({ x: p.x + dx, y: p.y + dy })) } : o));
      }
      return;
    }
    
    let pts = get3DPoint(clientX, clientY);
    if (!pts) return;

    if (stateRef.current.orthoMode && stateRef.current.currentTool !== 'move' && stateRef.current.currentTool !== 'copy') {
      const dx = Math.abs(pts.x - startPointRef.current.x);
      const dy = Math.abs(pts.y - startPointRef.current.y);
      pts = dx > dy ? { x: pts.x, y: startPointRef.current.y } : { x: startPointRef.current.x, y: pts.y };
    }

    currentPointRef.current = pts;
    const origin = startPointRef.current;
    const len = Math.round(Math.hypot(pts.x - origin.x, pts.y - origin.y));

    if (previewLineRef.current) {
      const pPts: THREE.Vector3[] = [];
      if (stateRef.current.currentTool === 'line' || stateRef.current.currentTool === 'polyline') {
        pPts.push(new THREE.Vector3(origin.x, 0.6, origin.y), new THREE.Vector3(pts.x, 0.6, pts.y));
      } else if (stateRef.current.currentTool === 'rectangle') {
        pPts.push(new THREE.Vector3(origin.x, 0.6, origin.y), new THREE.Vector3(pts.x, 0.6, origin.y), new THREE.Vector3(pts.x, 0.6, pts.y), new THREE.Vector3(origin.x, 0.6, pts.y), new THREE.Vector3(origin.x, 0.6, origin.y));
      } else if (stateRef.current.currentTool === 'polygon') {
        // Uniform Triangle/Polygon Generator Engine
        for (let i = 0; i <= 3; i++) { const alpha = (i / 3) * Math.PI * 2; pPts.push(new THREE.Vector3(origin.x + Math.cos(alpha) * len, 0.6, origin.y + Math.sin(alpha) * len)); }
      } else if (stateRef.current.currentTool === 'circle') {
        for (let i = 0; i <= 64; i++) { const alpha = (i / 64) * Math.PI * 2; pPts.push(new THREE.Vector3(origin.x + Math.cos(alpha) * len, 0.6, origin.y + Math.sin(alpha) * len)); }
      }
      previewLineRef.current.geometry.setFromPoints(pPts);
      if (rendererRef.current && cameraRef.current) rendererRef.current.render(sceneRef.current, cameraRef.current);
    }
  };

  const handlePointerUp = () => {
    if (isPanningRef.current) { isPanningRef.current = false; return; }
    if (!isDrawingRef.current) return;

    isDrawingRef.current = false;
    
    // Process Move & Copy Execution Pipelines Distinctly
    if ((stateRef.current.currentTool === 'move' || stateRef.current.currentTool === 'copy') && moveStartPointRef.current && stateRef.current.selectedId) {
      moveStartPointRef.current = null;
      if (isCopyingRef.current) {
        const target = stateRef.current.objects.find(o => o.id === stateRef.current.selectedId);
        if (target) {
          const cloneObj = { ...target, id: generateId() };
          updateHistory([...stateRef.current.objects, cloneObj]);
          setHudFeedback("Element structural copy operation committed.");
        }
      } else {
        updateHistory(stateRef.current.objects);
        setHudFeedback("Element translation layout updated.");
      }
      isCopyingRef.current = false;
      return;
    }

    if (!startPointRef.current || !currentPointRef.current) return;

    const origin = startPointRef.current;
    const end = currentPointRef.current;
    const len = Math.round(Math.hypot(end.x - origin.x, end.y - origin.y));
    if (len < 1) return;

    let newObj: CADObject | null = null;

    if (stateRef.current.currentTool === 'line') {
      newObj = { id: generateId(), type: 'line', points: [origin, end], color: '#3b82f6', layer: '0', is3D: false, properties: { length: len } };
      chainAnchorRef.current = end;
    } else if (stateRef.current.currentTool === 'polyline') {
      polylinePointsRef.current.push(end);
      const freezePoints = [...polylinePointsRef.current];
      setObjects((prev) => [
        ...prev.filter(o => o.id !== 'active_pline'),
        { id: 'active_pline', type: 'polyline', points: freezePoints, color: '#38bdf8', layer: '0', is3D: false }
      ]);
      startPointRef.current = end;
      isDrawingRef.current = true; 
      return; 
    } else if (stateRef.current.currentTool === 'rectangle') {
      newObj = { id: generateId(), type: 'rectangle', points: [{ x: origin.x, y: origin.y }, { x: end.x, y: origin.y }, { x: end.x, y: end.y }, { x: origin.x, y: end.y }], color: '#10b981', layer: '0', is3D: false, properties: { width: Math.abs(end.x - origin.x), height: Math.abs(end.y - origin.y) } };
    } else if (stateRef.current.currentTool === 'polygon') {
      const pts: Point2D[] = [];
      for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2; pts.push({ x: origin.x + Math.cos(a) * len, y: origin.y + Math.sin(a) * len }); }
      newObj = { id: generateId(), type: 'polygon', points: pts, color: '#f59e0b', layer: '0', is3D: false, properties: { description: 'Triangle primitive' } };
    } else if (stateRef.current.currentTool === 'circle') {
      const pts: Point2D[] = [];
      for (let i = 0; i < 64; i++) { const a = (i / 64) * Math.PI * 2; pts.push({ x: origin.x + Math.cos(a) * len, y: origin.y + Math.sin(a) * len }); }
      newObj = { id: generateId(), type: 'circle', points: pts, color: '#a855f7', layer: '0', is3D: false, properties: { radius: len } };
    }

    if (newObj) {
      const activeStateList = stateRef.current.objects.filter(o => o && o.id !== 'active_pline');
      updateHistory([...activeStateList, newObj]);
      setSelectedId(newObj.id);
      setHudFeedback(`Successfully added ${newObj.type.toUpperCase()} object.`);
    }

    startPointRef.current = null; currentPointRef.current = null;
    if (previewLineRef.current) previewLineRef.current.geometry.setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
  };

  // --- INTERACTION SYSTEM STORAGE ATTACHMENT PIPELINES ---
  const executeNewFile = () => {
    if (window.confirm("Are you sure you want to initialize a new canvas? Unsaved vectors will be lost.")) {
      clearWorkspace();
      setHistory([[]]);
      setHistoryIndex(0);
      setHudFeedback("Initialized clean working project workspace.");
    }
  };

  const executeSaveAsFile = () => {
    const dataString = JSON.stringify(objects, null, 2);
    const blob = new Blob([dataString], { type: 'application/json' });
    const link = document.createElement('a');
    link.download = `project_blueprint_${Date.now()}.json`;
    link.href = URL.createObjectURL(blob);
    link.click();
    setHudFeedback("Session file serialization downloaded safely.");
  };

  // --- INITIALIZE WEBGL GRAPHICS INTERACTION ENVIRONMENT ---
  useEffect(() => {
    if (!containerRef.current) return;
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    containerRef.current.innerHTML = '';
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const scene = sceneRef.current;
    scene.background = new THREE.Color(0x0f172a); // Rigid dark setup matching workspace requirements

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 5000);
    cameraRef.current = camera;
    syncCameraMatrix();

    scene.clear(); 
    scene.add(new THREE.AmbientLight(0xffffff, 0.95));
    const dl = new THREE.DirectionalLight(0xffffff, 0.75);
    dl.position.set(150, 350, 150);
    scene.add(dl);

    const divisions = Math.round(workspaceSize / gridSpacing);
    const grid = new THREE.GridHelper(workspaceSize, divisions > 0 ? divisions : 50, 0x4f46e5, 0x334155);
    scene.add(grid);

    const pMat = new THREE.LineBasicMaterial({ color: 0xf43f5e, linewidth: 3, depthTest: false });
    const previewLine = new THREE.Line(new THREE.BufferGeometry(), pMat);
    previewLine.renderOrder = 999;
    scene.add(previewLine);
    previewLineRef.current = previewLine;

    const host = containerRef.current;

    const onMouseDown = (e: MouseEvent) => { e.preventDefault(); handlePointerDown(e.clientX, e.clientY, e.button === 2); };
    const onMouseMove = (e: MouseEvent) => { handlePointerMove(e.clientX, e.clientY); };
    const onMouseUp = () => { handlePointerUp(); };

    const onTouchStart = (e: TouchEvent) => { if(e.touches.length === 1) { handlePointerDown(e.touches[0].clientX, e.touches[0].clientY, false); } };
    const onTouchMove = (e: TouchEvent) => { if(e.touches.length === 1) { handlePointerMove(e.touches[0].clientX, e.touches[0].clientY); } };
    
    host.addEventListener('mousedown', onMouseDown);
    host.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    host.addEventListener('touchstart', onTouchStart, { passive: true });
    host.addEventListener('touchmove', onTouchMove, { passive: true });
    host.addEventListener('touchend', onMouseUp, { passive: true });

    return () => {
      host.removeEventListener('mousedown', onMouseDown);
      host.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      host.removeEventListener('touchstart', onTouchStart);
      host.removeEventListener('touchmove', onTouchMove);
      host.removeEventListener('touchend', onMouseUp);
      renderer.dispose();
    };
  }, []);

  useEffect(() => { syncCameraMatrix(); }, [viewMode]);

  // --- GEOMETRY PROCESSING LAYER RENDERING ---
  useEffect(() => {
    if (!sceneRef.current) return;
    visualObjectsRef.current.forEach((mesh) => sceneRef.current.remove(mesh));
    visualObjectsRef.current.clear();

    objects.forEach((obj) => {
      if (!obj || !obj.points) return;
      const isSelected = obj.id === selectedId;
      const colorHex = isSelected ? 0xef4444 : new THREE.Color(obj.color || '#3b82f6').getHex();
      const group = new THREE.Group();

      if (obj.is3D && obj.extrusionHeight) {
        const shape = new THREE.Shape();
        if (obj.points.length > 1) {
          shape.moveTo(obj.points[0].x, obj.points[0].y);
          for (let i = 1; i < obj.points.length; i++) { shape.lineTo(obj.points[i].x, obj.points[i].y); }
          shape.lineTo(obj.points[0].x, obj.points[0].y);

          const geo = new THREE.ExtrudeGeometry(shape, { depth: obj.extrusionHeight, bevelEnabled: false });
          geo.rotateX(-Math.PI / 2);
          const mat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.4, side: THREE.DoubleSide });
          const mesh = new THREE.Mesh(geo, mat);
          group.add(mesh);
        }
      } else {
        const vecPoints: THREE.Vector3[] = [];
        obj.points.forEach((p) => { if (p) vecPoints.push(new THREE.Vector3(p.x, 0.5, p.y)); });
        
        if (obj.type !== 'line' && obj.type !== 'polyline' && vecPoints.length > 0) {
          vecPoints.push(vecPoints[0].clone());
        }

        if (vecPoints.length > 0) {
          const geo = new THREE.BufferGeometry().setFromPoints(vecPoints);
          const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: colorHex, linewidth: 3, depthTest: false }));
          line.renderOrder = 10;
          group.add(line);
        }

        if (isSelected && obj.points.length >= 2) {
          const p1 = obj.points[0]; const p2 = obj.points[obj.points.length - 1];
          let text = obj.type === 'circle' && obj.properties?.radius ? `R:${obj.properties.radius}${unit}` : `${Math.round(Math.hypot(p2.x - p1.x, p2.y - p1.y))}${unit}`;
          const canvas = document.createElement('canvas'); canvas.width = 160; canvas.height = 64;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.fillStyle = '#fbbf24'; ctx.font = 'bold 20px monospace'; ctx.fillText(text, 5, 36);
            const texture = new THREE.CanvasTexture(canvas);
            const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false }));
            sprite.position.set((p1.x + p2.x) / 2, 4, (p1.y + p2.y) / 2); sprite.scale.set(18, 9, 1);
            group.add(sprite);
          }
        }
      }
      sceneRef.current.add(group);
      visualObjectsRef.current.set(obj.id, group);
    });

    if (rendererRef.current && cameraRef.current) {
      rendererRef.current.render(sceneRef.current, cameraRef.current);
    }
  }, [objects, selectedId, unit]);

  // --- TOP BAR OPERATIONS HANDLERS ---
  const executeExtrude = () => {
    if (!selectedId) return alert('Select an object first.');
    const input = prompt("Enter precise extrusion depth dimension:", "40");
    if (!input) return;
    const depth = parseFloat(input) || 40;
    updateHistory(objects.map(o => o.id === selectedId ? { ...o, is3D: true, extrusionHeight: depth } : o));
    setViewMode('isometric');
    setHudFeedback(`Extruded element to depth of ${depth}${unit}.`);
  };

  const executeErase = () => {
    if (!selectedId) return;
    updateHistory(objects.filter(o => o.id !== selectedId));
    setSelectedId(null);
    setHudFeedback("Deleted element.");
  };

  const clearWorkspace = () => {
    setObjects([]);
    setSelectedId(null);
    polylinePointsRef.current = [];
    chainAnchorRef.current = null;
    updateHistory([]);
  };

  return (
    <div className="w-screen h-screen flex flex-col font-sans overflow-hidden select-none bg-slate-900 text-slate-100">
      
      {/* HEADER CONTROL ROW */}
      <header className="h-12 px-4 flex items-center justify-between border-b shrink-0 z-10 bg-slate-950 border-slate-800">
        <div className="flex items-center gap-3">
          <span className="text-sm md:text-base font-black tracking-wider text-indigo-500">ENGINE_CAD PRO</span>
          <span className="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded font-mono">{unit.toUpperCase()}</span>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={executeNewFile} className="px-2 py-1 bg-slate-800 rounded text-[10px] font-bold">NEW</button>
          <button onClick={executeSaveAsFile} className="px-2 py-1 bg-emerald-600 rounded text-[10px] font-bold text-white">SAVE AS</button>
          <button onClick={executeUndo} className="p-1 px-2 rounded bg-slate-800 text-[10px] font-bold">⤺ UNDO</button>
          <button onClick={executeRedo} className="p-1 px-2 rounded bg-slate-800 text-[10px] font-bold">⤻ REDO</button>
          <label className="flex items-center gap-1 text-[10px] font-semibold cursor-pointer ml-1">
            <input type="checkbox" checked={snapToGrid} onChange={(e) => setSnapToGrid(e.target.checked)} className="accent-indigo-500 rounded" />
            SNAP
          </label>
          <label className="flex items-center gap-1 text-[10px] font-semibold cursor-pointer">
            <input type="checkbox" checked={orthoMode} onChange={(e) => setOrthoMode(e.target.checked)} className="accent-indigo-500 rounded" />
            ORTHO
          </label>
        </div>
      </header>

      {/* VIEWPORT CONTROLLER WORKSPACE FRAME */}
      <div className="flex-1 flex flex-col md:flex-row relative w-full h-full min-h-0 overflow-hidden">
        
        <main ref={containerRef} className="flex-1 w-full min-h-[50vh] md:h-full relative overflow-hidden bg-transparent touch-none" style={{ minWidth: '0' }} />

        {/* COMPREHENSIVE RESPONSIVE CONTROL PANEL */}
        <aside className="w-full md:w-64 p-3 flex flex-row md:flex-col gap-4 border-t md:border-t-0 md:border-l overflow-x-auto md:overflow-y-auto shrink-0 z-10 bg-slate-950 border-slate-800">
          <div className="min-w-[160px] md:min-w-0">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">Draw Tools</h3>
            <div className="grid grid-cols-2 gap-1">
              {(['select', 'pan', 'move', 'copy', 'line', 'polyline', 'rectangle', 'polygon', 'circle'] as ToolType[]).map((tool) => (
                <button
                  key={tool}
                  onClick={() => {
                    if (tool === 'select') {
                      chainAnchorRef.current = null;
                      polylinePointsRef.current = [];
                      setObjects(prev => prev.filter(o => o.id !== 'active_pline'));
                    }
                    setCurrentTool(tool);
                  }}
                  className={`py-1 px-2 text-left rounded capitalize text-[11px] font-bold border ${
                    currentTool === tool ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-900 border-slate-800 text-slate-300'
                  }`}
                >
                  {tool === 'polygon' ? 'Triangle (Poly)' : tool}
                </button>
              ))}
            </div>
          </div>

          <div className="min-w-[120px] md:min-w-0 flex flex-col gap-1 border-l md:border-l-0 md:border-t pl-3 md:pl-0 md:pt-3 border-slate-800">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Modifiers</h3>
            <div className="grid grid-cols-1 gap-1">
              <button onClick={executeExtrude} className="py-1 px-2 text-left rounded text-[11px] font-semibold bg-emerald-600 text-white">⬔ Extrude 3D</button>
              <button onClick={executeErase} className="py-1 px-2 text-left rounded text-[11px] font-semibold bg-rose-950/60 text-rose-400 border border-rose-950">🗑 Delete</button>
            </div>
          </div>

          <div className="min-w-[120px] md:min-w-0 border-l md:border-l-0 md:border-t pl-3 md:pl-0 md:pt-3 border-slate-800">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Views</h3>
            <div className="grid grid-cols-2 gap-1">
              {(['top', 'front', 'side', 'isometric'] as ViewMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setViewMode(m)}
                  className={`py-1 px-1 text-center rounded capitalize text-[11px] font-bold border ${
                    viewMode === m ? 'bg-amber-600 border-amber-500 text-white' : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* HEADS UP DISPLAY TERMINAL STATUS */}
        <footer className="absolute bottom-32 md:bottom-3 left-4 right-4 px-4 py-2 rounded-lg border flex items-center justify-between backdrop-blur shadow-2xl z-10 bg-slate-950/90 border-slate-800 text-emerald-400">
          <div className="flex items-center gap-2 font-mono text-[11px]">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>{hudFeedback}</span>
          </div>
          <div className="font-mono text-[10px] text-slate-500 flex gap-2">
            <span>{currentTool.toUpperCase()}</span>
            <span>|</span>
            <span>ITEMS: {objects.length}</span>
          </div>
        </footer>

      </div>
    </div>
  );
}
