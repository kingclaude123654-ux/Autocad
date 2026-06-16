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
  const [hudFeedback, setHudFeedback] = useState<string>('Console: Select Units to Begin Workspace Initialization');

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
  const lastTouchDistanceRef = useRef<number | null>(null);

  // Three.js Pipeline Structural Nodes
  const sceneRef = useRef<THREE.Scene>(new THREE.Scene());
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const visualObjectsRef = useRef<Map<string, THREE.Object3D>>(new Map());
  const previewLineRef = useRef<THREE.Line | null>(null);
  const gridHelperRef = useRef<THREE.GridHelper | null>(null);

  const generateId = () => Math.random().toString(36).substring(2, 9);

  // Step 1: Unit Configuration Prompt on Mount
  useEffect(() => {
    const selectedUnit = prompt("Specify primary drawing workspace dimensions unit system (mm, cm, m, foot):", "mm");
    if (selectedUnit && ['mm', 'cm', 'm', 'foot'].includes(selectedUnit.toLowerCase())) {
      const u = selectedUnit.toLowerCase();
      setUnit(u);
      let spacing = 10;
      let totalSize = 500;
      if (u === 'cm') { spacing = 5; totalSize = 300; }
      else if (u === 'm') { spacing = 1; totalSize = 50; }
      else if (u === 'foot') { spacing = 1; totalSize = 100; }
      setGridSpacing(spacing);
      setWorkspaceSize(totalSize);
      setHudFeedback(`Workspace configured: ${u.toUpperCase()} Mode. Grid spacing set to 1 ${u}.`);
    } else {
      setUnit('mm');
      setHudFeedback('Workspace: Default MM Configuration Active.');
    }
  }, []);

  // WebGL Renderer Lifecycle Mount Context
  useEffect(() => {
    if (!containerRef.current) return;
    const width = containerRef.current.clientWidth || window.innerWidth;
    const height = containerRef.current.clientHeight || window.innerHeight;

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

    scene.add(new THREE.AmbientLight(0xffffff, 0.95));
    const dl = new THREE.DirectionalLight(0xffffff, 0.75);
    dl.position.set(150, 350, 150);
    scene.add(dl);

    // Initial Grid Compilation
    const divisions = Math.round(workspaceSize / gridSpacing);
    const grid = new THREE.GridHelper(workspaceSize, divisions > 0 ? divisions : 50, 0x4f46e5, isDarkMode ? 0x334155 : 0xcbd5e1);
    scene.add(grid);
    gridHelperRef.current = grid;

    const pMat = new THREE.LineBasicMaterial({ color: 0xf43f5e, linewidth: 3, depthTest: false });
    const previewLine = new THREE.Line(new THREE.BufferGeometry(), pMat);
    previewLine.renderOrder = 999;
    scene.add(previewLine);
    previewLineRef.current = previewLine;

    let animId: number;
    const renderLoop = () => {
      animId = requestAnimationFrame(renderLoop);
      if (rendererRef.current && cameraRef.current) {
        rendererRef.current.render(scene, cameraRef.current);
      }
    };
    renderLoop();

    const host = containerRef.current;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      cameraZoomRef.current = Math.max(0.05, Math.min(cameraZoomRef.current * (e.deltaY > 0 ? 1.08 : 0.92), 30.0));
      syncCameraMatrix();
    };
    host.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      cancelAnimationFrame(animId);
      if (host) host.removeEventListener('wheel', handleWheel);
      renderer.dispose();
    };
  }, [workspaceSize, gridSpacing]);

  // Synchronize Dark Mode Theme Flips Across Grid Networks
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

  // Zero-Lag Direct Matrix Refresh Pipeline
  const syncCameraMatrix = () => {
    if (!cameraRef.current) return;
    const offset = cameraOffsetRef.current;
    const dist = 240 * cameraZoomRef.current;

    if (viewMode === 'top') {
      cameraRef.current.position.set(offset.x, dist, offset.z + 0.001);
    } else if (viewMode === 'front') {
      cameraRef.current.position.set(offset.x, offset.y, dist);
    } else if (viewMode === 'side') {
      cameraRef.current.position.set(dist, offset.y, offset.z);
    } else {
      cameraRef.current.position.set(offset.x + dist * 0.7, offset.y + dist * 0.7, offset.z + dist * 0.7);
    }
    cameraRef.current.lookAt(offset.x, offset.y, offset.z);
    cameraRef.current.updateProjectionMatrix();
  };

  const updateHistory = (nextState: CADObject[]) => {
    const trimmed = history.slice(0, historyIndex + 1);
    setHistory([...trimmed, nextState]);
    setHistoryIndex(trimmed.length);
    setObjects(nextState);
  };

  // Pipeline Render Engine Graph Layer
  useEffect(() => {
    visualObjectsRef.current.forEach((mesh) => sceneRef.current.remove(mesh));
    visualObjectsRef.current.clear();

    objects.forEach((obj) => {
      const isSelected = obj.id === selectedId;
      const colorHex = isSelected ? 0xef4444 : new THREE.Color(obj.color).getHex();
      const group = new THREE.Group();

      if (obj.is3D && obj.extrusionHeight) {
        const shape = new THREE.Shape();
        if (obj.points.length > 1) {
          shape.moveTo(obj.points[0].x, obj.points[0].y);
          for (let i = 1; i < obj.points.length; i++) {
            shape.lineTo(obj.points[i].x, obj.points[i].y);
          }
          shape.lineTo(obj.points[0].x, obj.points[0].y);

          const geo = new THREE.ExtrudeGeometry(shape, { depth: obj.extrusionHeight, bevelEnabled: false });
          geo.rotateX(-Math.PI / 2);
          const mat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.4, side: THREE.DoubleSide });
          const mesh = new THREE.Mesh(geo, mat);
          group.add(mesh);
        }
      } else {
        const vecPoints: THREE.Vector3[] = [];
        obj.points.forEach((p) => vecPoints.push(new THREE.Vector3(p.x, 0.5, p.y)));
        
        if (obj.type !== 'line' && obj.type !== 'polyline' && vecPoints.length > 0) {
          vecPoints.push(vecPoints[0].clone());
        }

        const geo = new THREE.BufferGeometry().setFromPoints(vecPoints);
        const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: colorHex, linewidth: 3, depthTest: false }));
        line.renderOrder = 10;
        group.add(line);

        // Append Clear Spatial Measurement Labels
        if (isSelected && obj.points.length >= 2) {
          const p1 = obj.points[0];
          const p2 = obj.points[obj.points.length - 1];
          let measurementText = '';
          
          if (obj.type === 'circle' && obj.properties?.radius) {
            measurementText = `R:${obj.properties.radius}${unit} D:${obj.properties.radius * 2}${unit}`;
          } else {
            const lenValue = Math.round(Math.hypot(p2.x - p1.x, p2.y - p1.y));
            measurementText = `${lenValue}${unit}`;
          }
          
          const canvas = document.createElement('canvas');
          canvas.width = 160; canvas.height = 64;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.fillStyle = '#fbbf24'; ctx.font = 'bold 20px monospace';
            ctx.fillText(measurementText, 5, 36);
            const texture = new THREE.CanvasTexture(canvas);
            const spriteMat = new THREE.SpriteMaterial({ map: texture, depthTest: false });
            const sprite = new THREE.Sprite(spriteMat);
            sprite.position.set((p1.x + p2.x) / 2, 4, (p1.y + p2.y) / 2);
            sprite.scale.set(18, 9, 1);
            group.add(sprite);
          }
        }
      }

      sceneRef.current.add(group);
      visualObjectsRef.current.set(obj.id, group);
    });
  }, [objects, selectedId, unit]);

  // Precision coordinate projection mechanics
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

      // Handle Snap-To-Grid Checks
      if (snapToGrid) {
        calcX = Math.round(calcX / gridSpacing) * gridSpacing;
        calcY = Math.round(calcY / gridSpacing) * gridSpacing;
      }

      return { x: calcX, y: calcY };
    }
    return null;
  };

  const handlePointerDown = (clientX: number, clientY: number, isRightClick = false) => {
    if (isRightClick || currentTool === 'pan') {
      isPanningRef.current = true;
      panStartRef.current = { x: clientX, y: clientY };
      return;
    }

    const pts = get3DPoint(clientX, clientY);
    if (!pts) return;

    if (currentTool === 'select') {
      const found = objects.find((o) => o.points.some((p) => Math.abs(p.x - pts.x) < (gridSpacing * 2.5) && Math.abs(p.y - pts.y) < (gridSpacing * 2.5)));
      setSelectedId(found ? found.id : null);
      if (found) setHudFeedback(`Selected [${found.type.toUpperCase()}] ID: ${found.id}. Adjust specifications above if needed.`);
      return;
    }

    if (currentTool === 'move') {
      if (!selectedId) { setHudFeedback("Console: Select an item mesh target profile first to execute Move translation."); return; }
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
      const factor = 0.35 * cameraZoomRef.current;
      if (viewMode === 'top') { cameraOffsetRef.current.x -= dx * factor; cameraOffsetRef.current.z -= dy * factor; }
      else if (viewMode === 'front') { cameraOffsetRef.current.x -= dx * factor; cameraOffsetRef.current.y += dy * factor; }
      else if (viewMode === 'side') { cameraOffsetRef.current.z += dx * factor; cameraOffsetRef.current.y += dy * factor; }
      else { cameraOffsetRef.current.x -= dx * factor * 0.7; cameraOffsetRef.current.z -= dy * factor * 0.7; }
      syncCameraMatrix();
      return;
    }

    if (!isDrawingRef.current || !startPointRef.current) return;
    let pts = get3DPoint(clientX, clientY);
    if (!pts) return;

    // Handle Precision Ortho Snapping Math Locks
    if (orthoMode && currentTool !== 'move') {
      const dx = Math.abs(pts.x - startPointRef.current.x);
      const dy = Math.abs(pts.y - startPointRef.current.y);
      if (dx > dy) {
        pts = { x: pts.x, y: startPointRef.current.y };
      } else {
        pts = { x: startPointRef.current.x, y: pts.y };
      }
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
      } else if (currentTool === 'circle' || currentTool === 'polygon') {
        const sides = currentTool === 'circle' ? 32 : 3;
        for (let i = 0; i <= sides; i++) { const alpha = (i / sides) * Math.PI * 2; pPts.push(new THREE.Vector3(origin.x + Math.cos(alpha) * len, 0.6, origin.y + Math.sin(alpha) * len)); }
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
    let end = currentPointRef.current;

    if (orthoMode) {
      const dx = Math.abs(end.x - origin.x); const dy = Math.abs(end.y - origin.y);
      if (dx > dy) end = { x: end.x, y: origin.y };
      else end = { x: origin.x, y: end.y };
    }

    const len = Math.round(Math.hypot(end.x - origin.x, end.y - origin.y));
    if (len < 1) return;

    let newObj: CADObject | null = null;
    const currentToolStr = currentTool as string;

    if (currentToolStr === 'line') {
      newObj = { id: generateId(), type: 'line', points: [origin, end], color: '#3b82f6', layer: '0', is3D: false, properties: { length: len } };
      chainAnchorRef.current = end;
    } else if (currentToolStr === 'polyline') {
      polylinePointsRef.current.push(end);
      const freezePoints = [...polylinePointsRef.current];
      setObjects((prev) => {
        const filtered = prev.filter(o => o.id !== 'active_pline');
        return [...filtered, { id: 'active_pline', type: 'polyline', points: freezePoints, color: '#38bdf8', layer: '0', is3D: false, properties: { length: len } }];
      });
      startPointRef.current = end;
      isDrawingRef.current = true; 
      return; 
    } else if (currentToolStr === 'rectangle') {
      const w = Math.abs(end.x - origin.x); const h = Math.abs(end.y - origin.y);
      newObj = { id: generateId(), type: 'rectangle', points: [{ x: origin.x, y: origin.y }, { x: end.x, y: origin.y }, { x: end.x, y: end.y }, { x: origin.x, y: end.y }], color: '#10b981', layer: '0', is3D: false, properties: { width: w, height: h } };
    } else if (currentToolStr === 'circle') {
      const pts: Point2D[] = [];
      for (let i = 0; i < 32; i++) { const a = (i / 32) * Math.PI * 2; pts.push({ x: origin.x + Math.cos(a) * len, y: origin.y + Math.sin(a) * len }); }
      newObj = { id: generateId(), type: 'circle', points: pts, color: '#a855f7', layer: '0', is3D: false, properties: { radius: len, diameter: len * 2 } };
    } else if (currentToolStr === 'polygon') {
      const pts: Point2D[] = [];
      for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2; pts.push({ x: origin.x + Math.cos(a) * len, y: origin.y + Math.sin(a) * len }); }
      newObj = { id: generateId(), type: 'polygon', points: pts, color: '#f59e0b', layer: '0', is3D: false, properties: { radius: len } };
    }

    if (newObj) {
      const next = [...objects.filter(o => o.id !== 'active_pline'), newObj];
      updateHistory(next);
      setSelectedId(newObj.id);
      setHudFeedback(`Created ${newObj.type.toUpperCase()}. Use input boxes to change dimensions.`);
    }

    startPointRef.current = null; currentPointRef.current = null;
    if (previewLineRef.current) previewLineRef.current.geometry.setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
  };

  // SYSTEM MODIFICATION ENTRYWAYS
  const updateSelectedObjectDimensions = (propertyMap: Record<string, number>) => {
    if (!selectedId) return;
    const next = objects.map((obj) => {
      if (obj.id !== selectedId) return obj;
      const origin = obj.points[0] || { x: 0, y: 0 };
      let updatedPoints = [...obj.points];

      if (obj.type === 'circle' && propertyMap.radius) {
        const r = propertyMap.radius;
        updatedPoints = [];
        for (let i = 0; i < 32; i++) { const a = (i / 32) * Math.PI * 2; updatedPoints.push({ x: origin.x + Math.cos(a) * r, y: origin.y + Math.sin(a) * r }); }
        return { ...obj, points: updatedPoints, properties: { ...obj.properties, radius: r, diameter: r * 2 } };
      }
      
      if (obj.type === 'rectangle' && (propertyMap.width || propertyMap.height)) {
        const w = propertyMap.width || obj.properties?.width || 20;
        const h = propertyMap.height || obj.properties?.height || 20;
        updatedPoints = [{ x: origin.x, y: origin.y }, { x: origin.x + w, y: origin.y }, { x: origin.x + w, y: origin.y + h }, { x: origin.x, y: origin.y + h }];
        return { ...obj, points: updatedPoints, properties: { ...obj.properties, width: w, height: h } };
      }

      return obj;
    });
    updateHistory(next);
  };

  const handleTouchStart = (e: TouchEvent) => {
    if (e.touches.length === 1) handlePointerDown(e.touches[0].clientX, e.touches[0].clientY, false);
    else if (e.touches.length === 2) {
      isPanningRef.current = true; isDrawingRef.current = false;
      panStartRef.current = { x: (e.touches[0].clientX + e.touches[1].clientX) / 2, y: (e.touches[0].clientY + e.touches[1].clientY) / 2 };
      lastTouchDistanceRef.current = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
    }
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (e.touches.length === 1 && !isPanningRef.current) handlePointerMove(e.touches[0].clientX, e.touches[0].clientY);
    else if (e.touches.length === 2 && isPanningRef.current) {
      const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2; const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      const dx = midX - panStartRef.current.x; const dy = midY - panStartRef.current.y;
      panStartRef.current = { x: midX, y: midY };
      cameraOffsetRef.current.x -= dx * 0.4 * cameraZoomRef.current; cameraOffsetRef.current.z -= dy * 0.4 * cameraZoomRef.current;
      const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      if (lastTouchDistanceRef.current) cameraZoomRef.current = Math.max(0.1, Math.min(cameraZoomRef.current * (lastTouchDistanceRef.current / dist), 15.0));
      lastTouchDistanceRef.current = dist; syncCameraMatrix();
    }
  };

  useEffect(() => {
    const element = containerRef.current; if (!element) return;
    const mDown = (e: MouseEvent) => handlePointerDown(e.clientX, e.clientY, e.button === 2);
    const mMove = (e: MouseEvent) => handlePointerMove(e.clientX, e.clientY);
    const mUp = () => handlePointerUp();
    element.addEventListener('mousedown', mDown); window.addEventListener('mousemove', mMove); window.addEventListener('mouseup', mUp);
    element.addEventListener('touchstart', handleTouchStart, { passive: true }); element.addEventListener('touchmove', handleTouchMove, { passive: true }); element.addEventListener('touchend', () => handlePointerUp(), { passive: true });
    return () => {
      element.removeEventListener('mousedown', mDown); window.removeEventListener('mousemove', mMove); window.removeEventListener('mouseup', mUp);
      element.removeEventListener('touchstart', handleTouchStart); element.removeEventListener('touchmove', handleTouchMove);
    };
  }, [currentTool, objects, viewMode, selectedId, snapToGrid, orthoMode]);

  const executeNewProject = () => { setObjects([]); setSelectedId(null); chainAnchorRef.current = null; polylinePointsRef.current = []; setHistory([[]]); setHistoryIndex(0); setHudFeedback("Console: Cleared Workspace Grid."); };
  const executeSaveProject = () => { localStorage.setItem('minicad_v2_save', JSON.stringify(objects)); setHudFeedback("Console: Saved Project Configuration File."); };
  const executeLoadProject = () => { const save = localStorage.getItem('minicad_v2_save'); if (save) { const parsed = JSON.parse(save); setObjects(parsed); setHistory([parsed]); setHistoryIndex(0); setHudFeedback("Model loaded cleanly."); } };
  
  const executeIncreaseWorkspace = () => { setWorkspaceSize(prev => prev + 200); setHudFeedback(`Workspace bounds extended to: ${workspaceSize + 200} units.`); };

  const executeExtrude = () => {
    if (!selectedId) { setHudFeedback("Console: Select a profile first."); return; }
    const input = prompt("Enter precise extrusion depth dimension:", "40");
    if (!input) return; const depth = parseFloat(input) || 40;
    const next = objects.map(o => o.id === selectedId ? { ...o, is3D: true, extrusionHeight: depth } : o);
    updateHistory(next); setViewMode('isometric'); setTimeout(() => syncCameraMatrix(), 15);
  };

  const executeTrim = () => {
    if (!selectedId) return;
    const next = objects.map(o => (o.id === selectedId && o.points.length > 2) ? { ...o, points: o.points.slice(0, -1) } : o);
    updateHistory(next);
  };

  const executeExtend = () => {
    if (!selectedId) return;
    const next = objects.map(o => {
      if (o.id === selectedId && o.points.length >= 2) {
        const last = o.points[o.points.length - 1]; const prev = o.points[o.points.length - 2];
        return { ...o, points: [...o.points, { x: last.x + (last.x - prev.x) * 0.5, y: last.y + (last.y - prev.y) * 0.5 }] };
      }
      return o;
    });
    updateHistory(next);
  };

  // FIXED: Variable is now explicitly utilized in both telemetry and mathematics
  const executeFillet = () => {
    if (!selectedId) return;
    const target = objects.find(o => o.id === selectedId);
    if (!target || target.points.length < 3) return;
    const radiusInput = prompt("Enter Fillet Corner Radius value:", "10");
    if (!radiusInput) return;
    
    const filletRad = parseFloat(radiusInput) || 10; 
    setHudFeedback(`Applying corner layout rounding adjustment with radius: ${filletRad} ${unit}`);

    const fPts: Point2D[] = [];
    const total = target.points.length;
    
    for (let i = 0; i < total; i++) {
      const current = target.points[i]; 
      const nextItem = target.points[(i + 1) % total];
      const weight = Math.min(0.25, filletRad / 100); 
      
      fPts.push(current);
      fPts.push({ 
        x: current.x + (nextItem.x - current.x) * weight, 
        y: current.y + (nextItem.y - current.y) * weight 
      });
    }
    updateHistory(objects.map(o => o.id === selectedId ? { ...o, points: fPts } : o));
  };

  const executeRotate = () => {
    if (!selectedId) return;
    const input = prompt("Enter rotation angle in degrees:", "90");
    if (!input) return; const rad = (parseFloat(input) || 90) * Math.PI / 180;
    const cos = Math.cos(rad); const sin = Math.sin(rad);
    updateHistory(objects.map(o => o.id === selectedId ? { ...o, points: o.points.map(p => ({ x: p.x * cos - p.y * sin, y: p.x * sin + p.y * cos })) } : o));
  };

  const executeOffset = () => {
    if (!selectedId) return;
    const input = prompt("Enter offset displacement length value:", "10");
    if (!input) return; const off = parseFloat(input) || 10;
    updateHistory(objects.map(o => o.id === selectedId ? { ...o, points: o.points.map(p => ({ x: p.x + off, y: p.y + off })) } : o));
  };

  const executePolarArray = () => {
    if (!selectedId) return;
    const countInput = prompt("Enter copy replication count for circular layout pattern matrix:", "4");
    if (!countInput) return; const total = parseInt(countInput) || 4;
    const target = objects.find(o => o.id === selectedId);
    if (!target) return;

    let arrayCopies: CADObject[] = [];
    for (let i = 1; i < total; i++) {
      const angle = (i / total) * Math.PI * 2;
      const cos = Math.cos(angle); const sin = Math.sin(angle);
      arrayCopies.push({ ...target, id: generateId(), points: target.points.map(p => ({ x: p.x * cos - p.y * sin, y: p.x * sin + p.y * cos })) });
    }
    updateHistory([...objects, ...arrayCopies]);
  };

  const executeScale = () => {
    if (!selectedId) return;
    const ratioInput = prompt("Enter dimensional scale multiplier configuration multiplier ratio:", "2");
    if (!ratioInput) return; const s = parseFloat(ratioInput) || 2; 
    updateHistory(objects.map(o => o.id === selectedId ? { ...o, points: o.points.map(p => ({ x: p.x * s, y: p.y * s })) } : o));
  };

  const executeUnion = () => { if (selectedId) setObjects(prev => prev.map(o => o.id === selectedId ? { ...o, color: '#0ea5e9' } : o)); };
  const executeSubtract = () => { if (selectedId) setObjects(prev => prev.map(o => o.id === selectedId ? { ...o, color: '#ef4444' } : o)); };
  const executeCopy = () => { const target = objects.find(o => o.id === selectedId); if (target) setClipboard(target); };
  const executePaste = () => { if (!clipboard) return; const pasted: CADObject = { ...clipboard, id: generateId(), points: clipboard.points.map(p => ({ x: p.x + 20, y: p.y + 20 })) }; updateHistory([...objects, pasted]); setSelectedId(pasted.id); };
  const executeErase = () => { if (selectedId) { updateHistory(objects.filter(o => o.id !== selectedId)); setSelectedId(null); } };

  const executeExportPDF = () => {
    if (!rendererRef.current) return;
    const dataUrl = rendererRef.current.domElement.toDataURL('image/png');
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <body style="margin:0; display:flex; flex-direction:column; align-items:center; justify-content:center; background:#0f172a; color:#fff; font-family:sans-serif;">
            <h2>MiniCAD Pro Blueprint Document Map</h2>
            <img src="${dataUrl}" style="max-width:92%; border:2px solid #fff; background:#000;" />
            <p>Ready for output formatting. Press <strong>Ctrl + P</strong> to target Save As PDF.</p>
            <script>window.onload = function() { window.print(); }</script>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  return {
    containerRef, objects, selectedId, setSelectedId, currentTool, unit,
    snapToGrid, setSnapToGrid, orthoMode, setOrthoMode,
    getSelectedObject: () => objects.find(o => o.id === selectedId),
    updateSelectedObjectDimensions,
    setCurrentTool: (tool: ToolType) => {
      if (tool === 'deselect') { chainAnchorRef.current = null; polylinePointsRef.current = []; setObjects(prev => prev.filter(o => o.id !== 'active_pline')); setCurrentTool('select'); return; }
      if (tool !== 'polyline') { polylinePointsRef.current = []; }
      setCurrentTool(tool);
    },
    viewMode, changeView: (mode: ViewMode) => { setViewMode(mode); syncCameraMatrix(); },
    isDarkMode, setIsDarkMode, hudFeedback,
    executeExtrude, executeTrim, executeExtend, executeFillet, executeUnion, executeSubtract, executeErase,
    executeNewProject, executeSaveProject, executeLoadProject, executeCopy, executePaste,
    executeRotate, executeOffset, executePolarArray, executeScale, executeIncreaseWorkspace, executeExportPDF,
    undo: () => { if (historyIndex > 0) { setHistoryIndex(historyIndex - 1); setObjects(history[historyIndex - 1]); } },
    redo: () => { if (historyIndex < history.length - 1) { setHistoryIndex(historyIndex + 1); setObjects(history[historyIndex + 1]); } }
  };
}
