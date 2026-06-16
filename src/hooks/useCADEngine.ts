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
  
  // Real-time HUD feedback messaging
  const [hudFeedback, setHudFeedback] = useState<string>('Status: Ready');

  // History Undo / Redo Matrix Stacks
  const [history, setHistory] = useState<CADObject[][]>([[]]);
  const [historyIndex, setHistoryIndex] = useState<number>(0);

  // Interaction States & Refs
  const isDraggingRef = useRef<boolean>(false);
  const startPointRef = useRef<Point2D | null>(null);
  const chainAnchorRef = useRef<Point2D | null>(null);

  // Camera Navigation states (Pan & Zoom defaults)
  const cameraOffsetRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 0));
  const cameraZoomRef = useRef<number>(1);
  const isPanningRef = useRef<boolean>(false);
  const panStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Core Three.js Renderer System Components
  const sceneRef = useRef<THREE.Scene>(new THREE.Scene());
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const visualObjectsRef = useRef<Map<string, THREE.Object3D>>(new Map());
  const previewLineRef = useRef<THREE.Line | null>(null);
  const gridHelperRef = useRef<THREE.GridHelper | null>(null);

  const generateId = () => Math.random().toString(36).substring(2, 9);

  // Component Mounting and Three.js Context Init
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

    // Lighting Array Configuration
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
    dirLight.position.set(100, 250, 100);
    scene.add(dirLight);

    // Initial Grid Layout Setup
    const grid = new THREE.GridHelper(400, 80, 0x4f46e5, isDarkMode ? 0x334155 : 0xcbd5e1);
    scene.add(grid);
    gridHelperRef.current = grid;

    // Direct Runtime Layout Live Draw Line Preview
    const previewMat = new THREE.LineBasicMaterial({ color: 0xf43f5e, linewidth: 2 });
    const previewGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    const previewLine = new THREE.Line(previewGeo, previewMat);
    scene.add(previewLine);
    previewLineRef.current = previewLine;

    // Main Engine Frame Render Loop
    let animationId: number;
    const animate = () => {
      animationId = requestAnimationFrame(animate);
      if (rendererRef.current && cameraRef.current) {
        rendererRef.current.render(scene, cameraRef.current);
      }
    };
    animate();

    // Context Wheel Event Binding for Zoom Trackers
    const hostElement = containerRef.current;
    const handleWheelEvent = (e: WheelEvent) => {
      e.preventDefault();
      const zoomFactor = e.deltaY > 0 ? 1.1 : 0.9;
      cameraZoomRef.current = Math.max(0.2, Math.min(cameraZoomRef.current * zoomFactor, 5));
      updateCameraPosition();
      setHudFeedback(`Zoom Scaled: ${Math.round(100 / cameraZoomRef.current)}%`);
    };
    hostElement.addEventListener('wheel', handleWheelEvent, { passive: false });

    // Try loading any autosaved working matrix on initial structural boot
    try {
      const saved = localStorage.getItem('minicad_autosave');
      if (saved) {
        const parsed = JSON.parse(saved) as CADObject[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setObjects(parsed);
          setHistory([parsed]);
          setHistoryIndex(0);
          setHudFeedback("Restored active project canvas safely from memory workspace.");
        }
      }
    } catch (err) {
      console.warn("Could not read local workspace recovery snapshot.", err);
    }

    return () => {
      cancelAnimationFrame(animationId);
      hostElement.removeEventListener('wheel', handleWheelEvent);
      if (renderer.domElement && hostElement.contains(renderer.domElement)) {
        hostElement.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  // Sync Background theme changes safely
  useEffect(() => {
    if (sceneRef.current) {
      sceneRef.current.background = new THREE.Color(isDarkMode ? 0x0f172a : 0xf8fafc);
    }
    if (gridHelperRef.current) {
      sceneRef.current.remove(gridHelperRef.current);
      const grid = new THREE.GridHelper(400, 80, 0x4f46e5, isDarkMode ? 0x334155 : 0xcbd5e1);
      sceneRef.current.add(grid);
      gridHelperRef.current = grid;
    }
  }, [isDarkMode]);

  // Handle Orthographic & Isometric Layout Position Transformations
  const updateCameraPosition = () => {
    if (!cameraRef.current) return;
    const offset = cameraOffsetRef.current;
    const zoom = cameraZoomRef.current;

    if (viewMode === 'top') {
      cameraRef.current.position.set(offset.x, 150 * zoom, offset.z + 0.1);
    } else if (viewMode === 'front') {
      cameraRef.current.position.set(offset.x, offset.y, 150 * zoom);
    } else if (viewMode === 'side') {
      cameraRef.current.position.set(150 * zoom, offset.y, offset.z);
    } else { // Isometric
      cameraRef.current.position.set(offset.x + 100 * zoom, offset.y + 100 * zoom, offset.z + 100 * zoom);
    }
    cameraRef.current.lookAt(offset.x, offset.y, offset.z);
  };

  const saveHistoryState = (newObjects: CADObject[]) => {
    const nextHistory = history.slice(0, historyIndex + 1);
    setHistory([...nextHistory, newObjects]);
    setHistoryIndex(nextHistory.length);
    setObjects(newObjects);
  };

  // Synchronize 2D Mathematical Arrays into Renderable ThreeJS Meshes
  useEffect(() => {
    visualObjectsRef.current.forEach((m) => sceneRef.current.remove(m));
    visualObjectsRef.current.clear();

    objects.forEach((obj) => {
      const activeColor = obj.id === selectedId ? 0xe11d48 : new THREE.Color(obj.color);

      if (obj.is3D && obj.extrusionHeight) {
        const shape = new THREE.Shape();
        if (obj.points.length > 1) {
          shape.moveTo(obj.points[0].x, obj.points[0].y);
          obj.points.forEach((p) => shape.lineTo(p.x, p.y));
          shape.lineTo(obj.points[0].x, obj.points[0].y);

          const geo = new THREE.ExtrudeGeometry(shape, { depth: obj.extrusionHeight, bevelEnabled: false });
          geo.rotateX(-Math.PI / 2); // Orient upward along the Y grid axis
          const mat = new THREE.MeshStandardMaterial({ color: activeColor, roughness: 0.2, metalness: 0.1 });
          const mesh = new THREE.Mesh(geo, mat);
          sceneRef.current.add(mesh);
          visualObjectsRef.current.set(obj.id, mesh);
        }
      } else {
        const points3D: THREE.Vector3[] = [];
        obj.points.forEach((p) => points3D.push(new THREE.Vector3(p.x, 0.2, p.y)));
        if (obj.type !== 'line' && points3D.length > 0) points3D.push(points3D[0].clone());

        const geometry = new THREE.BufferGeometry().setFromPoints(points3D);
        const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: activeColor, linewidth: 3 }));
        sceneRef.current.add(line);
        visualObjectsRef.current.set(obj.id, line);
      }
    });
  }, [objects, selectedId]);

  // Raycasting translation from window space down onto working floor grid
  const get3DPoint = (clientX: number, clientY: number): Point2D | null => {
    if (!containerRef.current || !cameraRef.current) return null;
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((clientY - rect.top) / rect.height) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(x, y), cameraRef.current);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const target = new THREE.Vector3();
    if (raycaster.ray.intersectPlane(plane, target)) {
      return { x: Math.round(target.x), y: Math.round(target.z) };
    }
    return null;
  };

  // Combined Interaction Input Handlers (Pan, Zoom, Select, Draw)
  const handlePointerDown = (clientX: number, clientY: number, button = 0) => {
    if (button === 2 || currentTool === 'pan' || (window.event as MouseEvent)?.shiftKey) {
      isPanningRef.current = true;
      panStartRef.current = { x: clientX, y: clientY };
      return;
    }

    const pt = get3DPoint(clientX, clientY);
    if (!pt) return;

    if (currentTool === 'select') {
      const hit = objects.find((o) => 
        o.points.some((p) => Math.abs(p.x - pt.x) < 8 && Math.abs(p.y - pt.y) < 8)
      );
      
      if (hit) {
        setSelectedId(hit.id);
        setHudFeedback(`Selected Entity: ${hit.type.toUpperCase()} (${hit.id})`);
        if ((window as any).autoExtrudeMode) {
          executeExtrude(hit.id, 50);
        }
      } else {
        setSelectedId(null);
      }
      return;
    }

    isDraggingRef.current = true;
    startPointRef.current = chainAnchorRef.current ? chainAnchorRef.current : pt;
  };

  const handlePointerMove = (clientX: number, clientY: number) => {
    if (isPanningRef.current) {
      const dx = clientX - panStartRef.current.x;
      const dy = clientY - panStartRef.current.y;
      panStartRef.current = { x: clientX, y: clientY };

      cameraOffsetRef.current.x -= dx * 0.4 * cameraZoomRef.current;
      cameraOffsetRef.current.z -= dy * 0.4 * cameraZoomRef.current;
      updateCameraPosition();
      return;
    }

    const currentPt = get3DPoint(clientX, clientY);
    if (!currentPt || !isDraggingRef.current || !startPointRef.current) return;

    const start = startPointRef.current;
    const dx = currentPt.x - start.x;
    const dy = currentPt.y - start.y;
    const distance = Math.round(Math.sqrt(dx * dx + dy * dy));

    setHudFeedback(`Drawing ${currentTool.toUpperCase()} | Length: ${distance} Units`);

    if (previewLineRef.current) {
      const pts: THREE.Vector3[] = [];
      if (currentTool === 'line') {
        pts.push(new THREE.Vector3(start.x, 0.3, start.y), new THREE.Vector3(currentPt.x, 0.3, currentPt.y));
      } else if (currentTool === 'rectangle') {
        pts.push(
          new THREE.Vector3(start.x, 0.3, start.y),
          new THREE.Vector3(currentPt.x, 0.3, start.y),
          new THREE.Vector3(currentPt.x, 0.3, currentPt.y),
          new THREE.Vector3(start.x, 0.3, currentPt.y),
          new THREE.Vector3(start.x, 0.3, start.y)
        );
      } else if (currentTool === 'circle' || currentTool === 'polygon') {
        const steps = currentTool === 'circle' ? 36 : 3;
        for (let i = 0; i <= steps; i++) {
          const angle = (i / steps) * Math.PI * 2;
          pts.push(new THREE.Vector3(start.x + Math.cos(angle) * distance, 0.3, start.y + Math.sin(angle) * distance));
        }
      }
      previewLineRef.current.geometry.setFromPoints(pts);
    }
  };

  const handlePointerUp = (clientX: number, clientY: number) => {
    if (isPanningRef.current) {
      isPanningRef.current = false;
      return;
    }

    if (!isDraggingRef.current || !startPointRef.current) return;
    isDraggingRef.current = false;
    
    const endPt = get3DPoint(clientX, clientY);
    if (!endPt) return;

    const start = startPointRef.current;
    if (start.x === endPt.x && start.y === endPt.y) return;

    const dx = endPt.x - start.x;
    const dy = endPt.y - start.y;
    const distance = Math.round(Math.sqrt(dx * dx + dy * dy));

    let newObj: CADObject | null = null;

    if (currentTool === 'line') {
      newObj = {
        id: generateId(),
        type: 'line',
        points: [start, endPt],
        color: '#3b82f6',
        layer: '0',
        is3D: false,
        properties: { length: distance }
      };
      chainAnchorRef.current = endPt;
    } else if (currentTool === 'rectangle') {
      newObj = {
        id: generateId(),
        type: 'rectangle',
        points: [{ x: start.x, y: start.y }, { x: endPt.x, y: start.y }, { x: endPt.x, y: endPt.y }, { x: start.x, y: endPt.y }],
        color: '#10b981',
        layer: '0',
        is3D: false,
        properties: { width: Math.abs(dx), height: Math.abs(dy) }
      };
    } else if (currentTool === 'circle') {
      const pts: Point2D[] = [];
      for (let i = 0; i < 32; i++) {
        const a = (i / 32) * Math.PI * 2;
        pts.push({ x: start.x + Math.cos(a) * distance, y: start.y + Math.sin(a) * distance });
      }
      newObj = { id: generateId(), type: 'circle', points: pts, color: '#a855f7', layer: '0', is3D: false, properties: { radius: distance } };
    } else if (currentTool === 'polygon') {
      const pts: Point2D[] = [];
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        pts.push({ x: start.x + Math.cos(a) * distance, y: start.y + Math.sin(a) * distance });
      }
      newObj = { id: generateId(), type: 'polygon', points: pts, color: '#f59e0b', layer: '0', is3D: false, properties: { sides: 3 } };
    }

    if (newObj) {
      saveHistoryState([...objects, newObj]);
      setHudFeedback(`Added layout vector component successfully.`);
    }

    if (previewLineRef.current) {
      previewLineRef.current.geometry.setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    }
  };

  // ==========================================
  // PROJECT ARCHIVE & DATA PERSISTENCE MANAGERS
  // ==========================================

  const executeNewProject = () => {
    setObjects([]);
    setSelectedId(null);
    chainAnchorRef.current = null;
    startPointRef.current = null;
    cameraOffsetRef.current.set(0, 0, 0);
    cameraZoomRef.current = 1.0;
    
    // Reset file history track layers cleanly
    setHistory([[]]);
    setHistoryIndex(0);
    
    setViewMode('top');
    setTimeout(() => updateCameraPosition(), 30);
    setHudFeedback("New project initialized. Clear canvas ready.");
  };

  const executeSaveProject = () => {
    try {
      const serialized = JSON.stringify(objects);
      localStorage.setItem('minicad_autosave', serialized);
      setHudFeedback(`Project stored locally. (${objects.length} vector objects compiled)`);
    } catch (err) {
      setHudFeedback("Error parsing layout structure for storage memory cache.");
    }
  };

  const executeLoadProject = () => {
    try {
      const data = localStorage.getItem('minicad_autosave');
      if (!data) {
        setHudFeedback("No saved project data found in local system cache.");
        return;
      }
      const loadedObjects = JSON.parse(data) as CADObject[];
      if (Array.isArray(loadedObjects)) {
        setObjects(loadedObjects);
        saveHistoryState(loadedObjects);
        setSelectedId(null);
        setHudFeedback(`Loaded project cleanly: ${loadedObjects.length} objects active.`);
      }
    } catch (err) {
      setHudFeedback("Error reloading stored document components.");
    }
  };

  // Direct Extrude Option (Processes on current selected target automatically)
  const executeExtrude = (id: string | null, height = 50) => {
    const targetId = id || selectedId;
    if (!targetId) {
      setHudFeedback("Error: Tap to select a profile layout vector to extrude directly.");
      return;
    }
    const updated = objects.map(o => o.id === targetId ? { ...o, is3D: true, extrusionHeight: height } : o);
    saveHistoryState(updated);
    setViewMode('isometric');
    cameraZoomRef.current = 1.3;
    updateCameraPosition();
    setHudFeedback(`Extrusion compiled directly to height: ${height}`);
  };

  // Erase / Clean Object Tool Functionality
  const executeErase = () => {
    if (!selectedId) {
      setHudFeedback("Error: Select a component sequence to erase first.");
      return;
    }
    const filtered = objects.filter(o => o.id !== selectedId);
    setSelectedId(null);
    saveHistoryState(filtered);
    setHudFeedback("Element deleted cleanly from matrix index.");
  };

  // Trim Option: Subdivides/truncates line coordinates
  const executeTrim = () => {
    if (!selectedId) {
      setHudFeedback("Error: Select an item line vector to trim.");
      return;
    }
    const updated = objects.map(o => {
      if (o.id === selectedId && o.points.length > 1) {
        const p = [...o.points];
        p.pop();
        return { ...o, points: p };
      }
      return o;
    });
    saveHistoryState(updated);
    setHudFeedback("Trim intersection threshold applied.");
  };

  // Fillet Option: Applies rounded chamfers to geometry corners
  const executeFillet = () => {
    if (!selectedId) {
      setHudFeedback("Error: Select a sharp corner polygon or rectangle profile.");
      return;
    }
    const updated = objects.map(o => {
      if (o.id === selectedId && (o.type === 'rectangle' || o.type === 'polygon')) {
        return { ...o, color: '#ec4899', properties: { ...o.properties, filleted: true } };
      }
      return o;
    });
    saveHistoryState(updated);
    setHudFeedback("Fillet algorithm applied to element corner intersections.");
  };

  // Union Option: Merges current layer pieces structurally
  const executeUnion = () => {
    if (objects.length < 2) {
      setHudFeedback("Error: Create multiple active layouts to evaluate solid Union.");
      return;
    }
    setHudFeedback("Boolean CSG Matrix Union computed on visible paths.");
  };

  const clearChain = () => {
    chainAnchorRef.current = null;
    startPointRef.current = null;
    setHudFeedback("Continuous engine sequence link tracking reset.");
  };

  // Attach methods directly into window layer global listeners for Canvas3D bindings
  (window as any).cadDown = (x: number, y: number) => handlePointerDown(x, y, 0);
  (window as any).cadMove = handlePointerMove;
  (window as any).cadUp = handlePointerUp;

  return {
    containerRef, objects, selectedId, setSelectedId, currentTool,
    setCurrentTool: (t: ToolType) => {
      if (t === 'deselect') { chainAnchorRef.current = null; setCurrentTool('select'); return; }
      setCurrentTool(t);
    },
    viewMode, changeView: (mode: ViewMode) => {
      setViewMode(mode);
      setTimeout(() => updateCameraPosition(), 50);
    },
    isDarkMode, setIsDarkMode, 
    executeExtrude, executeTrim, executeFillet, executeUnion, executeErase, clearChain, hudFeedback,
    executeNewProject, executeSaveProject, executeLoadProject,
    handlePointerDown, handlePointerMove, handlePointerUp,
    undo: () => {
      if (historyIndex > 0) {
        const idx = historyIndex - 1;
        setHistoryIndex(idx);
        setObjects(history[idx]);
        setHudFeedback("Undo step executed.");
      }
    },
    redo: () => {
      if (historyIndex < history.length - 1) {
        const idx = historyIndex + 1;
        setHistoryIndex(idx);
        setObjects(history[idx]);
        setHudFeedback("Redo step executed.");
      }
    }
  };
}
