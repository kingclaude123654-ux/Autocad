import { useRef, useState, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// --- Type Definitions ---
export type ViewMode = 'top' | 'front' | 'side' | 'isometric';
export type DrawingMode = 'none' | 'line' | 'polyline' | 'rectangle' | 'circle';

export interface CADObject {
  id: string;
  type: string;
  geometry: THREE.BufferGeometry;
  material: any;
  mesh: any;
  dimensions?: string;
}

export interface HistoryEntry {
  objects: CADObject[];
  selectedId: string | null;
}

export interface CADEngineHook {
  objects: CADObject[];
  selectedId: string | null;
  viewMode: ViewMode;
  orthoMode: boolean;
  drawingMode: DrawingMode;
  canvasRef: React.RefObject<HTMLDivElement>;
  setOrthoMode: (mode: boolean) => void;
  setViewMode: (mode: ViewMode) => void;
  setDrawingMode: (mode: DrawingMode) => void;
  selectObject: (id: string | null) => void;
  moveObject: (id: string, delta: THREE.Vector3) => void;
  copyObject: (id: string) => void;
  executeExtrude: (id: string, depth: number) => void;
  executeFillet: (id: string, radius: number) => void;
  executeTrim: (id: string, cuttingId: string) => void;
  executeExtend: (id: string, targetId: string) => void;
  executeRotate: (id: string, axis: THREE.Vector3, angle: number) => void;
  executeOffset: (id: string, distance: number) => void;
  executeScale: (id: string, factor: THREE.Vector3) => void;
  executeUnion: (id1: string, id2: string) => void;
  executeSubtract: (id1: string, id2: string) => void;
  executeErase: (id: string) => void;
  undo: () => void;
  redo: () => void;
  cleanupMemory: () => void;
  exportToPDF: () => void;
}

export const useCADEngine = (): CADEngineHook => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const scene = useRef(new THREE.Scene());
  const renderer = useRef<THREE.WebGLRenderer | null>(null);
  const camera = useRef<THREE.PerspectiveCamera | THREE.OrthographicCamera | null>(null);
  const controls = useRef<OrbitControls | null>(null);
  const raycaster = useRef(new THREE.Raycaster());
  const mouse = useRef(new THREE.Vector2());

  const [objects, setObjects] = useState<CADObject[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('isometric');
  const [orthoMode, setOrthoMode] = useState<boolean>(false);
  const [drawingMode, setDrawingMode] = useState<DrawingMode>('none');
  const [drawingPoints, setDrawingPoints] = useState<THREE.Vector3[]>([]);

  const history = useRef<HistoryEntry[]>([]);
  const historyPointer = useRef<number>(-1);

  // --- History ---
  const saveState = useCallback(() => {
    const newState: HistoryEntry = {
      objects: objects.map(obj => ({
        ...obj,
        geometry: obj.geometry.clone(),
        material: Array.isArray(obj.material) ? obj.material.map((m: any) => m.clone()) : obj.material.clone(),
        mesh: obj.mesh.clone(),
      })),
      selectedId,
    };
    history.current = history.current.slice(0, historyPointer.current + 1);
    history.current.push(newState);
    historyPointer.current = history.current.length - 1;
  }, [objects, selectedId]);

  const undo = useCallback(() => {
    if (historyPointer.current > 0) {
      historyPointer.current--;
      const prevState = history.current[historyPointer.current];
      setObjects(prevState.objects);
      setSelectedId(prevState.selectedId);
    }
  }, []);

  const redo = useCallback(() => {
    if (historyPointer.current < history.current.length - 1) {
      historyPointer.current++;
      const nextState = history.current[historyPointer.current];
      setObjects(nextState.objects);
      setSelectedId(nextState.selectedId);
    }
  }, []);

  // --- Core ---
  const cleanupMemory = useCallback(() => {
    scene.current.traverse((object: any) => {
      if (object.geometry) object.geometry.dispose();
      if (object.material) {
        if (Array.isArray(object.material)) object.material.forEach((m: any) => m.dispose());
        else object.material.dispose();
      }
    });
    renderer.current?.dispose();
  }, []);

  const syncCameraMatrix = useCallback(() => {
    if (!canvasRef.current || !renderer.current) return;
    const w = canvasRef.current.clientWidth, h = canvasRef.current.clientHeight, aspect = w / h, f = 100;
    let newCam: THREE.PerspectiveCamera | THREE.OrthographicCamera;
    if (orthoMode) newCam = new THREE.OrthographicCamera(f * aspect / -2, f * aspect / 2, f / 2, f / -2, 0.1, 1000);
    else newCam = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
    
    switch (viewMode) {
      case 'top': newCam.position.set(0, 100, 0); newCam.up.set(0, 0, 1); break;
      case 'front': newCam.position.set(0, 0, 100); newCam.up.set(0, 1, 0); break;
      case 'side': newCam.position.set(100, 0, 0); newCam.up.set(0, 1, 0); break;
      default: newCam.position.set(100, 100, 100); newCam.up.set(0, 1, 0); break;
    }
    newCam.lookAt(0, 0, 0);
    newCam.updateProjectionMatrix();
    camera.current = newCam;
    if (controls.current) { controls.current.object = newCam; controls.current.update(); }
  }, [orthoMode, viewMode]);

  // --- Drawing Logic ---
  const addObject = useCallback((type: string, geometry: THREE.BufferGeometry, material: THREE.Material, mesh: any, dimensions?: string) => {
    const id = `${type}-${Date.now()}`;
    mesh.name = id;
    setObjects(prev => [...prev, { id, type, geometry, material, mesh, dimensions }]);
  }, []);

  const moveObject = useCallback((id: string, delta: THREE.Vector3) => {
    setObjects(prev => prev.map(obj => {
      if (obj.id === id) {
        const m = obj.mesh.clone(); m.position.add(delta); return { ...obj, mesh: m };
      }
      return obj;
    }));
  }, []);

  const copyObject = useCallback((id: string) => {
    const target = objects.find(o => o.id === id);
    if (target) {
      const m = target.mesh.clone(); m.position.add(new THREE.Vector3(10, 10, 0));
      addObject(target.type, target.geometry.clone(), (target.material as any).clone(), m, target.dimensions);
    }
  }, [objects, addObject]);

  const executeExtrude = useCallback((id: string, depth: number) => {
    setObjects(prev => prev.map(obj => {
      if (obj.id === id && (obj.mesh instanceof THREE.Line || obj.mesh instanceof THREE.LineLoop)) {
        const pts = obj.geometry.attributes.position.array;
        const shape = new THREE.Shape();
        for (let i = 0; i < pts.length; i += 3) {
          if (i === 0) shape.moveTo(pts[i], pts[i+1]); else shape.lineTo(pts[i], pts[i+1]);
        }
        const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
        const mat = new THREE.MeshPhongMaterial({ color: 0xcccccc });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.name = obj.id;
        return { ...obj, geometry: geo, material: mat, mesh, type: 'extrusion' };
      }
      return obj;
    }));
  }, []);

  const executeFillet = useCallback((id: string, radius: number) => console.log('Fillet Placeholder', id, radius), []);
  const executeTrim = useCallback((id: string, cuttingId: string) => console.log('Trim Placeholder', id, cuttingId), []);
  const executeExtend = useCallback((id: string, targetId: string) => console.log('Extend Placeholder', id, targetId), []);
  const executeRotate = useCallback((id: string, axis: THREE.Vector3, angle: number) => {
    setObjects(prev => prev.map(obj => {
      if (obj.id === id) {
        const m = obj.mesh.clone(); m.rotateOnAxis(axis.normalize(), angle); return { ...obj, mesh: m };
      }
      return obj;
    }));
  }, []);
  const executeOffset = useCallback((id: string, distance: number) => console.log('Offset Placeholder', id, distance), []);
  const executeScale = useCallback((id: string, factor: THREE.Vector3) => {
    setObjects(prev => prev.map(obj => {
      if (obj.id === id) {
        const m = obj.mesh.clone(); m.scale.multiply(factor); return { ...obj, mesh: m };
      }
      return obj;
    }));
  }, []);
  const executeUnion = useCallback((id1: string, id2: string) => console.log('Union Placeholder', id1, id2), []);
  const executeSubtract = useCallback((id1: string, id2: string) => console.log('Subtract Placeholder', id1, id2), []);
  const executeErase = useCallback((id: string) => {
    setObjects(prev => prev.filter(o => o.id !== id));
    if (selectedId === id) setSelectedId(null);
  }, [selectedId]);

  const exportToPDF = useCallback(() => {
    if (!renderer.current) return;
    const link = document.createElement('a');
    link.href = renderer.current.domElement.toDataURL('image/png');
    link.download = 'cad-export.png';
    link.click();
  }, []);

  // --- Setup ---
  useEffect(() => {
    if (!canvasRef.current) return;
    const r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    r.setSize(canvasRef.current.clientWidth, canvasRef.current.clientHeight);
    canvasRef.current.appendChild(r.domElement);
    renderer.current = r;

    const aspect = canvasRef.current.clientWidth / canvasRef.current.clientHeight;
    const cam = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
    cam.position.set(100, 100, 100);
    cam.lookAt(0, 0, 0);
    camera.current = cam;

    const con = new OrbitControls(cam, r.domElement);
    controls.current = con;

    scene.current.add(new THREE.GridHelper(200, 20), new THREE.AxesHelper(50), new THREE.AmbientLight(0x404040));
    const light = new THREE.DirectionalLight(0xffffff, 1); light.position.set(1, 1, 1); scene.current.add(light);

    const animate = () => {
      requestAnimationFrame(animate);
      con.update();
      if (renderer.current && camera.current) renderer.current.render(scene.current, camera.current);
    };
    animate();

    const onCanvasClick = (event: MouseEvent) => {
      if (!canvasRef.current || !camera.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      mouse.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.current.setFromCamera(mouse.current, camera.current);

      if (drawingMode !== 'none') {
        const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
        const intersection = new THREE.Vector3();
        raycaster.current.ray.intersectPlane(plane, intersection);
        if (intersection) {
          const newPts = [...drawingPoints, intersection];
          if (drawingMode === 'line' && newPts.length === 2) {
            const geo = new THREE.BufferGeometry().setFromPoints([newPts[0], newPts[1]]);
            const mat = new THREE.LineBasicMaterial({ color: 0x0000ff });
            addObject('line', geo, mat, new THREE.Line(geo, mat), `L: ${newPts[0].distanceTo(newPts[1]).toFixed(2)}`);
            setDrawingPoints([]); setDrawingMode('none');
          } else if (drawingMode === 'rectangle' && newPts.length === 2) {
            const p1 = newPts[0], p2 = newPts[1];
            const pts = [new THREE.Vector3(p1.x, p1.y, 0), new THREE.Vector3(p2.x, p1.y, 0), new THREE.Vector3(p2.x, p2.y, 0), new THREE.Vector3(p1.x, p2.y, 0), new THREE.Vector3(p1.x, p1.y, 0)];
            const geo = new THREE.BufferGeometry().setFromPoints(pts);
            const mat = new THREE.LineBasicMaterial({ color: 0xff00ff });
            addObject('rectangle', geo, mat, new THREE.LineLoop(geo, mat), `W: ${Math.abs(p2.x-p1.x).toFixed(2)}, H: ${Math.abs(p2.y-p1.y).toFixed(2)}`);
            setDrawingPoints([]); setDrawingMode('none');
          } else if (drawingMode === 'circle' && newPts.length === 2) {
            const radius = newPts[0].distanceTo(newPts[1]);
            const pts = [];
            for (let i=0; i<=64; i++) {
              const a = (i/64)*Math.PI*2; pts.push(new THREE.Vector3(Math.cos(a)*radius, Math.sin(a)*radius, 0));
            }
            const geo = new THREE.BufferGeometry().setFromPoints(pts);
            const mat = new THREE.LineBasicMaterial({ color: 0xffff00 });
            const mesh = new THREE.LineLoop(geo, mat); mesh.position.copy(newPts[0]);
            addObject('circle', geo, mat, mesh, `R: ${radius.toFixed(2)}`);
            setDrawingPoints([]); setDrawingMode('none');
          } else if (drawingMode === 'polyline' && event.detail === 2) {
            const geo = new THREE.BufferGeometry().setFromPoints(newPts);
            const mat = new THREE.LineBasicMaterial({ color: 0x00ff00 });
            addObject('polyline', geo, mat, new THREE.Line(geo, mat), `Pts: ${newPts.length}`);
            setDrawingPoints([]); setDrawingMode('none');
          } else {
            setDrawingPoints(newPts);
          }
        }
      } else {
        const hits = raycaster.current.intersectObjects(scene.current.children, true);
        const hit = hits.find(h => h.object.name !== '');
        setSelectedId(hit ? hit.object.name : null);
      }
    };

    canvasRef.current.addEventListener('click', onCanvasClick);
    return () => { canvasRef.current?.removeEventListener('click', onCanvasClick); cleanupMemory(); };
  }, [drawingMode, drawingPoints, addObject, cleanupMemory]);

  useEffect(() => {
    const ids = new Set(objects.map(o => o.id));
    scene.current.children.forEach(c => { if (c.name && !ids.has(c.name) && (c instanceof THREE.Mesh || c instanceof THREE.Line || c instanceof THREE.LineLoop)) scene.current.remove(c); });
    objects.forEach(obj => {
      const ex = scene.current.getObjectByName(obj.id); if (ex) scene.current.remove(ex);
      const m = obj.mesh.clone(); m.name = obj.id;
      if (obj.id === selectedId) {
        if (m instanceof THREE.Mesh) m.material = new THREE.MeshPhongMaterial({ color: 0xff0000, emissive: 0x330000 });
        else m.material = new THREE.LineBasicMaterial({ color: 0xff0000 });
      } else m.material = obj.material;
      scene.current.add(m);
    });
    saveState();
  }, [objects, selectedId, saveState]);

  useEffect(() => { syncCameraMatrix(); }, [viewMode, orthoMode, syncCameraMatrix]);

  return {
    objects, selectedId, viewMode, orthoMode, drawingMode, canvasRef,
    setOrthoMode, setViewMode, setDrawingMode, selectObject: setSelectedId, moveObject, copyObject, executeExtrude, executeFillet, executeTrim, executeExtend, executeRotate, executeOffset, executeScale, executeUnion, executeSubtract, executeErase, undo, redo, cleanupMemory, exportToPDF
  };
};
