import { useState, useCallback, useRef, useEffect } from 'react';
import * as THREE from 'three';

export type ViewMode = 'top' | 'front' | 'side' | 'isometric';
export type ToolType = 'select' | 'line' | 'rectangle' | 'circle' | 'extrude' | 'erase';

export interface CADObject {
  id: string;
  mesh: THREE.Mesh | THREE.Line;
  type: ToolType;
  position: THREE.Vector3;
  rotation: THREE.Euler;
  scale: THREE.Vector3;
  createdAt: number;
  shapeKind?: 'line' | 'rectangle' | 'circle';
  shapePoints?: THREE.Vector2[];
  circleRadius?: number;
}

export interface CADEngineState {
  objects: CADObject[];
  selectedId: string | null;
  viewMode: ViewMode;
  activeTool: ToolType;
  orbitEnabled: boolean;
  isDrawing: boolean;
  touchCount: number;
}

export function useCADEngine() {
  const [state, setState] = useState<CADEngineState>({
    objects: [],
    selectedId: null,
    viewMode: 'top',
    activeTool: 'select',
    orbitEnabled: true,
    isDrawing: false,
    touchCount: 0,
  });

  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.OrthographicCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const animFrameRef = useRef<number>(0);
  const touchStartRef = useRef<THREE.Vector2>(new THREE.Vector2());
  const touchMovedRef = useRef(false);

  const genId = useCallback((): string => {
    return 'o' + Date.now() + Math.random().toString(36).slice(2, 9);
  }, []);

  const disposeObject = useCallback((obj: THREE.Object3D): void => {
    obj.traverse((child: THREE.Object3D) => {
      if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
        child.geometry?.dispose();
        const mat = child.material;
        if (Array.isArray(mat)) mat.forEach(m => m.dispose());
        else mat?.dispose();
      }
    });
    obj.removeFromParent();
  }, []);

  const initScene = useCallback((container: HTMLDivElement): void => {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e);
    sceneRef.current = scene;

    const w = container.clientWidth;
    const h = container.clientHeight;

    const camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 1000);
    camera.position.set(0, 0, 10);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    scene.add(new THREE.AmbientLight(0xffffff, 1));

    const grid = new THREE.GridHelper(20, 20, 0x555555, 0x333333);
    grid.rotation.x = Math.PI / 2;
    scene.add(grid);

    scene.add(new THREE.AxesHelper(5));

    const loop = (): void => {
      animFrameRef.current = requestAnimationFrame(loop);
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };
    loop();
  }, []);

  const handleTouchStart = useCallback((e: TouchEvent): void => {
    e.preventDefault();
    const count = e.touches.length;
    touchMovedRef.current = false;
    touchStartRef.current.set(e.touches[0].clientX, e.touches[0].clientY);

    if (count >= 2 || state.activeTool === 'select') {
      setState(prev => ({ ...prev, touchCount: count, isDrawing: false, orbitEnabled: count < 2 }));
      return;
    }

    setState(prev => ({ ...prev, touchCount: count, orbitEnabled: false, isDrawing: true }));
  }, [state.activeTool]);

  const handleTouchMove = useCallback((e: TouchEvent): void => {
    e.preventDefault();
    const count = e.touches.length;
    touchMovedRef.current = true;
    setState(prev => ({ ...prev, touchCount: count }));
  }, []);

  const handleTouchEnd = useCallback((e: TouchEvent): void => {
    e.preventDefault();
    const count = e.touches.length;
    setState(prev => ({ ...prev, touchCount: count, orbitEnabled: true, isDrawing: false }));

    if (touchMovedRef.current || state.activeTool === 'select') return;

    touchMovedRef.current = false;
    
    const startX = touchStartRef.current.x;
    const startY = touchStartRef.current.y;

    const rect = rendererRef.current?.domElement.getBoundingClientRect();
    if (!rect) return;

    const endX = e.changedTouches[0]?.clientX ?? startX;
    const endY = e.changedTouches[0]?.clientY ?? startY;

    const x1 = ((startX - rect.left) / rect.width) * 20 - 10;
    const y1 = -((startY - rect.top) / rect.height) * 20 + 10;
    const x2 = ((endX - rect.left) / rect.width) * 20 - 10;
    const y2 = -((endY - rect.top) / rect.height) * 20 + 10;

    if (Math.abs(x2 - x1) + Math.abs(y2 - y1) < 0.5) return;

    const id = genId();

    if (state.activeTool === 'line') {
      const g = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(x1, y1, 0),
        new THREE.Vector3(x2, y2, 0),
      ]);
      const mesh = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0x00ff00 }));
      sceneRef.current?.add(mesh);
      setState(prev => ({
        ...prev,
        objects: [...prev.objects, {
          id, mesh, type: 'line',
          position: new THREE.Vector3(0, 0, 0),
          rotation: new THREE.Euler(0, 0, 0),
          scale: new THREE.Vector3(1, 1, 1),
          createdAt: Date.now(),
          shapeKind: 'line',
          shapePoints: [new THREE.Vector2(x1, y1), new THREE.Vector2(x2, y2)],
        }],
      }));
    } else if (state.activeTool === 'rectangle') {
      const dx = x2 - x1;
      const dy = y2 - y1;
      const shape = new THREE.Shape();
      shape.moveTo(0, 0);
      shape.lineTo(dx, 0);
      shape.lineTo(dx, dy);
      shape.lineTo(0, dy);
      shape.closePath();
      const mesh = new THREE.Mesh(
        new THREE.ShapeGeometry(shape),
        new THREE.MeshStandardMaterial({ color: 0x4a90e2, side: THREE.DoubleSide })
      );
      mesh.position.set(x1, y1, 0);
      sceneRef.current?.add(mesh);
      setState(prev => ({
        ...prev,
        objects: [...prev.objects, {
          id, mesh, type: 'rectangle',
          position: new THREE.Vector3(x1, y1, 0),
          rotation: new THREE.Euler(0, 0, 0),
          scale: new THREE.Vector3(1, 1, 1),
          createdAt: Date.now(),
          shapeKind: 'rectangle',
          shapePoints: [new THREE.Vector2(x1, y1), new THREE.Vector2(x2, y1), new THREE.Vector2(x2, y2), new THREE.Vector2(x1, y2)],
        }],
      }));
    } else if (state.activeTool === 'circle') {
      const r = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
      const mesh = new THREE.Mesh(
        new THREE.CircleGeometry(r, 48),
        new THREE.MeshStandardMaterial({ color: 0xe24a4a, side: THREE.DoubleSide })
      );
      mesh.position.set(x1, y1, 0);
      sceneRef.current?.add(mesh);
      setState(prev => ({
        ...prev,
        objects: [...prev.objects, {
          id, mesh, type: 'circle',
          position: new THREE.Vector3(x1, y1, 0),
          rotation: new THREE.Euler(0, 0, 0),
          scale: new THREE.Vector3(1, 1, 1),
          createdAt: Date.now(),
          shapeKind: 'circle',
          circleRadius: r,
        }],
      }));
    }
  }, [genId, state.activeTool]);

  const selectObject = useCallback((id: string | null): void => {
    setState(prev => ({ ...prev, selectedId: id }));
  }, []);

  const setTool = useCallback((t: ToolType): void => {
    setState(prev => ({ ...prev, activeTool: t }));
  }, []);

  const setView = useCallback((v: ViewMode): void => {
    if (!cameraRef.current) return;
    let pos: THREE.Vector3;
    if (v === 'top') pos = new THREE.Vector3(0, 0, 10);
    else if (v === 'front') pos = new THREE.Vector3(0, 10, 0);
    else if (v === 'side') pos = new THREE.Vector3(10, 0, 0);
    else pos = new THREE.Vector3(7, 7, 7);

    cameraRef.current.position.copy(pos);
    cameraRef.current.lookAt(0, 0, 0);
    setState(prev => ({ ...prev, viewMode: v }));
  }, []);

  const executeExtrude = useCallback((id: string, dist: number = 2): void => {
    setState(prev => {
      const obj = prev.objects.find(o => o.id === id);
      if (!obj || !(obj.mesh instanceof THREE.Mesh)) return prev;

      const oldGeom = obj.mesh.geometry;
      obj.mesh.removeFromParent();

      let shape: THREE.Shape;
      if (obj.shapeKind === 'circle' && obj.circleRadius) {
        shape = new THREE.Shape();
        shape.absarc(0, 0, obj.circleRadius, 0, Math.PI * 2, false);
      } else if (obj.shapePoints && obj.shapePoints.length >= 3) {
        shape = new THREE.Shape();
        shape.moveTo(obj.shapePoints[0].x, obj.shapePoints[0].y);
        for (let i = 1; i < obj.shapePoints.length; i++) shape.lineTo(obj.shapePoints[i].x, obj.shapePoints[i].y);
        shape.closePath();
      } else {
        shape = new THREE.Shape();
        shape.moveTo(-1, -1);
        shape.lineTo(1, -1);
        shape.lineTo(1, 1);
        shape.lineTo(-1, 1);
        shape.closePath();
      }

      const newGeom = new THREE.ExtrudeGeometry(shape, {
        steps: 1,
        depth: dist,
        bevelEnabled: false,
      });

      oldGeom.dispose();
      obj.mesh.geometry = newGeom;
      obj.mesh.position.z = dist / 2;
      obj.mesh.rotation.x = 0;
      obj.mesh.rotation.y = 0;
      obj.position.z = dist / 2;
      sceneRef.current?.add(obj.mesh);

      return { ...prev };
    });
  }, []);

  const executeErase = useCallback((id: string): void => {
    setState(prev => {
      const obj = prev.objects.find(o => o.id === id);
      if (!obj) return prev;
      disposeObject(obj.mesh);
      return { ...prev, objects: prev.objects.filter(o => o.id !== id), selectedId: null };
    });
  }, [disposeObject]);

  const handleResize = useCallback((): void => {
    const c = rendererRef.current?.domElement.parentElement;
    if (!c || !rendererRef.current || !cameraRef.current) return;
    const w = c.clientWidth;
    const h = c.clientHeight;
    rendererRef.current.setSize(w, h);
    cameraRef.current.left = -10;
    cameraRef.current.right = 10;
    cameraRef.current.top = 10;
    cameraRef.current.bottom = -10;
    cameraRef.current.updateProjectionMatrix();
  }, []);

  useEffect(() => {
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animFrameRef.current);
      rendererRef.current?.dispose();
      rendererRef.current?.domElement.remove();
    };
  }, [handleResize]);

  return {
    state,
    initScene,
    setTool,
    setView,
    selectObject,
    executeExtrude,
    executeErase,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
  };
}