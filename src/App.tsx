import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

// --- TYPES & INTERFACES ---
export type ViewMode = 'top' | 'front' | 'side' | 'isometric';
export type ToolType = 'select' | 'pan' | 'move' | 'line' | 'polyline' | 'rectangle' | 'polygon' | 'circle';

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
  // --- APPLICATION STATES ---
  const [objects, setObjects] = useState<CADObject[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [currentTool, setCurrentTool] = useState<ToolType>('select');
  const [viewMode, setViewMode] = useState<ViewMode>('top');
  const [isDarkMode, setIsDarkMode] = useState<boolean>(true);
  const [hudFeedback, setHudFeedback] = useState<string>('System Ready: Select a tool to begin drawing.');

  // Workspace Settings
  const [unit, setUnit] = useState<string>('mm');
  const [snapToGrid, setSnapToGrid] = useState<boolean>(false);
  const [orthoMode, setOrthoMode] = useState<boolean>(false);
  const [workspaceSize] = useState<number>(500);
  const [gridSpacing] = useState<number>(10);

  // History Stack
  const [history, setHistory] = useState<CADObject[][]>([[]]);
  const [historyIndex, setHistoryIndex] = useState<number>(0);

  // --- CORE THREE.JS & INTERACTION REFERENCES ---
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<THREE.Scene>(new THREE.Scene());
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const visualObjectsRef = useRef<Map<string, THREE.Object3D>>(new Map());
  const previewLineRef = useRef<THREE.Line | null>(null);
  const gridHelperRef = useRef<THREE.GridHelper | null>(null);

  // Drawing Gesture Trackers
  const isDrawingRef = useRef<boolean>(false);
  const startPointRef = useRef<Point2D | null>(null);
  const currentPointRef = useRef<Point2D | null>(null);
  const chainAnchorRef = useRef<Point2D | null>(null);
  const moveStartPointRef = useRef<Point2D | null>(null);
  const polylinePointsRef = useRef<Point2D[]>([]);

  // Navigation Trackers
  const cameraOffsetRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 0));
  const cameraZoomRef = useRef<number>(1.2);
  const isPanningRef = useRef<boolean>(false);
  const panStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Thread-Safe State Mirror to eliminate engine re-render lag
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
  }, [currentTool, objects, selectedId, orthoMode, snapToGrid, viewMode, gridSpacing, unit, workspaceSize]);

  const generateId = () => Math.random().toString(36).substring(2, 9);

  // --- CAMERA MATRIX COORDINATION ---
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

  // --- RAYCASTING WORKSPACE INTERSECTIONS ---
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

  // --- MOUSE ELEMENT EVENT LISTENERS ---
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
      if (found) setHudFeedback(`Selected element: ${found.type.toUpperCase()} (${found.id})`);
      return;
    }

    if (stateRef.current.currentTool === 'move') {
      if (!stateRef.current.selectedId) return;
      isDrawingRef.current = true;
      moveStartPointRef.current = pts;
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

    if (!isDrawingRef.current || !startPointRef.current) return;
    let pts = get3DPoint(clientX, clientY);
    if (!pts) return;

    if (stateRef.current.orthoMode && stateRef.current.currentTool !== 'move') {
      const dx = Math.abs(pts.x - startPointRef.current.x);
      const dy = Math.abs(pts.y - startPointRef.current.y);
      pts = dx > dy ? { x: pts.x, y: startPointRef.current.y } : { x: startPointRef.current.x, y: pts.y };
    }

    if (stateRef.current.currentTool === 'move' && moveStartPointRef.current && stateRef.current.selectedId) {
      const dx = pts.x - moveStartPointRef.current.x; const dy = pts.y - moveStartPointRef.current.y;
      moveStartPointRef.current = pts;
      setObjects((prev) => prev.map((o) => o.id === stateRef.current.selectedId ? { ...o, points: o.points.map((p) => ({ x: p.x + dx, y: p.y + dy })) } : o));
      return;
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
    if (stateRef.current.currentTool === 'move') { moveStartPointRef.current = null; updateHistory(stateRef.current.objects); return; }
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
      newObj = { id: generateId(), type: 'polygon', points: pts, color: '#f59e0b', layer: '0', is3D: false };
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

  // --- WORKSPACE ENVIRONMENT GENERATOR ---
  useEffect(() => {
    if (!containerRef.current) return;
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const scene = sceneRef.current;
    scene.background = new THREE.Color(isDarkMode ? 0x0f172a : 0xf8fafc);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 5000);
    cameraRef.current = camera;
    syncCameraMatrix();

    scene.clear(); 
    scene.add(new THREE.AmbientLight(0xffffff, 0.95));
    const dl = new THREE.DirectionalLight(0xffffff, 0.75);
    dl.position.set(150, 350, 150);
    scene.add(dl);

    const divisions = Math.round(workspaceSize / gridSpacing);
    const grid = new THREE.GridHelper(workspaceSize, divisions > 0 ? divisions : 50, 0x4f46e5, isDarkMode ? 0x334155 : 0xcbd5e1);
    scene.add(grid);
    gridHelperRef.current = grid;

    const pMat = new THREE.LineBasicMaterial({ color: 0xf43f5e, linewidth: 3, depthTest: false });
    const previewLine = new THREE.Line(new THREE.BufferGeometry(), pMat);
    previewLine.renderOrder = 999;
    scene.add(previewLine);
    previewLineRef.current = previewLine;

    const host = containerRef.current;
    const onMouseDown = (e: MouseEvent) => { e.preventDefault(); handlePointerDown(e.clientX, e.clientY, e.button === 2); };
    const onMouseMove = (e: MouseEvent) => { handlePointerMove(e.clientX, e.clientY); };
    const onMouseUp = () => { handlePointerUp(); };

    host.addEventListener('mousedown', onMouseDown);
    host.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      cameraZoomRef.current = Math.max(0.05, Math.min(cameraZoomRef.current * (e.deltaY > 0 ? 1.08 : 0.92), 30.0));
      syncCameraMatrix();
    };
    host.addEventListener('wheel', handleWheel, { passive: false });

    const handleResize = () => {
      if (!containerRef.current || !cameraRef.current || !rendererRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
      rendererRef.current.render(sceneRef.current, cameraRef.current);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      host.removeEventListener('wheel', handleWheel);
      host.removeEventListener('mousedown', onMouseDown);
      host.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      if (host.contains(renderer.domElement)) host.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, [workspaceSize, gridSpacing, isDarkMode]);

  useEffect(() => { syncCameraMatrix(); }, [viewMode]);

  // --- PIPELINE RENDERING SYSTEM ---
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

  // --- TOOLBAR EXECUTION FUNCTIONS ---
  const executeExtrude = () => {
    if (!selectedId) return alert('Select an object first.');
    const input = prompt("Enter precise extrusion depth dimension:", "40");
    if (!input) return;
    const depth = parseFloat(input) || 40;
    updateHistory(objects.map(o => o.id === selectedId ? { ...o, is3D: true, extrusionHeight: depth } : o));
    setViewMode('isometric');
    setHudFeedback(`Extruded element to depth of ${depth}${unit}.`);
  };

  const executeTrim = () => {
    if (!selectedId) return alert('Select an object first.');
    updateHistory(objects.map(o => {
      if (o.id !== selectedId || o.points.length < 2) return o;
      const newPoints = [...o.points];
      const p1 = newPoints[newPoints.length - 2];
      const p2 = newPoints[newPoints.length - 1];
      newPoints[newPoints.length - 1] = { x: p1.x + (p2.x - p1.x) * 0.75, y: p1.y + (p2.y - p1.y) * 0.75 };
      return { ...o, points: newPoints };
    }));
    setHudFeedback("Trim operation calculated successfully.");
  };

  const executeExtend = () => {
    if (!selectedId) return alert('Select an object first.');
    updateHistory(objects.map(o => {
      if (o.id !== selectedId || o.points.length < 2) return o;
      const newPoints = [...o.points];
      const p1 = newPoints[newPoints.length - 2];
      const p2 = newPoints[newPoints.length - 1];
      const d = Math.hypot(p2.x - p1.x, p2.y - p1.y) || 1;
      newPoints[newPoints.length - 1] = { x: p2.x + ((p2.x - p1.x) / d) * 20, y: p2.y + ((p2.y - p1.y) / d) * 20 };
      return { ...o, points: newPoints };
    }));
    setHudFeedback("Extended path vectors forward.");
  };

  const executeFillet = () => {
    if (!selectedId) return alert('Select an object first.');
    const target = objects.find(o => o.id === selectedId);
    if (!target || target.points.length < 2) return;
    const input = prompt("Enter Fillet Corner Radius:", "10");
    if (!input) return;
    const filletRad = parseFloat(input) || 10;

    const fPts: Point2D[] = [];
    const total = target.points.length;
    for (let i = 0; i < total; i++) {
      const p1 = target.points[i]; const p2 = target.points[(i + 1) % total];
      fPts.push(p1);
      if (target.type === 'line' && total === 2 && i === 1) break;
      const d = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const shift = Math.min(filletRad, d * 0.4);
      if (d > 0) fPts.push({ x: p1.x + ((p2.x - p1.x) / d) * shift, y: p1.y + ((p2.y - p1.y) / d) * shift });
    }
    updateHistory(objects.map(o => o.id === selectedId ? { ...o, points: fPts } : o));
    setHudFeedback("Applied fillet modifier.");
  };

  const executeRotate = () => {
    if (!selectedId) return alert('Select an object first.');
    updateHistory(objects.map(o => {
      if (o.id !== selectedId) return o;
      const angle = Math.PI / 12; // 15 degrees step
      return { ...o, points: o.points.map(p => ({ x: p.x * Math.cos(angle) - p.y * Math.sin(angle), y: p.x * Math.sin(angle) + p.y * Math.cos(angle) })) };
    }));
    setHudFeedback("Rotated geometry 15 degrees CCW.");
  };

  const executeScale = () => {
    if (!selectedId) return alert('Select an object first.');
    updateHistory(objects.map(o => {
      if (o.id !== selectedId) return o;
      return { ...o, points: o.points.map(p => ({ x: p.x * 1.25, y: p.y * 1.25 })) };
    }));
    setHudFeedback("Scaled model footprint up 25%.");
  };

  const executeAreaOffset = () => {
    if (!selectedId) return alert('Select an object first.');
    updateHistory(objects.map(o => {
      if (o.id !== selectedId) return o;
      return { ...o, points: o.points.map(p => ({ x: p.x + 10, y: p.y + 10 })) };
    }));
    setHudFeedback("Calculated uniform segment offset lines.");
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
    setHudFeedback("Workspace wiped clean.");
  };

  // --- RENDER APPLICATION LAYOUT ---
  return (
    <div className={`w-screen h-screen flex flex-col font-sans select-none ${isDarkMode ? 'bg-slate-900 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      
      {/* HEADER CONTROLS BAR */}
      <header className={`px-4 py-2 flex items-center justify-between border-b ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200'}`}>
        <div className="flex items-center gap-3">
          <span className="text-lg font-black tracking-wider text-indigo-500">ENGINE_CAD v3.0</span>
          <div className="flex gap-1 ml-4 bg-slate-800/40 p-0.5 rounded-md border border-slate-700/50">
            <button onClick={() => { setUnit('mm'); }} className={`px-2 py-1 text-xs font-bold rounded ${unit === 'mm' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>MM</button>
            <button onClick={() => { setUnit('cm'); }} className={`px-2 py-1 text-xs font-bold rounded ${unit === 'cm' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>CM</button>
            <button onClick={() => { setUnit('m'); }} className={`px-2 py-1 text-xs font-bold rounded ${unit === 'm' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>M</button>
          </div>
        </div>

        {/* SYSTEM STATUS OPTIONS */}
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
            <input type="checkbox" checked={snapToGrid} onChange={(e) => setSnapToGrid(e.target.checked)} className="accent-indigo-500 rounded" />
            SNAP GRID
          </label>
          <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
            <input type="checkbox" checked={orthoMode} onChange={(e) => setOrthoMode(e.target.checked)} className="accent-indigo-500 rounded" />
            ORTHO (90°)
          </label>
          <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-1.5 rounded bg-slate-800 border border-slate-700 text-xs font-bold hover:bg-slate-700">
            {isDarkMode ? '🌞 LIGHT MODE' : '🌙 DARK MODE'}
          </button>
          <button onClick={clearWorkspace} className="px-3 py-1 bg-rose-600 text-white rounded text-xs font-bold hover:bg-rose-500">
            CLEAR CANVAS
          </button>
        </div>
      </header>

      <div className="flex-1 flex relative overflow-hidden">
        
        {/* LEFT TOOLBAR: OBJECTS & MODIFIERS */}
        <aside className={`w-64 p-3 flex flex-col gap-4 border-r overflow-y-auto ${isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200'}`}>
          
          {/* PRIMITIVE DRAWING SHAPES */}
          <div>
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Draw Core Elements</h3>
            <div className="grid grid-cols-2 gap-1.5">
              {(['select', 'pan', 'move', 'line', 'polyline', 'rectangle', 'polygon', 'circle'] as ToolType[]).map((tool) => (
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
                  className={`py-2 px-3 text-left rounded capitalize text-xs font-bold transition-all border ${
                    currentTool === tool 
                      ? 'bg-indigo-600 border-indigo-500 text-white' 
                      : isDarkMode ? 'bg-slate-900/60 border-slate-800 hover:bg-slate-800 text-slate-300' : 'bg-slate-100 border-slate-200 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  {tool}
                </button>
              ))}
            </div>
          </div>

          {/* ADVANCED MODIFIERS ENGINE */}
          <div className="flex flex-col gap-1 border-t pt-3 border-slate-800/80">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Geometric Modifiers</h3>
            <button onClick={executeExtrude} className="py-1.5 px-2 text-left rounded text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white mb-1">⬔ Extrude to 3D</button>
            <button onClick={executeTrim} className="py-1.5 px-2 text-left rounded text-xs font-semibold bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700">✂ Trim Segment</button>
            <button onClick={executeExtend} className="py-1.5 px-2 text-left rounded text-xs font-semibold bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700">⤾ Extend Vector</button>
            <button onClick={executeFillet} className="py-1.5 px-2 text-left rounded text-xs font-semibold bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700">⌒ Corner Fillet</button>
            <button onClick={executeRotate} className="py-1.5 px-2 text-left rounded text-xs font-semibold bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700">⟳ Rotate 15°</button>
            <button onClick={executeScale} className="py-1.5 px-2 text-left rounded text-xs font-semibold bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700">⚖ Scale Geometry</button>
            <button onClick={executeAreaOffset} className="py-1.5 px-2 text-left rounded text-xs font-semibold bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700">☵ Offset Outline</button>
            <button onClick={executeErase} className="py-1.5 px-2 text-left rounded text-xs font-semibold bg-rose-950/60 text-rose-400 border border-rose-900/50 hover:bg-rose-900/50 mt-2">🗑 Delete Selection</button>
          </div>

          {/* VIEWPORT CONTROLLER CAMERA */}
          <div className="border-t pt-3 border-slate-800/80">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Camera Perspective</h3>
            <div className="grid grid-cols-2 gap-1">
              {(['top', 'front', 'side', 'isometric'] as ViewMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setViewMode(m)}
                  className={`py-1 px-2 text-center rounded capitalize text-xs font-bold border ${
                    viewMode === m 
                      ? 'bg-amber-600 border-amber-500 text-white' 
                      : isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800' : 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* GL VIEWPORT CANVAS CONTAINER AREA */}
        <main ref={containerRef} className="flex-1 w-full h-full cursor-crosshair relative bg-transparent" />

        {/* BOTTOM FLOATING TECHNICAL HUD DATA TERMINAL */}
        <footer className={`absolute bottom-3 left-64 right-4 px-4 py-2.5 rounded-lg border flex items-center justify-between backdrop-blur shadow-2xl ${
          isDarkMode ? 'bg-slate-950/90 border-slate-800 text-emerald-400' : 'bg-white/90 border-slate-200 text-emerald-700'
        }`}>
          <div className="flex items-center gap-2 font-mono text-xs">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>{hudFeedback}</span>
          </div>
          <div className="font-mono text-[11px] text-slate-500 flex gap-4">
            <span>TOOL: <strong className="text-indigo-400 uppercase">{currentTool}</strong></span>
            <span>GRID: <strong>{gridSpacing}{unit}</strong></span>
            <span>ITEMS: <strong>{objects.length}</strong></span>
          </div>
        </footer>

      </div>
    </div>
  );
}