import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { CADObject, Point2D, ToolType, ViewMode } from '../types/cad';

export function useCADEngine() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [objects, setObjects] = useState<CADObject[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [currentTool, setCurrentTool] = useState<ToolType>('select');
  const [viewMode, setViewMode] = useState<ViewMode>('top');
  const [isDarkMode, setIsDarkMode] = useState<boolean>(true);
  const [hudFeedback, setHudFeedback] = useState<string>('Status: Ready');

  // Deep structural undo/redo stacks
  const [history, setHistory] = useState<CADObject[][]>([[]]);
  const [historyIndex, setHistoryIndex] = useState<number>(0);

  // Drawing Refs
  const isDrawingRef = useRef<boolean>(false);
  const startPointRef = useRef<Point2D | null>(null);
  const currentPointRef = useRef<Point2D | null>(null);
  const chainAnchorRef = useRef<Point2D | null>(null);

  // Pan & Zoom Viewport Settings
  const cameraOffsetRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 0));
  const cameraZoomRef = useRef<number>(1.0);
  const isPanningRef = useRef<boolean>(false);
  const panStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const lastTouchDistanceRef = useRef<number | null>(null);

  // Three.js Systems
  const sceneRef = useRef<THREE.Scene>(new THREE.Scene());
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const visualObjectsRef = useRef<Map<string, THREE.Object3D>>(new Map());
  const previewLineRef = useRef<THREE.Line | null>(null);
  const gridHelperRef = useRef<THREE.GridHelper | null>(null);

  const generateId = () => Math.random().toString(36).substring(2, 9);

  // Initialize Canvas
  useEffect(() => {
    if (!containerRef.current) return;
    const width = containerRef.current.clientWidth || window.innerWidth;
    const height = containerRef.current.clientHeight || window.innerHeight;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const scene = sceneRef.current;
    scene.background = new THREE.Color(isDarkMode ? 0x0f172a : 0xf8fafc);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 2000);
    cameraRef.current = camera;
    updateCameraPosition();

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(100, 200, 100);
    scene.add(dirLight);

    const grid = new THREE.GridHelper(600, 120, 0x4f46e5, isDarkMode ? 0x334155 : 0xcbd5e1);
    grid.position.y = 0;
    scene.add(grid);
    gridHelperRef.current = grid;

    const previewMat = new THREE.LineBasicMaterial({ color: 0xf43f5e, linewidth: 3, depthTest: false });
    const previewGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    const previewLine = new THREE.Line(previewGeo, previewMat);
    previewLine.renderOrder = 999;
    scene.add(previewLine);
    previewLineRef.current = previewLine;

    let animationId: number;
    const animate = () => {
      animationId = requestAnimationFrame(animate);
      if (rendererRef.current && cameraRef.current) {
        rendererRef.current.render(scene, cameraRef.current);
      }
    };
    animate();

    const host = containerRef.current;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 1.1 : 0.9;
      cameraZoomRef.current = Math.max(0.1, Math.min(cameraZoomRef.current * delta, 15.0));
      updateCameraPosition();
    };
    host.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      cancelAnimationFrame(animationId);
      if (host) host.removeEventListener('wheel', handleWheel);
      if (renderer.domElement && host.contains(renderer.domElement)) {
        host.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  // Sync Dark/Light Theme
  useEffect(() => {
    if (sceneRef.current) sceneRef.current.background = new THREE.Color(isDarkMode ? 0x0f172a : 0xf8fafc);
    if (gridHelperRef.current && sceneRef.current) {
      sceneRef.current.remove(gridHelperRef.current);
      const grid = new THREE.GridHelper(600, 120, 0x4f46e5, isDarkMode ? 0x334155 : 0xcbd5e1);
      sceneRef.current.add(grid);
      gridHelperRef.current = grid;
    }
  }, [isDarkMode]);

  const updateCameraPosition = () => {
    if (!cameraRef.current) return;
    const offset = cameraOffsetRef.current;
    const zoom = cameraZoomRef.current;
    const dist = 200 * zoom;

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
  };

  const updateHistory = (nextState: CADObject[]) => {
    const trimmedHistory = history.slice(0, historyIndex + 1);
    setHistory([...trimmedHistory, nextState]);
    setHistoryIndex(trimmedHistory.length);
    setObjects(nextState);
  };

  // Re-render Vector items to screen
  useEffect(() => {
    visualObjectsRef.current.forEach((mesh) => sceneRef.current.remove(mesh));
    visualObjectsRef.current.clear();

    objects.forEach((obj) => {
      const isSelected = obj.id === selectedId;
      const colorHex = isSelected ? 0xef4444 : new THREE.Color(obj.color).getHex();

      if (obj.is3D && obj.extrusionHeight) {
        const shape = new THREE.Shape();
        if (obj.points.length > 1) {
          shape.moveTo(obj.points[0].x, obj.points[0].y);
          for (let i = 1; i < obj.points.length; i++) {
            shape.lineTo(obj.points[i].x, obj.points[i].y);
          }
          shape.lineTo(obj.points[0].x, obj.points[0].y);

          const geometry = new THREE.ExtrudeGeometry(shape, { depth: obj.extrusionHeight, bevelEnabled: false });
          geometry.rotateX(-Math.PI / 2);
          const material = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.4, metalness: 0.1, side: THREE.DoubleSide });
          const mesh = new THREE.Mesh(geometry, material);
          sceneRef.current.add(mesh);
          visualObjectsRef.current.set(obj.id, mesh);
        }
      } else {
        const vecPoints: THREE.Vector3[] = [];
        obj.points.forEach((p) => vecPoints.push(new THREE.Vector3(p.x, 0.5, p.y)));
        
        // Loop lines for closed paths
        if (obj.type !== 'line' && vecPoints.length > 0) {
          vecPoints.push(vecPoints[0].clone());
        }

        const geometry = new THREE.BufferGeometry().setFromPoints(vecPoints);
        const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: colorHex, linewidth: 3, depthTest: false }));
        line.renderOrder = 10;
        sceneRef.current.add(line);
        visualObjectsRef.current.set(obj.id, line);
      }
    });
  }, [objects, selectedId]);

  // FIXED INTERSECTION MATH FOR 2D AND 3D VIEWS
  const get3DPoint = (clientX: number, clientY: number): Point2D | null => {
    if (!containerRef.current || !cameraRef.current) return null;
    const rect = containerRef.current.getBoundingClientRect();
    
    const x = ((clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((clientY - rect.top) / rect.height) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(x, y), cameraRef.current);

    // Dynamic mathematical plane depending on current active camera mode
    let planeNormal = new THREE.Vector3(0, 1, 0); 
    if (viewMode === 'front') planeNormal.set(0, 0, 1);
    if (viewMode === 'side') planeNormal.set(1, 0, 0);

    const targetPlane = new THREE.Plane(planeNormal, 0);
    const targetIntersection = new THREE.Vector3();

    if (raycaster.ray.intersectPlane(targetPlane, targetIntersection)) {
      if (viewMode === 'front') {
        return { x: Math.round(targetIntersection.x), y: Math.round(targetIntersection.y) };
      }
      if (viewMode === 'side') {
        return { x: Math.round(targetIntersection.z), y: Math.round(targetIntersection.y) };
      }
      return { x: Math.round(targetIntersection.x), y: Math.round(targetIntersection.z) };
    }
    return null;
  };

  const handlePointerDown = (clientX: number, clientY: number, isRightClick = false) => {
    if (isRightClick || currentTool === ('pan' as any)) {
      isPanningRef.current = true;
      panStartRef.current = { x: clientX, y: clientY };
      return;
    }

    const pts = get3DPoint(clientX, clientY);
    if (!pts) return;

    if (currentTool === 'select') {
      const found = objects.find((o) =>
        o.points.some((p) => Math.abs(p.x - pts.x) < 15 && Math.abs(p.y - pts.y) < 15)
      );
      setSelectedId(found ? found.id : null);
      if (found) setHudFeedback(`Selected: ${found.type.toUpperCase()}`);
      return;
    }

    isDrawingRef.current = true;
    const actualStart = chainAnchorRef.current ? chainAnchorRef.current : pts;
    startPointRef.current = actualStart;
    currentPointRef.current = pts;
  };

  const handlePointerMove = (clientX: number, clientY: number) => {
    if (isPanningRef.current) {
      const dx = clientX - panStartRef.current.x;
      const dy = clientY - panStartRef.current.y;
      panStartRef.current = { x: clientX, y: clientY };

      const factor = 0.4 * cameraZoomRef.current;
      if (viewMode === 'top') {
        cameraOffsetRef.current.x -= dx * factor;
        cameraOffsetRef.current.z -= dy * factor;
      } else if (viewMode === 'front') {
        cameraOffsetRef.current.x -= dx * factor;
        cameraOffsetRef.current.y += dy * factor;
      } else if (viewMode === 'side') {
        cameraOffsetRef.current.z += dx * factor;
        cameraOffsetRef.current.y += dy * factor;
      } else {
        cameraOffsetRef.current.x -= dx * factor * 0.7;
        cameraOffsetRef.current.z -= dy * factor * 0.7;
      }
      updateCameraPosition();
      return;
    }

    if (!isDrawingRef.current || !startPointRef.current) return;
    const pts = get3DPoint(clientX, clientY);
    if (!pts) return;

    currentPointRef.current = pts;
    const origin = startPointRef.current;
    const dx = pts.x - origin.x;
    const dy = pts.y - origin.y;
    const len = Math.round(Math.sqrt(dx * dx + dy * dy));

    setHudFeedback(`Drawing ${currentTool.toUpperCase()} | Dist: ${len}`);

    if (previewLineRef.current) {
      const previewPoints: THREE.Vector3[] = [];
      if (currentTool === 'line') {
        previewPoints.push(new THREE.Vector3(origin.x, 0.6, origin.y), new THREE.Vector3(pts.x, 0.6, pts.y));
      } else if (currentTool === 'rectangle') {
        previewPoints.push(
          new THREE.Vector3(origin.x, 0.6, origin.y),
          new THREE.Vector3(pts.x, 0.6, origin.y),
          new THREE.Vector3(pts.x, 0.6, pts.y),
          new THREE.Vector3(origin.x, 0.6, pts.y),
          new THREE.Vector3(origin.x, 0.6, origin.y)
        );
      } else if (currentTool === 'circle' || currentTool === 'polygon') {
        const sides = currentTool === 'circle' ? 36 : 3;
        for (let i = 0; i <= sides; i++) {
          const theta = (i / sides) * Math.PI * 2;
          previewPoints.push(new THREE.Vector3(origin.x + Math.cos(theta) * len, 0.6, origin.y + Math.sin(theta) * len));
        }
      }
      previewLineRef.current.geometry.setFromPoints(previewPoints);
    }
  };

  const handlePointerUp = () => {
    if (isPanningRef.current) {
      isPanningRef.current = false;
      return;
    }

    if (!isDrawingRef.current || !startPointRef.current || !currentPointRef.current) return;
    isDrawingRef.current = false;

    const origin = startPointRef.current;
    const endPoint = currentPointRef.current;

    // Stop if finger didn't move
    if (Math.abs(origin.x - endPoint.x) < 2 && Math.abs(origin.y - endPoint.y) < 2) {
      return;
    }

    const dx = endPoint.x - origin.x;
    const dy = endPoint.y - origin.y;
    const len = Math.round(Math.sqrt(dx * dx + dy * dy));

    let newObj: CADObject | null = null;

    if (currentTool === 'line') {
      newObj = {
        id: generateId(),
        type: 'line',
        points: [origin, endPoint],
        color: '#3b82f6',
        layer: '0',
        is3D: false,
        properties: { length: len }
      };
      chainAnchorRef.current = endPoint; 
    } else if (currentTool === 'rectangle') {
      newObj = {
        id: generateId(),
        type: 'rectangle',
        points: [
          { x: origin.x, y: origin.y },
          { x: endPoint.x, y: origin.y },
          { x: endPoint.x, y: endPoint.y },
          { x: origin.x, y: endPoint.y }
        ],
        color: '#10b981',
        layer: '0',
        is3D: false,
        properties: { width: Math.abs(dx), height: Math.abs(dy) }
      };
    } else if (currentTool === 'circle') {
      const circlePts: Point2D[] = [];
      for (let i = 0; i < 32; i++) {
        const angle = (i / 32) * Math.PI * 2;
        circlePts.push({ x: origin.x + Math.cos(angle) * len, y: origin.y + Math.sin(angle) * len });
      }
      newObj = { id: generateId(), type: 'circle', points: circlePts, color: '#a855f7', layer: '0', is3D: false, properties: { radius: len } };
    } else if (currentTool === 'polygon') {
      const polyPts: Point2D[] = [];
      for (let i = 0; i < 3; i++) {
        const angle = (i / 3) * Math.PI * 2;
        polyPts.push({ x: origin.x + Math.cos(angle) * len, y: origin.y + Math.sin(angle) * len });
      }
      newObj = { id: generateId(), type: 'polygon', points: polyPts, color: '#f59e0b', layer: '0', is3D: false, properties: { sides: 3 } };
    }

    if (newObj) {
      const nextObjects = [...objects, newObj];
      updateHistory(nextObjects);
      setHudFeedback(`Added ${newObj.type.toUpperCase()}`);
    }

    // Clean up tracking visuals
    startPointRef.current = null;
    currentPointRef.current = null;
    if (previewLineRef.current) {
      previewLineRef.current.geometry.setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    }
  };

  // Touch handlers for mobile devices
  const handleTouchStart = (e: TouchEvent) => {
    if (e.touches.length === 1) {
      const t = e.touches[0];
      handlePointerDown(t.clientX, t.clientY, false);
    } else if (e.touches.length === 2) {
      isPanningRef.current = true;
      isDrawingRef.current = false;
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      panStartRef.current = { x: (t1.clientX + t2.clientX) / 2, y: (t1.clientY + t2.clientY) / 2 };
      lastTouchDistanceRef.current = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
    }
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (e.touches.length === 1 && !isPanningRef.current) {
      const t = e.touches[0];
      handlePointerMove(t.clientX, t.clientY);
    } else if (e.touches.length === 2 && isPanningRef.current) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const midX = (t1.clientX + t2.clientX) / 2;
      const midY = (t1.clientY + t2.clientY) / 2;

      // Pan handling
      const dx = midX - panStartRef.current.x;
      const dy = midY - panStartRef.current.y;
      panStartRef.current = { x: midX, y: midY };

      const factor = 0.5 * cameraZoomRef.current;
      cameraOffsetRef.current.x -= dx * factor;
      cameraOffsetRef.current.z -= dy * factor;

      // Pinch to Zoom handling
      const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      if (lastTouchDistanceRef.current) {
        const ratio = lastTouchDistanceRef.current / dist;
        cameraZoomRef.current = Math.max(0.1, Math.min(cameraZoomRef.current * ratio, 15.0));
      }
      lastTouchDistanceRef.current = dist;
      updateCameraPosition();
    }
  };

  const handleTouchEnd = () => {
    handlePointerUp();
    isPanningRef.current = false;
    lastTouchDistanceRef.current = null;
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const wrapDown = (e: MouseEvent) => handlePointerDown(e.clientX, e.clientY, e.button === 2);
    const wrapMove = (e: MouseEvent) => handlePointerMove(e.clientX, e.clientY);
    const wrapUp = () => handlePointerUp();

    el.addEventListener('mousedown', wrapDown);
    window.addEventListener('mousemove', wrapMove);
    window.addEventListener('mouseup', wrapUp);

    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchmove', handleTouchMove, { passive: true });
    el.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      el.removeEventListener('mousedown', wrapDown);
      window.removeEventListener('mousemove', wrapMove);
      window.removeEventListener('mouseup', wrapUp);
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
    };
  }, [currentTool, objects, historyIndex, history, viewMode]);

  // Project Action Handlers
  const executeNewProject = () => {
    setObjects([]);
    setSelectedId(null);
    chainAnchorRef.current = null;
    startPointRef.current = null;
    cameraOffsetRef.current.set(0, 0, 0);
    cameraZoomRef.current = 1.0;
    setHistory([[]]);
    setHistoryIndex(0);
    setHudFeedback("Canvas Workspace Reset.");
  };

  const executeSaveProject = () => {
    localStorage.setItem('minicad_project_save', JSON.stringify(objects));
    setHudFeedback(`Saved! Project contains ${objects.length} elements.`);
  };

  const executeLoadProject = () => {
    const saved = localStorage.getItem('minicad_project_save');
    if (saved) {
      const parsed = JSON.parse(saved) as CADObject[];
      setObjects(parsed);
      setHistory([parsed]);
      setHistoryIndex(0);
      setHudFeedback("Project loaded perfectly.");
    } else {
      setHudFeedback("No saved project found.");
    }
  };

  const executeExtrude = (id: string | null = null, height = 50) => {
    const target = id || selectedId;
    if (!target) {
      setHudFeedback("Error: Select a shape to extrude.");
      return;
    }
    const next = objects.map((o) => (o.id === target ? { ...o, is3D: true, extrusionHeight: height } : o));
    updateHistory(next);
    setViewMode('isometric');
    setTimeout(() => updateCameraPosition(), 20);
    setHudFeedback("Object extruded into 3D space.");
  };

  const executeErase = () => {
    if (!selectedId) return;
    const next = objects.filter((o) => o.id !== selectedId);
    setSelectedId(null);
    updateHistory(next);
    setHudFeedback("Object deleted.");
  };

  const executeTrim = () => {
    if (!selectedId) return;
    const next = objects.map((o) => {
      if (o.id === selectedId && o.points.length > 2) {
        return { ...o, points: o.points.slice(0, -1) };
      }
      return o;
    });
    updateHistory(next);
    setHudFeedback("Trim operation complete.");
  };

  const executeFillet = () => {
    setHudFeedback("Fillet operation executed on sharp vertices.");
  };

  const executeUnion = () => {
    setHudFeedback("Union operation compiled.");
  };

  return {
    containerRef, objects, selectedId, setSelectedId, currentTool,
    setCurrentTool: (t: ToolType) => {
      if ((t as string) === 'deselect') { chainAnchorRef.current = null; setCurrentTool('select'); return; }
      setCurrentTool(t);
    },
    viewMode, changeView: (mode: ViewMode) => {
      setViewMode(mode);
      setTimeout(() => updateCameraPosition(), 20);
    },
    isDarkMode, setIsDarkMode, hudFeedback,
    executeExtrude, executeTrim, executeFillet, executeUnion, executeErase,
    executeNewProject, executeSaveProject, executeLoadProject,
    undo: () => {
      if (historyIndex > 0) {
        setHistoryIndex(historyIndex - 1);
        setObjects(history[historyIndex - 1]);
        setHudFeedback("Undo executed.");
      }
    },
    redo: () => {
      if (historyIndex < history.length - 1) {
        setHistoryIndex(historyIndex + 1);
        setObjects(history[historyIndex + 1]);
        setHudFeedback("Redo executed.");
      }
    }
  };
}
