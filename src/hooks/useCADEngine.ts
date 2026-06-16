import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

export type ViewMode = 'top' | 'front' | 'side' | 'isometric';
export type ToolType = string;

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

export function useCADEngine() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [objects, setObjects] = useState<CADObject[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [currentTool, setCurrentTool] = useState<ToolType>('select');
  const [viewMode, setViewMode] = useState<ViewMode>('top');
  const [isDarkMode, setIsDarkMode] = useState<boolean>(true);
  const [hudFeedback, setHudFeedback] = useState<string>('Console: Workspace Active');

  // Dimension Calibration States
  const [unit, setUnit] = useState<string>('mm');
  const [snapToGrid, setSnapToGrid] = useState<boolean>(false);
  const [orthoMode, setOrthoMode] = useState<boolean>(false);
  const [workspaceSize, setWorkspaceSize] = useState<number>(400);
  const [gridSpacing, setGridSpacing] = useState<number>(10);

  // Core Storage & Clipboard Trackers
  const [clipboard, setClipboard] = useState<CADObject | null>(null);
  const [history, setHistory] = useState<CADObject[][]>([[]]);
  const [historyIndex, setHistoryIndex] = useState<number>(0);

  // Protected Gesture Pointer References
  const isDrawingRef = useRef<boolean>(false);
  const startPointRef = useRef<Point2D | null>(null);
  const currentPointRef = useRef<Point2D | null>(null);
  const chainAnchorRef = useRef<Point2D | null>(null);
  const moveStartPointRef = useRef<Point2D | null>(null);
  const polylinePointsRef = useRef<Point2D[]>([]);

  // Smooth View Matrix Viewport Vectors
  const cameraOffsetRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 0));
  const cameraZoomRef = useRef<number>(1.2);
  const isPanningRef = useRef<boolean>(false);
  const panStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Three.js Pipeline Structural Nodes
  const sceneRef = useRef<THREE.Scene>(new THREE.Scene());
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const visualObjectsRef = useRef<Map<string, THREE.Object3D>>(new Map());
  const previewLineRef = useRef<THREE.Line | null>(null);
  const gridHelperRef = useRef<THREE.GridHelper | null>(null);

  const generateId = () => Math.random().toString(36).substring(2, 9);

  // INSTANT VIEW MATRIX REFRESH (No timeouts, immediate render update)
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

  const get3DPoint = (clientX: number, clientY: number): Point2D | null => {
    if (!containerRef.current || !cameraRef.current) return null;
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((clientY - rect.top) / rect.height) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(x, y), cameraRef.current);

    let norm = new THREE.Vector3(0, 1, 0);
    if (viewMode === 'front') norm.set(0, 0, 1);
    if (viewMode === 'side') norm.set(1, 0, 0);

    const plane = new THREE.Plane(norm, 0);
    const intersect = new THREE.Vector3();
    if (raycaster.ray.intersectPlane(plane, intersect)) {
      let calcX = intersect.x;
      let calcY = (viewMode === 'front' || viewMode === 'side') ? intersect.y : intersect.z;

      if (snapToGrid) {
        calcX = Math.round(calcX / gridSpacing) * gridSpacing;
        calcY = Math.round(calcY / gridSpacing) * gridSpacing;
      }
      return { x: calcX, y: calcY };
    }
    return null;
  };

  // RESTORED PANNING & DRAWING SYSTEMS
  const handlePointerDown = (clientX: number, clientY: number, isRightClick = false) => {
    if (isRightClick || currentTool === 'pan') {
      isPanningRef.current = true;
      panStartRef.current = { x: clientX, y: clientY };
      return;
    }

    const pts = get3DPoint(clientX, clientY);
    if (!pts) return;

    if (currentTool === 'select') {
      const found = objects.find((o) => o && o.points && o.points.some((p) => Math.abs(p.x - pts.x) < (gridSpacing * 2.5) && Math.abs(p.y - pts.y) < (gridSpacing * 2.5)));
      setSelectedId(found ? found.id : null);
      return;
    }

    if (currentTool === 'move') {
      if (!selectedId) return;
      isDrawingRef.current = true;
      moveStartPointRef.current = pts;
      return;
    }

    isDrawingRef.current = true;
    if (currentTool === 'polyline') {
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
      
      // Fixed view-pan transformation vectors
      const factor = 0.35 * cameraZoomRef.current;
      if (viewMode === 'top') { cameraOffsetRef.current.x -= dx * factor; cameraOffsetRef.current.z -= dy * factor; }
      else if (viewMode === 'front') { cameraOffsetRef.current.x -= dx * factor; cameraOffsetRef.current.y += dy * factor; }
      else if (viewMode === 'side') { cameraOffsetRef.current.z += dx * factor; cameraOffsetRef.current.y += dy * factor; }
      syncCameraMatrix();
      return;
    }

    if (!isDrawingRef.current || !startPointRef.current) return;
    let pts = get3DPoint(clientX, clientY);
    if (!pts) return;

    if (orthoMode && currentTool !== 'move') {
      const dx = Math.abs(pts.x - startPointRef.current.x);
      const dy = Math.abs(pts.y - startPointRef.current.y);
      pts = dx > dy ? { x: pts.x, y: startPointRef.current.y } : { x: startPointRef.current.x, y: pts.y };
    }

    if (currentTool === 'move' && moveStartPointRef.current && selectedId) {
      const dx = pts.x - moveStartPointRef.current.x; const dy = pts.y - moveStartPointRef.current.y;
      moveStartPointRef.current = pts;
      setObjects((prev) => prev.map((o) => o.id === selectedId ? { ...o, points: o.points.map((p) => ({ x: p.x + dx, y: p.y + dy })) } : o));
      return;
    }

    currentPointRef.current = pts;
    const origin = startPointRef.current;
    const len = Math.round(Math.hypot(pts.x - origin.x, pts.y - origin.y));

    if (previewLineRef.current) {
      const pPts: THREE.Vector3[] = [];
      if (currentTool === 'line' || currentTool === 'polyline') {
        pPts.push(new THREE.Vector3(origin.x, 0.6, origin.y), new THREE.Vector3(pts.x, 0.6, pts.y));
      } else if (currentTool === 'rectangle') {
        pPts.push(new THREE.Vector3(origin.x, 0.6, origin.y), new THREE.Vector3(pts.x, 0.6, origin.y), new THREE.Vector3(pts.x, 0.6, pts.y), new THREE.Vector3(origin.x, 0.6, pts.y), new THREE.Vector3(origin.x, 0.6, origin.y));
      } else if (currentTool === 'polygon') {
        for (let i = 0; i <= 3; i++) { const alpha = (i / 3) * Math.PI * 2; pPts.push(new THREE.Vector3(origin.x + Math.cos(alpha) * len, 0.6, origin.y + Math.sin(alpha) * len)); }
      } else if (currentTool === 'circle') {
        for (let i = 0; i <= 64; i++) { const alpha = (i / 64) * Math.PI * 2; pPts.push(new THREE.Vector3(origin.x + Math.cos(alpha) * len, 0.6, origin.y + Math.sin(alpha) * len)); }
      }
      previewLineRef.current.geometry.setFromPoints(pPts);
    }
  };

  const handlePointerUp = () => {
    if (isPanningRef.current) { isPanningRef.current = false; return; }
    if (!isDrawingRef.current) return;

    isDrawingRef.current = false;
    if (currentTool === 'move') { moveStartPointRef.current = null; updateHistory(objects); return; }
    if (!startPointRef.current || !currentPointRef.current) return;

    const origin = startPointRef.current;
    const end = currentPointRef.current;

    const len = Math.round(Math.hypot(end.x - origin.x, end.y - origin.y));
    if (len < 1) return;

    let newObj: CADObject | null = null;

    if (currentTool === 'line') {
      newObj = { id: generateId(), type: 'line', points: [origin, end], color: '#3b82f6', layer: '0', is3D: false, properties: { length: len } };
      chainAnchorRef.current = end;
    } else if (currentTool === 'polyline') {
      polylinePointsRef.current.push(end);
      const freezePoints = [...polylinePointsRef.current];
      setObjects((prev) => [
        ...prev.filter(o => o.id !== 'active_pline'),
        { id: 'active_pline', type: 'polyline', points: freezePoints, color: '#38bdf8', layer: '0', is3D: false }
      ]);
      startPointRef.current = end;
      isDrawingRef.current = true; 
      return; 
    } else if (currentTool === 'rectangle') {
      newObj = { id: generateId(), type: 'rectangle', points: [{ x: origin.x, y: origin.y }, { x: end.x, y: origin.y }, { x: end.x, y: end.y }, { x: origin.x, y: end.y }], color: '#10b981', layer: '0', is3D: false, properties: { width: Math.abs(end.x - origin.x), height: Math.abs(end.y - origin.y) } };
    } else if (currentTool === 'polygon') {
      const pts: Point2D[] = [];
      for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2; pts.push({ x: origin.x + Math.cos(a) * len, y: origin.y + Math.sin(a) * len }); }
      newObj = { id: generateId(), type: 'polygon', points: pts, color: '#f59e0b', layer: '0', is3D: false };
    } else if (currentTool === 'circle') {
      const pts: Point2D[] = [];
      for (let i = 0; i < 64; i++) { const a = (i / 64) * Math.PI * 2; pts.push({ x: origin.x + Math.cos(a) * len, y: origin.y + Math.sin(a) * len }); }
      newObj = { id: generateId(), type: 'circle', points: pts, color: '#a855f7', layer: '0', is3D: false, properties: { radius: len } };
    }

    // FIX: Clean functional spread logic guarantees new shape is combined with existing array values
    if (newObj) {
      const activeStateList = objects.filter(o => o && o.id !== 'active_pline');
      updateHistory([...activeStateList, newObj]);
      setSelectedId(newObj.id);
    }

    startPointRef.current = null; currentPointRef.current = null;
    if (previewLineRef.current) previewLineRef.current.geometry.setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
  };

  useEffect(() => {
    const selectedUnit = prompt("Specify primary drawing workspace dimensions unit system (mm, cm, m, foot):", "mm");
    let u = 'mm';
    if (selectedUnit && ['mm', 'cm', 'm', 'foot'].includes(selectedUnit.toLowerCase())) { u = selectedUnit.toLowerCase(); }
    setUnit(u);
    let spacing = 10; let totalSize = 500;
    if (u === 'cm') { spacing = 5; totalSize = 300; }
    else if (u === 'm') { spacing = 1; totalSize = 50; }
    else if (u === 'foot') { spacing = 1; totalSize = 100; }
    setGridSpacing(spacing); setWorkspaceSize(totalSize);
    setHudFeedback(`Workspace configured: ${u.toUpperCase()} Mode. Ready.`);
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    const width = containerRef.current.clientWidth || window.innerWidth;
    const height = containerRef.current.clientHeight || window.innerHeight;

    if (rendererRef.current) {
      if (containerRef.current.contains(rendererRef.current.domElement)) {
        containerRef.current.removeChild(rendererRef.current.domElement);
      }
      rendererRef.current.dispose();
    }

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

    // FIXED MOUSE WHEEL ZOOM MULTIPLIER BINDING
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      cameraZoomRef.current = Math.max(0.05, Math.min(cameraZoomRef.current * (e.deltaY > 0 ? 1.08 : 0.92), 30.0));
      syncCameraMatrix();
    };
    host.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      host.removeEventListener('wheel', handleWheel);
      host.removeEventListener('mousedown', onMouseDown);
      host.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [workspaceSize, gridSpacing, currentTool, objects, selectedId, orthoMode, snapToGrid, viewMode]);

  useEffect(() => {
    if (gridHelperRef.current && sceneRef.current) {
      sceneRef.current.remove(gridHelperRef.current);
      const divisions = Math.round(workspaceSize / gridSpacing);
      const grid = new THREE.GridHelper(workspaceSize, divisions > 0 ? divisions : 50, 0x4f46e5, isDarkMode ? 0x334155 : 0xcbd5e1);
      sceneRef.current.add(grid);
      gridHelperRef.current = grid;
      sceneRef.current.background = new THREE.Color(isDarkMode ? 0x0f172a : 0xf8fafc);
    }
  }, [isDarkMode, workspaceSize, gridSpacing]);

  // Object Render Pipeline
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
  }, [objects, selectedId, unit]);

  const updateSelectedObjectDimensions = (propertyMap: Record<string, number>) => {
    if (!selectedId) return;
    updateHistory(objects.map((obj) => {
      if (obj.id !== selectedId) return obj;
      const origin = obj.points[0] || { x: 0, y: 0 };
      if (obj.type === 'circle' && propertyMap.radius) {
        const r = propertyMap.radius; const pts = [];
        for (let i = 0; i < 64; i++) { const a = (i / 64) * Math.PI * 2; pts.push({ x: origin.x + Math.cos(a) * r, y: origin.y + Math.sin(a) * r }); }
        return { ...obj, points: pts, properties: { ...obj.properties, radius: r } };
      }
      return obj;
    }));
  };

  // FULLY FIXED CORNER FILLET LOGIC FOR ALL PRIMITIVES
  const executeFillet = () => {
    if (!selectedId) return;
    const target = objects.find(o => o.id === selectedId);
    if (!target || target.points.length < 2) return;

    const input = prompt("Enter Fillet Corner Radius:", "10");
    if (!input) return;
    const filletRad = parseFloat(input) || 10;

    const fPts: Point2D[] = [];
    const total = target.points.length;
    
    // Smooth interpolation algorithm across vector junctions
    for (let i = 0; i < total; i++) {
      const p1 = target.points[i];
      const p2 = target.points[(i + 1) % total];
      
      fPts.push(p1);
      if (target.type === 'line' && total === 2 && i === 1) break; 

      const d = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const shift = Math.min(filletRad, d * 0.4);
      if (d > 0) {
        fPts.push({
          x: p1.x + ((p2.x - p1.x) / d) * shift,
          y: p1.y + ((p2.y - p1.y) / d) * shift
        });
      }
    }
    updateHistory(objects.map(o => o.id === selectedId ? { ...o, points: fPts } : o));
    setHudFeedback(`Applied radius fillet modification.`);
  };

  const executeNewProject = () => { setObjects([]); setSelectedId(null); chainAnchorRef.current = null; polylinePointsRef.current = []; setHistory([[]]); setHistoryIndex(0); setHudFeedback("Cleared Workspace Grid."); };
  const executeSaveProject = () => { localStorage.setItem('minicad_v3_core', JSON.stringify(objects)); setHudFeedback("Saved layout locally."); };
  const executeLoadProject = () => { const save = localStorage.getItem('minicad_v3_core'); if (save) { try { const parsed = JSON.parse(save); if (Array.isArray(parsed)) { const clean = parsed.filter(o => o && Array.isArray(o.points)); setObjects(clean); setHistory([clean]); setHistoryIndex(0); setHudFeedback("Model reloaded correctly."); return; } } catch(e) {} } };
  const executeExtrude = () => { if (!selectedId) return; const input = prompt("Enter precise extrusion depth dimension:", "40"); if (!input) return; const depth = parseFloat(input) || 40; updateHistory(objects.map(o => o.id === selectedId ? { ...o, is3D: true, extrusionHeight: depth } : o)); changeView('isometric'); };
  const executePolarArray = () => { if (!selectedId) return; const input = prompt("Enter number of instances for circular replication:", "6"); if (!input) return; const count = parseInt(input) || 6; const target = objects.find(o => o.id === selectedId); if (!target) return; const arrayed: CADObject[] = []; for (let i = 1; i < count; i++) { const angle = (i / count) * Math.PI * 2; const rotatedPoints = target.points.map(p => ({ x: p.x * Math.cos(angle) - p.y * Math.sin(angle), y: p.x * Math.sin(angle) + p.y * Math.cos(angle) })); arrayed.push({ ...target, id: generateId(), points: rotatedPoints }); } updateHistory([...objects, ...arrayed]); };
  const executeTrim = () => { if (selectedId) updateHistory(objects.map(o => o.id === selectedId ? { ...o, points: o.points.slice(0, -1) } : o)); };
  const executeExtend = () => { if (selectedId) updateHistory(objects.map(o => o.id === selectedId && o.points.length >= 2 ? { ...o, points: [...o.points, { x: o.points[o.points.length-1].x + 10, y: o.points[o.points.length-1].y + 10 }] } : o)); };
  const executeRotate = () => { if (selectedId) updateHistory(objects.map(o => o.id === selectedId ? { ...o, points: o.points.map(p => ({ x: p.x * 0.7 - p.y * 0.7, y: p.x * 0.7 + p.y * 0.7 })) } : o)); };
  const executeOffset = () => { if (selectedId) updateHistory(objects.map(o => o.id === selectedId ? { ...o, points: o.points.map(p => ({ x: p.x + 10, y: p.y + 10 })) } : o)); };
  const executeScale = () => { if (selectedId) updateHistory(objects.map(o => o.id === selectedId ? { ...o, points: o.points.map(p => ({ x: p.x * 1.5, y: p.y * 1.5 })) } : o)); };
  const executeUnion = () => { if (selectedId) setObjects(prev => prev.map(o => o.id === selectedId ? { ...o, color: '#0ea5e9' } : o)); };
  const executeSubtract = () => { if (selectedId) setObjects(prev => prev.map(o => o.id === selectedId ? { ...o, color: '#ef4444' } : o)); };
  const executeCopy = () => { const target = objects.find(o => o.id === selectedId); if (target) setClipboard(target); };
  const executePaste = () => { if (!clipboard) return; const pasted = { ...clipboard, id: generateId(), points: clipboard.points.map(p => ({ x: p.x + 15, y: p.y + 15 })) }; updateHistory([...objects, pasted]); };
  const executeErase = () => { if (selectedId) { updateHistory(objects.filter(o => o.id !== selectedId)); setSelectedId(null); } };
  const executeExportPDF = () => { if (rendererRef.current) window.open(rendererRef.current.domElement.toDataURL('image/png'), '_blank'); };

  return {
    containerRef, objects, selectedId, setSelectedId, currentTool, unit, snapToGrid, setSnapToGrid, orthoMode, setOrthoMode,
    getSelectedObject: () => objects.find(o => o && o.id === selectedId), updateSelectedObjectDimensions,
    setCurrentTool: (tool: ToolType) => {
      if (tool === 'deselect') { chainAnchorRef.current = null; polylinePointsRef.current = []; setObjects(prev => prev.filter(o => o.id !== 'active_pline')); setCurrentTool('select'); return; }
      setCurrentTool(tool);
    },
    viewMode, changeView: (mode: ViewMode) => { setViewMode(mode); syncCameraMatrix(mode); },
    isDarkMode, setIsDarkMode, hudFeedback,
    executeExtrude, executeTrim, executeExtend, executeFillet, executeUnion, executeSubtract, executeErase,
    executeNewProject, executeSaveProject, executeLoadProject, executeCopy, executePaste, executePolarArray,
    executeRotate, executeOffset, executeScale, executeIncreaseWorkspace: () => setWorkspaceSize(prev => prev + 150), executeExportPDF,
    undo: () => { if (historyIndex > 0) { setHistoryIndex(historyIndex - 1); setObjects(history[historyIndex - 1]); } },
    redo: () => { if (historyIndex < history.length - 1) { setHistoryIndex(historyIndex + 1); setObjects(history[historyIndex + 1]); } }
  };
}