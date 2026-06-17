import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

// --- TYPES ---
export type ViewMode = 'top' | 'front' | 'side' | 'isometric';
export type ToolType = 'select' | 'pan' | 'line' | 'rectangle' | 'circle';

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
}

export default function App() {
  // --- STATES ---
  const [objects, setObjects] = useState<CADObject[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [currentTool, setCurrentTool] = useState<ToolType>('line');
  const [viewMode] = useState<ViewMode>('top'); // Removed setViewMode to fix TS6133
  const [hudFeedback, setHudFeedback] = useState<string>('Ready. Tap and drag to draw.');

  // --- CONFIG ---
  const workspaceSize = 500;
  const gridSpacing = 10;

  // --- REFS ---
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<THREE.Scene>(new THREE.Scene());
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const visualObjectsRef = useRef<Map<string, THREE.Object3D>>(new Map());
  const previewLineRef = useRef<THREE.Line | null>(null);

  // Gesture Tracking
  const isDrawingRef = useRef<boolean>(false);
  const startPointRef = useRef<Point2D | null>(null);
  const currentPointRef = useRef<Point2D | null>(null);

  // Pan Option Tracking
  const isPanningRef = useRef<boolean>(false);
  const panStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const cameraOffsetRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 0));

  // State Mirror for the Engine Loop
  const stateRef = useRef({ currentTool, objects, selectedId, viewMode });

  useEffect(() => {
    stateRef.current = { currentTool, objects, selectedId, viewMode };
  }, [currentTool, objects, selectedId, viewMode]);

  // --- CAMERA CONTROLLER ---
  const updateCamera = () => {
    if (!cameraRef.current || !rendererRef.current) return;
    const offset = cameraOffsetRef.current;
    const dist = 300;

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
    rendererRef.current.render(sceneRef.current, cameraRef.current);
  };

  // --- TRANSLATE TO SPACE COORDINATES ---
  const getSpacePoint = (clientX: number, clientY: number): Point2D | null => {
    if (!containerRef.current || !cameraRef.current) return null;
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((clientY - rect.top) / rect.height) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(x, y), cameraRef.current);

    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const intersect = new THREE.Vector3();
    if (raycaster.ray.intersectPlane(plane, intersect)) {
      return { x: intersect.x, y: intersect.z };
    }
    return null;
  };

  // --- CORE INTERACTION HANDLERS ---
  const handlePointerDown = (clientX: number, clientY: number) => {
    if (stateRef.current.currentTool === 'pan') {
      isPanningRef.current = true;
      panStartRef.current = { x: clientX, y: clientY };
      return;
    }

    const pts = getSpacePoint(clientX, clientY);
    if (!pts) return;

    if (stateRef.current.currentTool === 'select') {
      const found = stateRef.current.objects.find(o => 
        o.points.some(p => Math.abs(p.x - pts.x) < 20 && Math.abs(p.y - pts.y) < 20)
      );
      setSelectedId(found ? found.id : null);
      if (found) setHudFeedback(`Selected: ${found.type.toUpperCase()}`);
      return;
    }

    isDrawingRef.current = true;
    startPointRef.current = pts;
    currentPointRef.current = pts;
  };

  const handlePointerMove = (clientX: number, clientY: number) => {
    if (stateRef.current.currentTool === 'pan' && isPanningRef.current) {
      const dx = clientX - panStartRef.current.x;
      const dy = clientY - panStartRef.current.y;
      panStartRef.current = { x: clientX, y: clientY };

      const factor = 0.4;
      cameraOffsetRef.current.x -= dx * factor;
      cameraOffsetRef.current.z -= dy * factor;
      updateCamera();
      return;
    }

    if (!isDrawingRef.current || !startPointRef.current) return;
    const pts = getSpacePoint(clientX, clientY);
    if (!pts) return;

    currentPointRef.current = pts;
    const origin = startPointRef.current;
    const len = Math.hypot(pts.x - origin.x, pts.y - origin.y);

    if (previewLineRef.current) {
      const pPts: THREE.Vector3[] = [];
      if (stateRef.current.currentTool === 'line') {
        pPts.push(new THREE.Vector3(origin.x, 0.5, origin.y), new THREE.Vector3(pts.x, 0.5, pts.y));
      } else if (stateRef.current.currentTool === 'rectangle') {
        pPts.push(
          new THREE.Vector3(origin.x, 0.5, origin.y),
          new THREE.Vector3(pts.x, 0.5, origin.y),
          new THREE.Vector3(pts.x, 0.5, pts.y),
          new THREE.Vector3(origin.x, 0.5, pts.y),
          new THREE.Vector3(origin.x, 0.5, origin.y)
        );
      } else if (stateRef.current.currentTool === 'circle') {
        for (let i = 0; i <= 64; i++) {
          const a = (i / 64) * Math.PI * 2;
          pPts.push(new THREE.Vector3(origin.x + Math.cos(a) * len, 0.5, origin.y + Math.sin(a) * len));
        }
      }
      previewLineRef.current.geometry.setFromPoints(pPts);
      if (rendererRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
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
    const end = currentPointRef.current;
    const len = Math.hypot(end.x - origin.x, end.y - origin.y);

    if (len < 2) return;
    let newObj: CADObject | null = null;
    const genId = Math.random().toString(36).substring(2, 9);

    if (stateRef.current.currentTool === 'line') {
      newObj = { id: genId, type: 'line', points: [origin, end], color: '#3b82f6', layer: '0', is3D: false };
    } else if (stateRef.current.currentTool === 'rectangle') {
      newObj = { id: genId, type: 'rectangle', points: [origin, { x: end.x, y: origin.y }, end, { x: origin.x, y: end.y }], color: '#10b981', layer: '0', is3D: false };
    } else if (stateRef.current.currentTool === 'circle') {
      const pts: Point2D[] = [];
      for (let i = 0; i < 64; i++) {
        const a = (i / 64) * Math.PI * 2;
        pts.push({ x: origin.x + Math.cos(a) * len, y: origin.y + Math.sin(a) * len });
      }
      newObj = { id: genId, type: 'circle', points: pts, color: '#a855f7', layer: '0', is3D: false };
    }

    if (newObj) {
      setObjects(prev => [...prev, newObj!]);
      setHudFeedback(`Added ${newObj.type.toUpperCase()}`);
    }

    if (previewLineRef.current) previewLineRef.current.geometry.setFromPoints([]);
  };

  // --- INITIALIZE THREE.JS RUNTIME ENGINE ---
  useEffect(() => {
    if (!containerRef.current) return;
    const w = containerRef.current.clientWidth;
    const h = containerRef.current.clientHeight;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    containerRef.current.innerHTML = '';
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const scene = sceneRef.current;
    scene.background = new THREE.Color(0x0f172a);

    const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 2000);
    cameraRef.current = camera;
    updateCamera();

    scene.clear();
    scene.add(new THREE.AmbientLight(0xffffff, 0.9));

    const grid = new THREE.GridHelper(workspaceSize, workspaceSize / gridSpacing, 0x4f46e5, 0x334155);
    scene.add(grid);

    const pMat = new THREE.LineBasicMaterial({ color: 0xf43f5e, linewidth: 2 });
    const pLine = new THREE.Line(new THREE.BufferGeometry(), pMat);
    scene.add(pLine);
    previewLineRef.current = pLine;

    const host = containerRef.current;
    
    const onMouseDown = (e: MouseEvent) => { handlePointerDown(e.clientX, e.clientY); };
    const onMouseMove = (e: MouseEvent) => { handlePointerMove(e.clientX, e.clientY); };
    
    const onTouchStart = (e: TouchEvent) => { if (e.touches.length === 1) handlePointerDown(e.touches[0].clientX, e.touches[0].clientY); };
    const onTouchMove = (e: TouchEvent) => { if (e.touches.length === 1) handlePointerMove(e.touches[0].clientX, e.touches[0].clientY); };

    host.addEventListener('mousedown', onMouseDown);
    host.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', handlePointerUp);

    host.addEventListener('touchstart', onTouchStart, { passive: true });
    host.addEventListener('touchmove', onTouchMove, { passive: true });
    host.addEventListener('touchend', handlePointerUp, { passive: true });

    return () => {
      host.removeEventListener('mousedown', onMouseDown);
      host.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', handlePointerUp);
      host.removeEventListener('touchstart', onTouchStart);
      host.removeEventListener('touchmove', onTouchMove);
      host.removeEventListener('touchend', handlePointerUp);
      renderer.dispose();
    };
  }, []);

  useEffect(() => { updateCamera(); }, [viewMode]);

  // --- COMPONENT VECTOR RENDERING SYNC ---
  useEffect(() => {
    if (!sceneRef.current) return;
    visualObjectsRef.current.forEach(m => sceneRef.current.remove(m));
    visualObjectsRef.current.clear();

    objects.forEach(obj => {
      const isSelected = obj.id === selectedId;
      const colorHex = isSelected ? 0xef4444 : new THREE.Color(obj.color).getHex();
      const group = new THREE.Group();

      const vecPoints: THREE.Vector3[] = [];
      obj.points.forEach(p => vecPoints.push(new THREE.Vector3(p.x, 0.2, p.y)));
      if (obj.type !== 'line') vecPoints.push(vecPoints[0].clone());

      const geo = new THREE.BufferGeometry().setFromPoints(vecPoints);
      const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: colorHex, linewidth: 2 }));
      group.add(line);

      sceneRef.current.add(group);
      visualObjectsRef.current.set(obj.id, group);
    });

    if (rendererRef.current && cameraRef.current) {
      rendererRef.current.render(sceneRef.current, cameraRef.current);
    }
  }, [objects, selectedId]);

  return (
    <div className="w-screen h-screen flex flex-col bg-slate-900 text-slate-100 font-sans overflow-hidden select-none">
      <header className="h-14 px-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between shrink-0">
        <span className="font-black text-indigo-500 tracking-wider text-sm">MINI_CAD</span>
        <button onClick={() => setObjects([])} className="px-3 py-1 bg-rose-600 rounded text-xs font-bold text-white">
          CLEAR
        </button>
      </header>

      <main ref={containerRef} className="flex-1 w-full bg-slate-950 relative touch-none" />

      <footer className="p-3 bg-slate-950 border-t border-slate-800 shrink-0">
        <div className="flex gap-1.5 overflow-x-auto pb-2">
          {(['select', 'pan', 'line', 'rectangle', 'circle'] as ToolType[]).map(tool => (
            <button
              key={tool}
              onClick={() => setCurrentTool(tool)}
              className={`px-4 py-2 rounded text-xs font-bold uppercase border whitespace-nowrap ${
                currentTool === tool 
                  ? 'bg-indigo-600 border-indigo-500 text-white' 
                  : 'bg-slate-900 border-slate-800 text-slate-400'
              }`}
            >
              {tool}
            </button>
          ))}
        </div>

        <div className="mt-2 flex justify-between items-center text-[11px] font-mono text-slate-500 border-t border-slate-900 pt-2">
          <span className="text-emerald-400">⚡ {hudFeedback}</span>
          <span>ITEMS: {objects.length}</span>
        </div>
      </footer>
    </div>
  );
}