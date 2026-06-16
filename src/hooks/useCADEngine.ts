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
  
  // Real-time live HUD text state for mobile view screen feedback
  const [hudFeedback, setHudFeedback] = useState<string>('Status: Idle');

  // Multi-step history stack
  const [history, setHistory] = useState<CADObject[][]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  // Active interaction tracking refs
  const isDraggingRef = useRef<boolean>(false);
  const startPointRef = useRef<Point2D | null>(null);
  const chainAnchorRef = useRef<Point2D | null>(null);

  // Core Three.js render layers
  const sceneRef = useRef<THREE.Scene>(new THREE.Scene());
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const visualObjectsRef = useRef<Map<string, THREE.Object3D>>(new Map());
  const previewLineRef = useRef<THREE.Line | null>(null);

  const generateId = () => Math.random().toString(36).substring(2, 9);

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

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 90, 120);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.85);
    dirLight.position.set(40, 140, 70);
    scene.add(dirLight);

    const grid = new THREE.GridHelper(200, 50, 0x4f46e5, isDarkMode ? 0x334155 : 0xcbd5e1);
    scene.add(grid);

    // Setup temporary runtime preview wireframe graphic line
    const previewMat = new THREE.LineBasicMaterial({ color: 0xf43f5e, dashSize: 2, gapSize: 1 });
    const previewGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    const previewLine = new THREE.Line(previewGeo, previewMat);
    scene.add(previewLine);
    previewLineRef.current = previewLine;

    let animationId: number;
    const animate = () => {
      animationId = requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animationId);
      if (renderer.domElement && containerRef.current) {
        containerRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  const saveHistoryState = (newObjects: CADObject[]) => {
    const nextHistory = history.slice(0, historyIndex + 1);
    setHistory([...nextHistory, newObjects]);
    setHistoryIndex(nextHistory.length);
    setObjects(newObjects);
  };

  // Re-sync 3D meshes and 2D math boundary paths perfectly
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
          geo.rotateX(-Math.PI / 2);
          const mat = new THREE.MeshStandardMaterial({ color: activeColor, roughness: 0.4 });
          const mesh = new THREE.Mesh(geo, mat);
          sceneRef.current.add(mesh);
          visualObjectsRef.current.set(obj.id, mesh);
        }
      } else {
        const points3D: THREE.Vector3[] = [];
        obj.points.forEach((p) => points3D.push(new THREE.Vector3(p.x, 0.1, p.y)));
        if (obj.type !== 'line' && points3D.length > 0) points3D.push(points3D[0].clone());

        const geometry = new THREE.BufferGeometry().setFromPoints(points3D);
        const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: activeColor, linewidth: 2 }));
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
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const target = new THREE.Vector3();
    if (raycaster.ray.intersectPlane(plane, target)) {
      return { x: Math.round(target.
