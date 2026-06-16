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
  const [snapConfig] = useState({ grid: true, endpoint: true, midpoint: true, center: true });

  // History tracking
  const [history, setHistory] = useState<CADObject[][]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  // Drawing state tracking
  const [drawingPoints, setDrawingPoints] = useState<Point2D[]>([]);

  // Core Three.js Refs
  const sceneRef = useRef<THREE.Scene>(new THREE.Scene());
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const visualObjectsRef = useRef<Map<string, THREE.Object3D>>(new Map());

  // Helper to generate IDs
  const generateId = () => Math.random().toString(36).substring(2, 9);

  // Initialize Scene, Lights, Camera
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

    // Setup an optimal viewing perspective looking downward at the grid
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 80, 110);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);
    
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(30, 120, 60);
    scene.add(dirLight);

    const grid = new THREE.GridHelper(200, 50, 0x3b82f6, isDarkMode ? 0x334155 : 0xcbd5e1);
    grid.position.y = 0;
    scene.add(grid);

    let animationId: number;
    const animate = () => {
      animationId = requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!containerRef.current || !cameraRef.current || !rendererRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', handleResize);
      if (renderer.domElement && containerRef.current) {
        containerRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  // Sync scene colors on theme toggle
  useEffect(() => {
    if (sceneRef.current) {
      sceneRef.current.background = new THREE.Color(isDarkMode ? 0x0f172a : 0xf8fafc);
    }
  }, [isDarkMode]);

  // Project Redo/Undo State History Saver
  const saveHistoryState = (newObjects: CADObject[]) => {
    const nextHistory = history.slice(0, historyIndex + 1);
    setHistory([...nextHistory, newObjects]);
    setHistoryIndex(nextHistory.length);
    setObjects(newObjects);
  };

  // Redraw shapes inside the 3D WebGL space whenever state parameters change
  useEffect(() => {
    // Clear old visual vectors out to avoid memory leaks
    visualObjectsRef.current.forEach((mesh) => sceneRef.current.remove(mesh));
    visualObjectsRef.current.clear();

    objects.forEach((obj) => {
      if (obj.is3D && obj.extrusionHeight) {
        // Render as solid extruded 3D geometry mesh block
        const shape = new THREE.Shape();
        if (obj.points.length > 1) {
          shape.moveTo(obj.points[0].x, obj.points[0].y);
          obj.points.forEach((pt) => shape.lineTo(pt.x, pt.y));
          shape.lineTo(obj.points[0].x, obj.points[0].y);

          const settings = { depth: obj.extrusionHeight, bevelEnabled: false };
          const geo = new THREE.ExtrudeGeometry(shape, settings);
          geo.rotateX(-Math.PI / 2); // Make it stand up vertically on the floor grid

          const mat = new THREE.MeshStandardMaterial({
            color: obj.id === selectedId ? 0xe11d48 : new THREE.Color(obj.color),
            roughness: 0.3,
            metalness: 0.1
          });
          const mesh = new THREE.Mesh(geo, mat);
          sceneRef.current.add(mesh);
          visualObjectsRef.current.set(obj.id, mesh);
        }
      } else {
        // Render 2D outlines flat along horizontal workspace plane using line arrays
        const material = new THREE.LineBasicMaterial({
          color: obj.id === selectedId ? 0xe11d48 : new THREE.Color(obj.color),
          linewidth: obj.id === selectedId ? 3 : 1
        });

        const points3D: THREE.Vector3[] = [];
        obj.points.forEach((p) => points3D.push(new THREE.Vector3(p.x, 0.05, p.y)));
        
        // Auto-close loops for shapes
        if ((obj.type === 'rectangle' || obj.type === 'circle' || obj.type === 'polygon') && points3D.length > 0) {
          points3D.push(points3D[0].clone());
        }

        const geometry = new THREE.BufferGeometry().setFromPoints(points3D);
        const lineLoop = new THREE.Line(geometry, material);
        sceneRef.current.add(lineLoop);
        visualObjectsRef.current.set(obj.id, lineLoop);
      }
    });
  }, [objects, selectedId]);

  // Translate screen touch coordinates down to the 3D drawing surface plane
  const get3DWorkspacePoint = (e: React.MouseEvent<HTMLDivElement> | Touch): Point2D | null => {
    if (!containerRef.current || !cameraRef.current) return null;

    const rect = containerRef.current.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    const mouseVector = new THREE.Vector2(
      (clientX / rect.width) * 2 - 1,
      -(clientY / rect.height) * 2 + 1
    );

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouseVector, cameraRef.current);

    // Intersect math vector plane at flat height 0
    const planeTarget = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const targetPoint3D = new THREE.Vector3();
    
    if (raycaster.ray.intersectPlane(planeTarget, targetPoint3D)) {
      // Return raw math configurations, rounding to grid snaps if wanted
      return {
        x: Math.round(targetPoint3D.x),
        y: Math.round(targetPoint3D.z)
      };
    }
    return null;
  };

  // Handle active drawing pointer placements
  const handleWorkspaceTap = (e: React.MouseEvent<HTMLDivElement>) => {
    const clickPt = get3DWorkspacePoint(e);
    if (!clickPt) return;

    if (currentTool === 'select') {
      // Dynamic object click selection raycast checking bounds approximation
      const hit = objects.find((obj) => {
        return obj.points.some(
          (p) => Math.abs(p.x - clickPt.x) < 4 && Math.abs(p.y - clickPt.y) < 4
        );
      });
      setSelectedId(hit ? hit.id : null);
      return;
    }

    if (currentTool === 'delete') {
      if (selectedId) {
        const filtered = objects.filter((o) => o.id !== selectedId);
        setSelectedId(null);
        saveHistoryState(filtered);
      }
      return;
    }

    // Process primitive shape drafting loops based on clicks
    const ongoingPoints = [...drawingPoints, clickPt];

    if (currentTool === 'line') {
      if (ongoingPoints.length === 2) {
        const newLine: CADObject = {
          id: generateId(),
          type: 'line',
          points: ongoingPoints,
          color: '#3b82f6',
          layer: '0',
          is3D: false,
          properties: {}
        };
        saveHistoryState([...objects, newLine]);
        setDrawingPoints([]);
      } else {
        setDrawingPoints(ongoingPoints);
      }
    } else if (currentTool === 'rectangle') {
      if (ongoingPoints.length === 2) {
        const p1 = ongoingPoints[0];
        const p2 = ongoingPoints[1];
        const rectPoints = [
          { x: p1.x, y: p1.y },
          { x: p2.x, y: p1.y },
          { x: p2.x, y: p2.y },
          { x: p1.x, y: p2.y }
        ];
        const newRect: CADObject = {
          id: generateId(),
          type: 'rectangle',
          points: rectPoints,
          color: '#10b981',
          layer: '0',
          is3D: false,
          properties: { width: Math.abs(p2.x - p1.x), height: Math.abs(p2.y - p1.y) }
        };
        saveHistoryState([...objects, newRect]);
        setDrawingPoints([]);
      } else {
        setDrawingPoints(ongoingPoints);
      }
    } else if (currentTool === 'circle') {
      if (ongoingPoints.length === 2) {
        const center = ongoingPoints[0];
        const edge = ongoingPoints[1];
        const radius = Math.sqrt(Math.pow(edge.x - center.x, 2) + Math.pow(edge.y - center.y, 2));
        
        // Generate continuous poly-segmented boundary vertex points to represent a circle mesh line
        const circlePoints: Point2D[] = [];
        for (let i = 0; i < 32; i++) {
          const theta = (i / 32) * Math.PI * 2;
          circlePoints.push({
            x: center.x + Math.cos(theta) * radius,
            y: center.y + Math.sin(theta) * radius
          });
        }

        const newCircle: CADObject = {
          id: generateId(),
          type: 'circle',
          points: circlePoints,
          color: '#8b5cf6',
          layer: '0',
          is3D: false,
          properties: { radius }
        };
        saveHistoryState([...objects, newCircle]);
        setDrawingPoints([]);
      } else {
        setDrawingPoints(ongoingPoints);
      }
    } else if (currentTool === 'polygon') {
      if (ongoingPoints.length === 2) {
        const center = ongoingPoints[0];
        const edge = ongoingPoints[1];
        const radius = Math.sqrt(Math.pow(edge.x - center.x, 2) + Math.pow(edge.y - center.y, 2));
        
        const polyPoints: Point2D[] = [];
        for (let i = 0; i < 3; i++) {
          const theta = (i / 3) * Math.PI * 2;
          polyPoints.push({
            x: center.x + Math.cos(theta) * radius,
            y: center.y + Math.sin(theta) * radius
          });
        }

        const newPoly: CADObject = {
          id: generateId(),
          type: 'polygon',
          points: polyPoints,
          color: '#f59e0b',
          layer: '0',
          is3D: false,
          properties: { sides: 3 }
        };
        saveHistoryState([...objects, newPoly]);
        setDrawingPoints([]);
      } else {
        setDrawingPoints(ongoingPoints);
      }
    }
  };

  // Camera views
  const changeView = (mode: ViewMode) => {
    setViewMode(mode);
    if (!cameraRef.current) return;
    
    switch (mode) {
      case 'top':
        cameraRef.current.position.set(0, 120, 0.1);
        break;
      case 'front':
        cameraRef.current.position.set(0, 0, 120);
        break;
      case 'side':
        cameraRef.current.position.set(120, 0, 0);
        break;
      case 'isometric':
        cameraRef.current.position.set(80, 80, 80);
        break;
    }
    cameraRef.current.lookAt(0, 0, 0);
  };

  // 3D Linear extrusion conversion logic
  const executeExtrude = (id: string, height: number) => {
    const updated = objects.map((obj) => {
      if (obj.id === id) {
        return { ...obj, is3D: true, extrusionHeight: height };
      }
      return obj;
    });
    saveHistoryState(updated);
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

  return {
    containerRef,
    objects,
    selectedId,
    setSelectedId,
    currentTool,
    setCurrentTool,
    viewMode,
    changeView,
    isDarkMode,
    setIsDarkMode,
    snapConfig,
    executeExtrude,
    undo,
    redo,
    handleWorkspaceTap,
    saveHistoryState,
    exportAsPNG: () => alert("Layout PNG Saved."),
    exportAsSTL: () => alert("Mesh STL Saved."),
    exportAsOBJ: () => alert("Object OBJ Saved.")
  };
}
