import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { CADObject, ToolType, ViewMode } from '../types/cad';

export function useCADEngine() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [objects, setObjects] = useState<CADObject[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [currentTool, setCurrentTool] = useState<ToolType>('select');
  const [viewMode, setViewMode] = useState<ViewMode>('top');
  const [isDarkMode, setIsDarkMode] = useState<boolean>(true);
  const [snapConfig, setSnapConfig] = useState({ grid: true, endpoint: true, midpoint: true, center: true });

  // History system for Undo/Redo
  const [history, setHistory] = useState<CADObject[][]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  // Core Three.js Refs
  const sceneRef = useRef<THREE.Scene>(new THREE.Scene());
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | THREE.OrthographicCamera | null>(null);
  const gridRef = useRef<THREE.GridHelper | null>(null);

  // Initialize Canvas Scene
  useEffect(() => {
    if (!containerRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Base Scene configuration
    const scene = sceneRef.current;
    scene.background = new THREE.Color(isDarkMode ? 0x0f172a : 0xf8fafc);

    // Dynamic Camera system
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 50, 100);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // Ambient & Directional Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(20, 100, 50);
    scene.add(dirLight);

    // Responsive Adaptive Grid System
    const grid = new THREE.GridHelper(200, 100, 0x64748b, isDarkMode ? 0x334155 : 0xcbd5e1);
    grid.position.y = -0.01;
    scene.add(grid);
    gridRef.current = grid;

    // Live Render Loop Execution
    let animationId: number;
    const animate = () => {
      animationId = requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    // Handle Mobile Screen Rotation/Resizing
    const handleResize = () => {
      if (!containerRef.current || !cameraRef.current || !rendererRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      
      if (cameraRef.current instanceof THREE.PerspectiveCamera) {
        cameraRef.current.aspect = w / h;
        cameraRef.current.updateProjectionMatrix();
      }
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

  // Update background colors when toggling themes
  useEffect(() => {
    if (sceneRef.current) {
      sceneRef.current.background = new THREE.Color(isDarkMode ? 0x0f172a : 0xf8fafc);
    }
  }, [isDarkMode]);

  // Handle Camera view alignments
  const changeView = (mode: ViewMode) => {
    setViewMode(mode);
    if (!cameraRef.current) return;
    
    switch (mode) {
      case 'top':
        cameraRef.current.position.set(0, 100, 0);
        break;
      case 'front':
        cameraRef.current.position.set(0, 0, 100);
        break;
      case 'side':
        cameraRef.current.position.set(100, 0, 0);
        break;
      case 'isometric':
        cameraRef.current.position.set(70, 70, 70);
        break;
    }
    cameraRef.current.lookAt(0, 0, 0);
  };

  // 2D to 3D Extrusion Engine Core implementation
  const executeExtrude = (id: string, height: number) => {
    const targetObj = objects.find(o => o.id === id);
    if (!targetObj || targetObj.points.length < 2) return;

    // Create custom closed geometry shape based on selected 2D primitive boundaries
    const shape = new THREE.Shape();
    shape.moveTo(targetObj.points[0].x, targetObj.points[0].y);
    for (let i = 1; i < targetObj.points.length; i++) {
      shape.lineTo(targetObj.points[i].x, targetObj.points[i].y);
    }
    if (targetObj.type === 'rectangle' || targetObj.type === 'circle' || targetObj.type === 'polygon') {
      shape.lineTo(targetObj.points[0].x, targetObj.points[0].y);
    }

    const extrudeSettings = { depth: height, bevelEnabled: false };
    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geometry.rotateX(-Math.PI / 2); // Orient horizontal with baseline system grid

    const material = new THREE.MeshStandardMaterial({ 
      color: targetObj.color || 0x3b82f6, 
      roughness: 0.4,
      metalness: 0.1
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    sceneRef.current.add(mesh);

    const updatedObjects = objects.map(obj => {
      if (obj.id === id) {
        return { ...obj, is3D: true, extrusionHeight: height, threeMeshId: mesh.uuid };
      }
      return obj;
    });

    saveHistoryState(updatedObjects);
  };

  // Project History controls
  const saveHistoryState = (newObjects: CADObject[]) => {
    const nextHistory = history.slice(0, historyIndex + 1);
    setHistory([...nextHistory, newObjects]);
    setHistoryIndex(nextHistory.length);
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

  // Mock Export Functions
  const exportAsPNG = () => alert("Exporting canvas viewport image file layout... Successful.");
  const exportAsSTL = () => alert("Generating raw STL analytical mesh matrix strings... Completed.");
  const exportAsOBJ = () => alert("Parsing localized component structures to wavefront .obj... Completed.");

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
    setSnapConfig,
    executeExtrude,
    undo,
    redo,
    exportAsPNG,
    exportAsSTL,
    exportAsOBJ,
    saveHistoryState
  };
}
