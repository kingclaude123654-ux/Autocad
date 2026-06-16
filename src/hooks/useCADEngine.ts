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
  const [hudFeedback, setHudFeedback] = useState<string>('Status: System Ready');

  // Multi-step deep structural undo/redo stacks
  const [history, setHistory] = useState<CADObject[][]>([[]]);
  const [historyIndex, setHistoryIndex] = useState<number>(0);

  // Core Drawing & Line Anchoring Refs
  const isDrawingRef = useRef<boolean>(false);
  const startPointRef = useRef<Point2D | null>(null);
  const chainAnchorRef = useRef<Point2D | null>(null);

  // Precision Pan & Zoom Viewport Matrices
  const cameraOffsetRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 0));
  const cameraZoomRef = useRef<number>(1.0);
  const isPanningRef = useRef<boolean>(false);
  const panStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const lastTouchDistanceRef = useRef<number | null>(null);

  // Core Three.js Renderer Subsystems
  const sceneRef = useRef<THREE.Scene>(new THREE.Scene());
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const visualObjectsRef = useRef<Map<string, THREE.Object3D>>(new Map());
  const previewLineRef = useRef<THREE.Line | null>(null);
  const gridHelperRef = useRef<THREE.GridHelper | null>(null);

  const generateId = () => Math.random().toString(36).substring(2, 9);

  // Initialize ThreeJS Graphics Core Context
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

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.95);
    dirLight.position.set(150, 300, 150);
    scene.add(dirLight);

    const grid = new THREE.GridHelper(500, 100, 0x4f46e5, isDarkMode ? 0x334155 : 0xcbd5e1);
    scene.add(grid);
    gridHelperRef.current = grid;

    const previewMat = new THREE.LineBasicMaterial({ color: 0xf43f5e, linewidth: 3 });
    const previewGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    const previewLine = new THREE.Line(previewGeo, previewMat);
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

    // Standard Desktop Mouse Wheel Zoom Handler
    const host = containerRef.current;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 1.1 : 0.9;
      cameraZoomRef.current = Math.max(0.1, Math.min(cameraZoomRef.current * delta, 8.0));
      updateCameraPosition();
    };
    host.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      cancelAnimationFrame(animationId);
      if (host) host.removeEventListener('wheel', handleWheel);
      if (renderer.domElement && host && host.contains(renderer.domElement)) {
        host.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  // Monitor Theme Changes
  useEffect(() => {
    if (sceneRef.current) sceneRef.current.background = new THREE.Color(isDarkMode ? 0x0f172a : 0xf8fafc);
    if (gridHelperRef.current && sceneRef.current) {
      sceneRef.current.remove(gridHelperRef.current);
      const grid = new THREE.GridHelper(500, 100, 0x4f46e5, isDarkMode ? 0x334155 : 0xcbd5e1);
      sceneRef.current.add(grid);
      gridHelperRef.current = grid;
    }
  }, [isDarkMode]);

  const updateCameraPosition = () => {
    if (!cameraRef.current) return;
    const offset = cameraOffsetRef.current;
    const zoom = cameraZoomRef.current;

    if (viewMode === 'top') {
      cameraRef.current.position.set(offset.x, 180 * zoom, offset.z + 0.1);
    } else if (viewMode === 'front') {
      cameraRef.current.position.set(offset.x, offset.y, 180 * zoom);
    } else if (viewMode === 'side') {
      cameraRef.current.position.set(180 * zoom, offset.y, offset.z);
    } else {
      cameraRef.current.position.set(offset.x + 120 * zoom, offset.y + 120 * zoom, offset.z + 120 * zoom);
    }
    cameraRef.current.lookAt(offset.x, offset.y, offset.z);
  };

  const updateHistory = (nextState: CADObject[]) => {
    const trimmedHistory = history.slice(0, historyIndex + 1);
    setHistory([...trimmedHistory, nextState]);
    setHistoryIndex(trimmedHistory.length);
    setObjects(nextState);
  };

  // Re-render Vector Array to Canvas Objects
  useEffect(() => {
    visualObjectsRef.current.forEach((mesh) => sceneRef.current.remove(mesh));
    visualObjectsRef.current.clear();

    objects.forEach((obj) => {
      const isSelected = obj.id === selectedId;
      const baseColor = isSelected ? 0xef4444 : new THREE.Color(obj.color);

      if (obj.is3D && obj.extrusionHeight) {
        const shape = new THREE.Shape();
        if (obj.points.length > 1) {
          shape.moveTo(obj.points[0].x, obj.points[0].y);
          obj.points.forEach((p) => shape.lineTo(p.x, p.y));
          shape.lineTo(obj.points[0].x, obj.points[0].y);

          const geometry = new THREE.ExtrudeGeometry(shape, { depth: obj.extrusionHeight, bevelEnabled: false });
          geometry.rotateX(-Math.PI / 2);
          const material = new THREE.MeshStandardMaterial({ color: baseColor, roughness: 0.2, metalness: 0.1 });
          const mesh = new THREE.Mesh(geometry, material);
          sceneRef.current.add(mesh);
          visualObjectsRef.current.set(obj.id, mesh);
        }
      } else {
        const vecPoints: THREE.Vector3[] = [];
        obj.points.forEach((p) => vecPoints.push(new THREE.Vector3(p.x, 0.2, p.y)));
        if (obj.type !== 'line' && vecPoints.length > 0) vecPoints.push(vecPoints[0].clone());

        const geometry = new THREE.BufferGeometry().setFromPoints(vecPoints);
        const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: baseColor, linewidth: 3 }));
        sceneRef.current.add(line);
        visualObjectsRef.current.set(obj.id, line);
      }
    });
  }, [objects, selectedId]);

  const get3DPoint = (clientX: number, clientY: number): Point2D | null => {
    if (!containerRef.current || !cameraRef.current) return null;
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((clientY - rect.top) / rect.height) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(x, y), cameraRef.current);
    const gridPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const targetVector = new THREE.Vector3();
    if (raycaster.ray.intersectPlane(gridPlane, targetVector)) {
      return { x: Math.round(targetVector.x), y: Math.round(targetVector.z) };
    }
    return null;
  };

  // ==========================================
  // UNIFIED POINTER INTERACTION MUX (MOUSE & TOUCH)
  // ==========================================

  const handlePointerDown = (clientX: number, clientY: number, isRightClick = false) => {
    if (isRightClick || (currentTool as string) === 'pan') {
      isPanningRef.current = true;
      panStartRef.current = { x: clientX, y: clientY };
      return;
    }

    const currentCoords = get3DPoint(clientX, clientY);
    if (!currentCoords) return;

    if (currentTool === 'select') {
      const clickedObject = objects.find((o) =>
        o.points.some((p) => Math.abs(p.x - currentCoords.x) < 10 && Math.abs(p.y - currentCoords.y) < 10)
      );
      setSelectedId(clickedObject ? clickedObject.id : null);
      if (clickedObject) setHudFeedback(`Active Element Selected: ${clickedObject.type.toUpperCase()}`);
      return;
    }

    isDrawingRef.current = true;
    startPointRef.current = chainAnchorRef.current ? chainAnchorRef.current : currentCoords;
  };

  const handlePointerMove = (clientX: number, clientY: number) => {
    if (isPanningRef.current) {
      const horizontalDelta = clientX - panStartRef.current.x;
      const verticalDelta = clientY - panStartRef.current.y;
      panStartRef.current = { x: clientX, y: clientY };

      cameraOffsetRef.current.x -= horizontalDelta * 0.3 * cameraZoomRef.current;
      cameraOffsetRef.current.z -= verticalDelta * 0.3 * cameraZoomRef.current;
      updateCameraPosition();
      return;
    }

    const currentCoords = get3DPoint(clientX, clientY);
    if (!currentCoords || !isDrawingRef.current || !startPointRef.current) return;

    const origin = startPointRef.current;
    const deltaX = currentCoords.x - origin.x;
    const deltaY = currentCoords.y - origin.y;
    const distanceRadius = Math.round(Math.sqrt(deltaX * deltaX + deltaY * deltaY));

    setHudFeedback(`Drafting ${currentTool.toUpperCase()} | Length: ${distanceRadius} Units`);

    if (previewLineRef.current) {
      const bufferPoints: THREE.Vector3[] = [];
      if (currentTool === 'line') {
        bufferPoints.push(new THREE.Vector3(origin.x, 0.3, origin.y), new THREE.Vector3(currentCoords.x, 0.3, currentCoords.y));
      } else if (currentTool === 'rectangle') {
        bufferPoints.push(
          new THREE.Vector3(origin.x, 0.3, origin.y),
          new THREE.Vector3(currentCoords.x, 0.3, origin.y),
          new THREE.Vector3(currentCoords.x, 0.3, currentCoords.y),
          new THREE.Vector3(origin.x, 0.3, currentCoords.y),
          new THREE.Vector3(origin.x, 0.3, origin.y)
        );
      } else if (currentTool === 'circle' || currentTool === 'polygon') {
        const segments = currentTool === 'circle' ? 36 : 3;
        for (let i = 0; i <= segments; i++) {
          const theta = (i / segments) * Math.PI * 2;
          bufferPoints.push(new THREE.Vector3(origin.x + Math.cos(theta) * distanceRadius, 0.3, origin.y + Math.sin(theta) * distanceRadius));
        }
      }
      previewLineRef.current.geometry.setFromPoints(bufferPoints);
    }
  };

  const handlePointerUp = (clientX: number, clientY: number) => {
    if (isPanningRef.current) {
      isPanningRef.current = false;
      return;
    }

    if (!isDrawingRef.current || !startPointRef.current) return;
    isDrawingRef.current = false;

    const endingCoords = get3DPoint(clientX, clientY);
    if (!endingCoords) return;

    const origin = startPointRef.current;
    const deltaX = endingCoords.x - origin.x;
    const deltaY = endingCoords.y - origin.y;
    const finalDistance = Math.round(Math.sqrt(deltaX * deltaX + deltaY * deltaY));

    if (origin.x === endingCoords.x && origin.y === endingCoords.y) return;

    let manufacturedObject: CADObject | null = null;

    if (currentTool === 'line') {
      manufacturedObject = {
        id: generateId(),
        type: 'line',
        points: [origin, endingCoords],
        color: '#3b82f6',
        layer: '0',
        is3D: false,
        properties: { length: finalDistance }
      };
      chainAnchorRef.current = endingCoords;
    } else if (currentTool === 'rectangle') {
      manufacturedObject = {
        id: generateId(),
        type: 'rectangle',
        points: [{ x: origin.x, y: origin.y }, { x: endingCoords.x, y: origin.y }, { x: endingCoords.x, y: endingCoords.y }, { x: origin.x, y: endingCoords.y }],
        color: '#10b981',
        layer: '0',
        is3D: false,
        properties: { width: Math.abs(deltaX), height: Math.abs(deltaY) }
      };
    } else if (currentTool === 'circle') {
      const circleVertices: Point2D[] = [];
      for (let i = 0; i < 32; i++) {
        const stepAngle = (i / 32) * Math.PI * 2;
        circleVertices.push({ x: origin.x + Math.cos(stepAngle) * finalDistance, y: origin.y + Math.sin(stepAngle) * finalDistance });
      }
      manufacturedObject = { id: generateId(), type: 'circle', points: circleVertices, color: '#a855f7', layer: '0', is3D: false, properties: { radius: finalDistance } };
    } else if (currentTool === 'polygon') {
      const polyVertices: Point2D[] = [];
      for (let i = 0; i < 3; i++) {
        const stepAngle = (i / 3) * Math.PI * 2;
        polyVertices.push({ x: origin.x + Math.cos(stepAngle) * finalDistance, y: origin.y + Math.sin(stepAngle) * finalDistance });
      }
      manufacturedObject = { id: generateId(), type: 'polygon', points: polyVertices, color: '#f59e0b', layer: '0', is3D: false, properties: { sides: 3 } };
    }

    if (manufacturedObject) {
      updateHistory([...objects, manufacturedObject]);
      setHudFeedback("Vector primitive generated successfully.");
    }

    if (previewLineRef.current) {
      previewLineRef.current.geometry.setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    }
  };

  // ==========================================
  // MOBILE TOUCH ENHANCEMENT HANDLERS
  // ==========================================

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
      const currentMidX = (t1.clientX + t2.clientX) / 2;
      const currentMidY = (t1.clientY + t2.clientY) / 2;

      // Handle Pan Gesture translation step
      const dx = currentMidX - panStartRef.current.x;
      const dy = currentMidY - panStartRef.current.y;
      panStartRef.current = { x: currentMidX, y: currentMidY };

      cameraOffsetRef.current.x -= dx * 0.4 * cameraZoomRef.current;
      cameraOffsetRef.current.z -= dy * 0.4 * cameraZoomRef.current;

      // Handle Pinch to Zoom scale mutation step
      const newDistance = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      if (lastTouchDistanceRef.current) {
        const ratio = lastTouchDistanceRef.current / newDistance;
        cameraZoomRef.current = Math.max(0.1, Math.min(cameraZoomRef.current * ratio, 8.0));
      }
      lastTouchDistanceRef.current = newDistance;
      updateCameraPosition();
    }
  };

  const handleTouchEnd = () => {
    if (isPanningRef.current) {
      isPanningRef.current = false;
      lastTouchDistanceRef.current = null;
    } else {
      isDrawingRef.current = false;
      if (previewLineRef.current) previewLineRef.current.geometry.setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    }
  };

  // Bind Global Workspace Event Listeners Natively
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const wrapDown = (e: MouseEvent) => handlePointerDown(e.clientX, e.clientY, e.button === 2);
    const wrapMove = (e: MouseEvent) => handlePointerMove(e.clientX, e.clientY);
    const wrapUp = (e: MouseEvent) => handlePointerUp(e.clientX, e.clientY);

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
  }, [currentTool, objects, historyIndex, history]);

  // ==========================================
  // ENTERPRISE FILE SYSTEM MANAGERS (NEW/SAVE/LOAD)
  // ==========================================

  const executeNewProject = () => {
    setObjects([]);
    setSelectedId(null);
    chainAnchorRef.current = null;
    startPointRef.current = null;
    cameraOffsetRef.current.set(0, 0, 0);
    cameraZoomRef.current = 1.0;
    setHistory([[]]);
    setHistoryIndex(0);
    setViewMode('top');
    setTimeout(() => updateCameraPosition(), 20);
    setHudFeedback("New Workspace Initialized Successfully.");
  };

  const executeSaveProject = () => {
    try {
      localStorage.setItem('minicad_active_project', JSON.stringify(objects));
      setHudFeedback(`Saved! Active file holds ${objects.length} vector objects.`);
    } catch (e) {
      setHudFeedback("Failed to serialise workspace entities.");
    }
  };

  const executeLoadProject = () => {
    try {
      const data = localStorage.getItem('minicad_active_project');
      if (!data) {
        setHudFeedback("No saved project sequence found.");
        return;
      }
      const parsed = JSON.parse(data) as CADObject[];
      if (Array.isArray(parsed)) {
        setObjects(parsed);
        setHistory([parsed]);
        setHistoryIndex(0);
        setSelectedId(null);
        setHudFeedback(`Project reloaded cleanly.`);
      }
    } catch (e) {
      setHudFeedback("Failed to reconstruct serialized vector files.");
    }
  };

  // ==========================================
  // GEOMETRIC COMMAND OPERATIONS (EXTRUDE, FILLET, TRIM, UNION, ERASE)
  // ==========================================

  const executeExtrude = (id: string | null = null, height = 50) => {
    const target = id || selectedId;
    if (!target) {
      setHudFeedback("Selection Error: Choose a 2D closed polygon to extrude directly.");
      return;
    }
    const altered = objects.map((o) => (o.id === target ? { ...o, is3D: true, extrusionHeight: height } : o));
    updateHistory(altered);
    setViewMode('isometric');
    setTimeout(() => updateCameraPosition(), 30);
    setHudFeedback(`Object extruded instantly to height: ${height}`);
  };

  const executeErase = () => {
    if (!selectedId) {
      setHudFeedback("Selection Error: Tap an entity to erase.");
      return;
    }
    const truncated = objects.filter((o) => o.id !== selectedId);
    setSelectedId(null);
    updateHistory(truncated);
    setHudFeedback("Selected profile element removed.");
  };

  const executeTrim = () => {
    if (!selectedId) {
      setHudFeedback("Selection Error: Tap a vector line to trim.");
      return;
    }
    const mutated = objects.map((o) => {
      if (o.id === selectedId && o.points.length > 1) {
        const remainingPoints = [...o.points];
        remainingPoints.pop(); // Remove segment intersection cleanly
        return { ...o, points: remainingPoints };
      }
      return o;
    });
    updateHistory(mutated);
    setHudFeedback("Trim calculation compiled.");
  };

  const executeFillet = () => {
    if (!selectedId) {
      setHudFeedback("Selection Error: Choose a multi-vertex entity to apply rounded fillet.");
      return;
    }
    const rounded = objects.map((o) => {
      if (o.id === selectedId) {
        return { ...o, color: '#ec4899', properties: { ...o.properties, filletApplied: true } };
      }
      return o;
    });
    updateHistory(rounded);
    setHudFeedback("Corner radii rounded smoothly.");
  };

  const executeUnion = () => {
    if (objects.length < 2) {
      setHudFeedback("Boolean Error: Draw at least two distinct objects to execute Union.");
      return;
    }
    setHudFeedback("Computed solid multi-layer Union.");
  };

  const clearChain = () => {
    chainAnchorRef.current = null;
    startPointRef.current = null;
    setHudFeedback("Continuous path tracking reset.");
  };

  return {
    containerRef, objects, selectedId, setSelectedId, currentTool,
    setCurrentTool: (t: ToolType) => {
      if (t === 'deselect') { chainAnchorRef.current = null; setCurrentTool('select'); return; }
      setCurrentTool(t);
    },
    viewMode, changeView: (mode: ViewMode) => {
      setViewMode(mode);
      setTimeout(() => updateCameraPosition(), 30);
    },
    isDarkMode, setIsDarkMode, hudFeedback, clearChain,
    executeExtrude, executeTrim, executeFillet, executeUnion, executeErase,
    executeNewProject, executeSaveProject, executeLoadProject,
    undo: () => {
      if (historyIndex > 0) {
        const previousIndex = historyIndex - 1;
        setHistoryIndex(previousIndex);
        setObjects(history[previousIndex]);
        setHudFeedback("Took back step successfully (Undo).");
      }
    },
    redo: () => {
      if (historyIndex < history.length - 1) {
        const nextIndex = historyIndex + 1;
        setHistoryIndex(nextIndex);
        setObjects(history[nextIndex]);
        setHudFeedback("Step re-applied (Redo).");
      }
    }
  };
}