import { useRef, useState, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// --- Type Definitions ---
export type ViewMode = 'top' | 'front' | 'side' | 'isometric';

export interface CADObject {
  id: string;
  type: string;
  geometry: THREE.BufferGeometry;
  material: any; // Use any to avoid complex Material union issues in TS
  mesh: any;     // Use any to allow Mesh, Line, LineLoop without type conflicts
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
  canvasRef: React.RefObject<HTMLDivElement>;
  setOrthoMode: (mode: boolean) => void;
  setViewMode: (mode: ViewMode) => void;
  drawLine: (start: THREE.Vector3, end: THREE.Vector3) => void;
  drawPolyline: (points: THREE.Vector3[]) => void;
  drawRectangle: (p1: THREE.Vector3, p2: THREE.Vector3) => void;
  drawCircle: (center: THREE.Vector3, radius: number) => void;
  selectObject: (id: string | null) => void;
  moveObject: (id: string, delta: THREE.Vector3) => void;
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
}

export const useCADEngine = (): CADEngineHook => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const scene = useRef(new THREE.Scene());
  const renderer = useRef<THREE.WebGLRenderer | null>(null);
  const camera = useRef<THREE.PerspectiveCamera | THREE.OrthographicCamera | null>(null);
  const controls = useRef<OrbitControls | null>(null);

  const [objects, setObjects] = useState<CADObject[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('isometric');
  const [orthoMode, setOrthoMode] = useState<boolean>(false);

  const history = useRef<HistoryEntry[]>([]);
  const historyPointer = useRef<number>(-1);

  // --- History Management ---
  const saveState = useCallback(() => {
    const newState: HistoryEntry = {
      objects: objects.map(obj => ({
        ...obj,
        geometry: obj.geometry.clone(),
        material: Array.isArray(obj.material) ? obj.material.map(m => m.clone()) : obj.material.clone(),
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

  // --- Memory Management ---
  const cleanupMemory = useCallback(() => {
    scene.current.traverse((object: any) => {
      if (object.geometry) object.geometry.dispose();
      if (object.material) {
        if (Array.isArray(object.material)) {
          object.material.forEach((material: any) => material.dispose());
        } else {
          object.material.dispose();
        }
      }
    });
    renderer.current?.dispose();
  }, []);

  // --- Camera & View Management ---
  const syncCameraMatrix = useCallback(() => {
    if (!canvasRef.current || !renderer.current) return;

    const width = canvasRef.current.clientWidth;
    const height = canvasRef.current.clientHeight;
    const aspect = width / height;
    const frustumSize = 100;

    let newCamera: THREE.PerspectiveCamera | THREE.OrthographicCamera;

    if (orthoMode) {
      newCamera = new THREE.OrthographicCamera(
        frustumSize * aspect / -2,
        frustumSize * aspect / 2,
        frustumSize / 2,
        frustumSize / -2,
        0.1,
        1000
      );
    } else {
      newCamera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
    }

    switch (viewMode) {
      case 'top':
        newCamera.position.set(0, 100, 0);
        newCamera.up.set(0, 0, 1);
        break;
      case 'front':
        newCamera.position.set(0, 0, 100);
        newCamera.up.set(0, 1, 0);
        break;
      case 'side':
        newCamera.position.set(100, 0, 0);
        newCamera.up.set(0, 1, 0);
        break;
      case 'isometric':
      default:
        newCamera.position.set(100, 100, 100);
        newCamera.up.set(0, 1, 0);
        break;
    }

    newCamera.lookAt(0, 0, 0);
    newCamera.updateProjectionMatrix();
    
    camera.current = newCamera;
    if (controls.current) {
      controls.current.object = newCamera;
      controls.current.update();
    }
  }, [orthoMode, viewMode]);

  // --- Drawing Tools ---
  const drawLine = useCallback((start: THREE.Vector3, end: THREE.Vector3) => {
    const material = new THREE.LineBasicMaterial({ color: 0x0000ff });
    const geometry = new THREE.BufferGeometry().setFromPoints([start, end]);
    const line = new THREE.Line(geometry, material);
    line.name = `line-${Date.now()}`;
    setObjects(prev => [...prev, { id: line.name, type: 'line', geometry, material, mesh: line }]);
  }, []);

  const drawPolyline = useCallback((points: THREE.Vector3[]) => {
    const material = new THREE.LineBasicMaterial({ color: 0x00ff00 });
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const polyline = new THREE.Line(geometry, material);
    polyline.name = `polyline-${Date.now()}`;
    setObjects(prev => [...prev, { id: polyline.name, type: 'polyline', geometry, material, mesh: polyline }]);
  }, []);

  const drawRectangle = useCallback((p1: THREE.Vector3, p2: THREE.Vector3) => {
    const material = new THREE.LineBasicMaterial({ color: 0xff00ff });
    const points = [
      new THREE.Vector3(p1.x, p1.y, 0),
      new THREE.Vector3(p2.x, p1.y, 0),
      new THREE.Vector3(p2.x, p2.y, 0),
      new THREE.Vector3(p1.x, p2.y, 0),
    ];
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const rectangle = new THREE.LineLoop(geometry, material);
    rectangle.name = `rectangle-${Date.now()}`;
    setObjects(prev => [...prev, { id: rectangle.name, type: 'rectangle', geometry, material, mesh: rectangle }]);
  }, []);

  const drawCircle = useCallback((center: THREE.Vector3, radius: number) => {
    const material = new THREE.LineBasicMaterial({ color: 0xffff00 });
    const points = [];
    for (let i = 0; i <= 64; i++) {
      const angle = (i / 64) * Math.PI * 2;
      points.push(new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius, 0));
    }
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const circle = new THREE.LineLoop(geometry, material);
    circle.position.copy(center);
    circle.name = `circle-${Date.now()}`;
    setObjects(prev => [...prev, { id: circle.name, type: 'circle', geometry, material, mesh: circle }]);
  }, []);

  const selectObject = useCallback((id: string | null) => {
    setSelectedId(id);
  }, []);

  const moveObject = useCallback((id: string, delta: THREE.Vector3) => {
    setObjects(prev => prev.map(obj => {
      if (obj.id === id) {
        const newMesh = obj.mesh.clone();
        newMesh.position.add(delta);
        return { ...obj, mesh: newMesh };
      }
      return obj;
    }));
  }, []);

  // --- Transformations ---
  const executeExtrude = useCallback((id: string, depth: number) => {
    setObjects(prev => prev.map(obj => {
      if (obj.id === id && (obj.mesh instanceof THREE.Line || obj.mesh instanceof THREE.LineLoop)) {
        const positions = obj.geometry.attributes.position.array;
        const shape = new THREE.Shape();
        for (let i = 0; i < positions.length; i += 3) {
          if (i === 0) shape.moveTo(positions[i], positions[i + 1]);
          else shape.lineTo(positions[i], positions[i + 1]);
        }
        const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
        const material = new THREE.MeshPhongMaterial({ color: (obj.material as any).color || 0xcccccc });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.name = obj.id;
        return { ...obj, geometry, material, mesh };
      }
      return obj;
    }));
  }, []);

  const executeFillet = useCallback((id: string, radius: number) => {
    console.log('Fillet not fully implemented in this version', id, radius);
  }, []);

  const executeTrim = useCallback((id: string, cuttingId: string) => {
    console.log('Trim not fully implemented in this version', id, cuttingId);
  }, []);

  const executeExtend = useCallback((id: string, targetId: string) => {
    console.log('Extend not fully implemented in this version', id, targetId);
  }, []);

  const executeRotate = useCallback((id: string, axis: THREE.Vector3, angle: number) => {
    setObjects(prev => prev.map(obj => {
      if (obj.id === id) {
        const newMesh = obj.mesh.clone();
        newMesh.rotateOnAxis(axis.normalize(), angle);
        return { ...obj, mesh: newMesh };
      }
      return obj;
    }));
  }, []);

  const executeOffset = useCallback((id: string, distance: number) => {
    console.log('Offset not fully implemented in this version', id, distance);
  }, []);

  const executeScale = useCallback((id: string, factor: THREE.Vector3) => {
    setObjects(prev => prev.map(obj => {
      if (obj.id === id) {
        const newMesh = obj.mesh.clone();
        newMesh.scale.multiply(factor);
        return { ...obj, mesh: newMesh };
      }
      return obj;
    }));
  }, []);

  const executeUnion = useCallback((id1: string, id2: string) => {
    console.log('Union requires CSG library', id1, id2);
  }, []);

  const executeSubtract = useCallback((id1: string, id2: string) => {
    console.log('Subtract requires CSG library', id1, id2);
  }, []);

  const executeErase = useCallback((id: string) => {
    setObjects(prev => prev.filter(obj => obj.id !== id));
    if (selectedId === id) setSelectedId(null);
  }, [selectedId]);

  // --- Initial Setup ---
  useEffect(() => {
    if (!canvasRef.current) return;

    renderer.current = new THREE.WebGLRenderer({ antialias: true });
    renderer.current.setSize(canvasRef.current.clientWidth, canvasRef.current.clientHeight);
    canvasRef.current.appendChild(renderer.current.domElement);

    const aspect = canvasRef.current.clientWidth / canvasRef.current.clientHeight;
    camera.current = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
    camera.current.position.set(100, 100, 100);
    camera.current.lookAt(0, 0, 0);

    controls.current = new OrbitControls(camera.current, renderer.current.domElement);
    
    scene.current.add(new THREE.GridHelper(200, 20));
    scene.current.add(new THREE.AxesHelper(50));
    scene.current.add(new THREE.AmbientLight(0x404040));
    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(1, 1, 1);
    scene.current.add(light);

    const animate = () => {
      requestAnimationFrame(animate);
      if (controls.current) controls.current.update();
      if (renderer.current && camera.current) {
        renderer.current.render(scene.current, camera.current);
      }
    };
    animate();

    const handleResize = () => {
      if (!canvasRef.current || !renderer.current || !camera.current) return;
      const w = canvasRef.current.clientWidth;
      const h = canvasRef.current.clientHeight;
      renderer.current.setSize(w, h);
      if (camera.current instanceof THREE.PerspectiveCamera) {
        camera.current.aspect = w / h;
      }
      camera.current.updateProjectionMatrix();
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      cleanupMemory();
    };
  }, [cleanupMemory]);

  useEffect(() => {
    // Sync objects to scene
    const currentMeshIds = new Set(objects.map(o => o.id));
    scene.current.children.forEach(child => {
      if (child.name && !currentMeshIds.has(child.name) && (child instanceof THREE.Mesh || child instanceof THREE.Line || child instanceof THREE.LineLoop)) {
        scene.current.remove(child);
      }
    });

    objects.forEach(obj => {
      const existing = scene.current.getObjectByName(obj.id);
      if (existing) scene.current.remove(existing);
      
      const mesh = obj.mesh.clone();
      mesh.name = obj.id;
      
      // Highlight logic
      if (obj.id === selectedId) {
        if (mesh instanceof THREE.Mesh) {
          mesh.material = new THREE.MeshPhongMaterial({ color: 0xff0000, emissive: 0x330000 });
        } else {
          mesh.material = new THREE.LineBasicMaterial({ color: 0xff0000 });
        }
      } else {
        mesh.material = obj.material;
      }
      
      scene.current.add(mesh);
    });

    saveState();
  }, [objects, selectedId, saveState]);

  useEffect(() => {
    syncCameraMatrix();
  }, [viewMode, orthoMode, syncCameraMatrix]);

  return {
    objects, selectedId, viewMode, orthoMode, canvasRef,
    setOrthoMode, setViewMode, drawLine, drawPolyline, drawRectangle, drawCircle,
    selectObject, moveObject, executeExtrude, executeFillet, executeTrim, executeExtend,
    executeRotate, executeOffset, executeScale, executeUnion, executeSubtract, executeErase,
    undo, redo, cleanupMemory
  };
};