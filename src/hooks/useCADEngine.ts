import { useState, useCallback, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export type ViewMode = 'top' | 'front' | 'side' | 'isometric';
export type ToolType = 'line' | 'polyline' | 'rectangle' | 'circle' | 'select' | 'extrude' | 'fillet' | 'rotate' | 'scale' | 'erase';

export interface CADObject {
  id: string;
  mesh: THREE.Mesh | THREE.Line | THREE.Group;
  type: ToolType;
  geometry: THREE.BufferGeometry;
  material: THREE.Material | THREE.Material[];
  position: THREE.Vector3;
  rotation: THREE.Euler;
  scale: THREE.Vector3;
  createdAt: number;
}

export interface HistoryAction {
  objects: CADObject[];
  selectedId: string | null;
  timestamp: number;
}

export interface CADEngineState {
  objects: CADObject[];
  selectedId: string | null;
  viewMode: ViewMode;
  orthoMode: boolean;
  activeTool: ToolType;
  history: HistoryAction[];
  historyIndex: number;
  snapEnabled: boolean;
  gridVisible: boolean;
  isDrawing: boolean;
  drawingStartPoint: THREE.Vector3 | null;
  previewMesh: THREE.Mesh | THREE.Line | null;
  touchCount: number;
}

export function useCADEngine() {
  const [state, setState] = useState<CADEngineState>({
    objects: [],
    selectedId: null,
    viewMode: 'isometric',
    orthoMode: false,
    activeTool: 'select',
    history: [],
    historyIndex: -1,
    snapEnabled: true,
    gridVisible: true,
    isDrawing: false,
    drawingStartPoint: null,
    previewMesh: null,
    touchCount: 0,
  });

  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | THREE.OrthographicCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const gridHelperRef = useRef<THREE.GridHelper | null>(null);
  const raycasterRef = useRef(new THREE.Raycaster());
  const animFrameRef = useRef<number>(0);

  const initScene = useCallback((container: HTMLDivElement): void => {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e);
    sceneRef.current = scene;

    const w = container.clientWidth;
    const h = container.clientHeight;

    const camera = new THREE.PerspectiveCamera(60, w / h, 0.1, 1000);
    camera.position.set(8, 8, 8);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.target.set(0, 0, 0);
    controlsRef.current = controls;

    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const dl = new THREE.DirectionalLight(0xffffff, 0.9);
    dl.position.set(5, 10, 5);
    scene.add(dl);

    const grid = new THREE.GridHelper(20, 20, 0x555555, 0x333333);
    scene.add(grid);
    gridHelperRef.current = grid;
    scene.add(new THREE.AxesHelper(5));

    let last = 0;
    const loop = (t: number): void => {
      animFrameRef.current = requestAnimationFrame(loop);
      if (t - last < 32) return;
      last = t;
      controlsRef.current?.update();
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };
    loop(0);
  }, []);

  const disposeMaterial = useCallback((m: THREE.Material): void => {
    if ((m as THREE.MeshStandardMaterial).map) (m as THREE.MeshStandardMaterial).map?.dispose();
    if ((m as THREE.MeshStandardMaterial).normalMap) (m as THREE.MeshStandardMaterial).normalMap?.dispose();
    if ((m as THREE.MeshStandardMaterial).roughnessMap) (m as THREE.MeshStandardMaterial).roughnessMap?.dispose();
    if ((m as THREE.MeshStandardMaterial).metalnessMap) (m as THREE.MeshStandardMaterial).metalnessMap?.dispose();
    m.dispose();
  }, []);

  const disposeObject = useCallback((obj: THREE.Object3D): void => {
    obj.traverse((child: THREE.Object3D) => {
      if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
        child.geometry?.dispose();
        const mat = child.material;
        if (Array.isArray(mat)) mat.forEach(disposeMaterial);
        else mat?.dispose();
      }
    });
    obj.removeFromParent();
  }, [disposeMaterial]);

  const saveHistory = useCallback((objs: CADObject[], sel: string | null): void => {
    setState((prev) => {
      const h = prev.history.slice(0, prev.historyIndex + 1);
      h.push({
        objects: objs.map((o) => ({
          ...o,
          position: o.position.clone(),
          rotation: o.rotation.clone(),
          scale: o.scale.clone(),
        })),
        selectedId: sel,
        timestamp: Date.now(),
      });
      if (h.length > 50) h.shift();
      return { ...prev, history: h, historyIndex: h.length - 1 };
    });
  }, []);

  const clearPreview = useCallback((): void => {
    setState(prev => {
      if (prev.previewMesh) disposeObject(prev.previewMesh);
      return { ...prev, previewMesh: null };
    });
  }, [disposeObject]);

  const undo = useCallback((): void => {
    setState((prev) => {
      if (prev.historyIndex <= 0) return prev;
      const idx = prev.historyIndex - 1;
      const item = prev.history[idx];
      prev.objects.forEach((o) => o.mesh.removeFromParent());
      item.objects.forEach((o) => sceneRef.current?.add(o.mesh));
      return { ...prev, objects: item.objects, selectedId: item.selectedId, historyIndex: idx };
    });
  }, []);

  const redo = useCallback((): void => {
    setState((prev) => {
      if (prev.historyIndex >= prev.history.length - 1) return prev;
      const idx = prev.historyIndex + 1;
      const item = prev.history[idx];
      prev.objects.forEach((o) => o.mesh.removeFromParent());
      item.objects.forEach((o) => sceneRef.current?.add(o.mesh));
      return { ...prev, objects: item.objects, selectedId: item.selectedId, historyIndex: idx };
    });
  }, []);

  const genId = useCallback((): string => 'o' + Date.now() + Math.random().toString(36).slice(2, 9), []);

  const addObject = useCallback((mesh: THREE.Mesh | THREE.Line | THREE.Group, type: ToolType): string => {
    const id = genId();
    const obj: CADObject = {
      id,
      mesh,
      type,
      geometry: mesh instanceof THREE.Mesh ? mesh.geometry : mesh instanceof THREE.Line ? mesh.geometry : new THREE.BufferGeometry(),
      material: mesh instanceof THREE.Mesh || mesh instanceof THREE.Line ? mesh.material : new THREE.MeshStandardMaterial(),
      position: mesh.position.clone(),
      rotation: mesh.rotation.clone(),
      scale: mesh.scale.clone(),
      createdAt: Date.now(),
    };

    sceneRef.current?.add(mesh);
    setState((prev) => {
      const objs = [...prev.objects, obj];
      saveHistory(objs, prev.selectedId);
      return { ...prev, objects: objs };
    });
    return id;
  }, [genId, saveHistory]);

  const selectObject = useCallback((id: string | null): void => {
    setState((prev) => {
      const prevObj = prev.selectedId ? prev.objects.find((o) => o.id === prev.selectedId) : null;
      if (prevObj && prevObj.mesh instanceof THREE.Mesh) {
        const mat = prevObj.mesh.material;
        if (mat instanceof THREE.MeshStandardMaterial) {
          mat.emissive?.set(0);
          mat.emissiveIntensity = 0;
        }
      }

      const newObj = id ? prev.objects.find((o) => o.id === id) : null;
      if (newObj && newObj.mesh instanceof THREE.Mesh) {
        const mat = newObj.mesh.material;
        if (mat instanceof THREE.MeshStandardMaterial) {
          mat.emissive?.set(0x444444);
          mat.emissiveIntensity = 0.5;
        }
      }

      return { ...prev, selectedId: id };
    });
  }, []);

  const lockView = useCallback((vm: ViewMode): void => {
    if (!cameraRef.current || !controlsRef.current) return;
    const cam = cameraRef.current;
    const ctrl = controlsRef.current;

    let pos: THREE.Vector3;
    if (vm === 'top') pos = new THREE.Vector3(0, 10, 0.001);
    else if (vm === 'front') pos = new THREE.Vector3(0, 0, 10);
    else if (vm === 'side') pos = new THREE.Vector3(10, 0, 0);
    else pos = new THREE.Vector3(7, 7, 7);

    cam.position.copy(pos);
    ctrl.target.set(0, 0, 0);
    ctrl.update();
    setState(prev => ({ ...prev, viewMode: vm }));
  }, []);

  const toggleOrtho = useCallback((): void => {
    const container = rendererRef.current?.domElement.parentElement;
    if (!container || !cameraRef.current || !controlsRef.current) return;

    const w = container.clientWidth;
    const h = container.clientHeight;
    const ortho = !stateRef.current.orthoMode;
    const p = cameraRef.current.position.clone();

    const nextCamera = ortho
      ? new THREE.OrthographicCamera((-10 * w) / h / 2, (10 * w) / h / 2, 5, -5, 0.1, 1000)
      : new THREE.PerspectiveCamera(60, w / h, 0.1, 1000);

    nextCamera.position.copy(p);
    nextCamera.lookAt(0, 0, 0);
    cameraRef.current = nextCamera;
    controlsRef.current.object = nextCamera;
    controlsRef.current.update();

    setState(prev => ({ ...prev, orthoMode: ortho }));
  }, []);

  const getGroundPoint = useCallback((x: number, y: number): THREE.Vector3 | null => {
    if (!rendererRef.current || !cameraRef.current) return null;
    const rect = rendererRef.current.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2(((x - rect.left) / rect.width) * 2 - 1, -((y - rect.top) / rect.height) * 2 + 1);
    raycasterRef.current.setFromCamera(mouse, cameraRef.current);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const pt = new THREE.Vector3();
    return raycasterRef.current.ray.intersectPlane(plane, pt) ? pt : null;
  }, []);

  const snap = useCallback((pt: THREE.Vector3): THREE.Vector3 => {
    return new THREE.Vector3(Math.round(pt.x * 2) / 2, 0, Math.round(pt.z * 2) / 2);
  }, []);

  const pickObject = useCallback((x: number, y: number): string | null => {
    if (!rendererRef.current || !cameraRef.current) return null;
    const rect = rendererRef.current.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2(((x - rect.left) / rect.width) * 2 - 1, -((y - rect.top) / rect.height) * 2 + 1);
    raycasterRef.current.setFromCamera(mouse, cameraRef.current);
    const targets: THREE.Object3D[] = [];
    stateRef.current.objects.forEach((o) => {
      if (o.mesh instanceof THREE.Mesh || o.mesh instanceof THREE.Line) targets.push(o.mesh);
    });
    const hits = raycasterRef.current.intersectObjects(targets, false);
    if (hits.length > 0) {
      for (const o of stateRef.current.objects) {
        if (o.mesh === hits[0].object) return o.id;
      }
    }
    return null;
  }, []);

  const handleTouchStart = useCallback((e: TouchEvent): void => {
    e.preventDefault();
    const count = e.touches.length;
    setState(prev => ({ ...prev, touchCount: count }));
    if (count >= 2) return;

    const t = e.touches[0];
    if (stateRef.current.activeTool === 'select') {
      const id = pickObject(t.clientX, t.clientY);
      selectObject(id);
      return;
    }

    const pt = getGroundPoint(t.clientX, t.clientY);
    if (!pt) return;
    const sp = stateRef.current.snapEnabled ? snap(pt) : pt;
    setState(prev => ({ ...prev, isDrawing: true, drawingStartPoint: sp }));
  }, [pickObject, selectObject, getGroundPoint, snap]);

  const handleTouchMove = useCallback((e: TouchEvent): void => {
    e.preventDefault();
    const count = e.touches.length;
    setState(prev => ({ ...prev, touchCount: count }));
    if (count >= 2) {
      if (stateRef.current.isDrawing) {
        clearPreview();
        setState(prev => ({ ...prev, isDrawing: false, drawingStartPoint: null }));
      }
      return;
    }
    if (!stateRef.current.isDrawing || !stateRef.current.drawingStartPoint) return;

    const t = e.touches[0];
    const pt = getGroundPoint(t.clientX, t.clientY);
    if (!pt) return;

    const cp = stateRef.current.snapEnabled ? snap(pt) : pt;
    clearPreview();
    const sp = stateRef.current.drawingStartPoint;
    let preview: THREE.Mesh | THREE.Line | null = null;

    if (stateRef.current.activeTool === 'line') {
      const g = new THREE.BufferGeometry().setFromPoints([sp, cp]);
      preview = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xffff00 }));
    } else if (stateRef.current.activeTool === 'rectangle') {
      const dx = cp.x - sp.x;
      const dz = cp.z - sp.z;
      const shape = new THREE.Shape();
      shape.moveTo(0, 0);
      shape.lineTo(dx, 0);
      shape.lineTo(dx, dz);
      shape.lineTo(0, dz);
      shape.closePath();
      const m = new THREE.Mesh(
        new THREE.ShapeGeometry(shape),
        new THREE.MeshStandardMaterial({ color: 0xffff00, side: THREE.DoubleSide, transparent: true, opacity: 0.5 })
      );
      m.position.copy(sp);
      m.rotation.x = -Math.PI / 2;
      preview = m;
    } else if (stateRef.current.activeTool === 'circle') {
      const r = sp.distanceTo(cp);
      const g = new THREE.CircleGeometry(r, 48);
      const m = new THREE.Mesh(
        g,
        new THREE.MeshStandardMaterial({ color: 0xffff00, side: THREE.DoubleSide, transparent: true, opacity: 0.5 })
      );
      m.position.copy(sp);
      m.rotation.x = -Math.PI / 2;
      preview = m;
    } else if (stateRef.current.activeTool === 'polyline') {
      const g = new THREE.BufferGeometry().setFromPoints([sp, cp]);
      preview = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xffff00 }));
    }

    if (preview) sceneRef.current?.add(preview);
    setState(prev => ({ ...prev, previewMesh: preview }));
  }, [getGroundPoint, snap, clearPreview]);

  const handleTouchEnd = useCallback((e: TouchEvent): void => {
    e.preventDefault();
    const count = e.touches.length;
    setState(prev => ({ ...prev, touchCount: count }));

    if (!stateRef.current.isDrawing || !stateRef.current.drawingStartPoint) return;

    clearPreview();
    const sp = stateRef.current.drawingStartPoint;
    let cp = sp.clone();

    if (e.changedTouches.length > 0) {
      const t = e.changedTouches[0];
      const pt = getGroundPoint(t.clientX, t.clientY);
      if (pt) cp = stateRef.current.snapEnabled ? snap(pt) : pt;
    }

    if (sp.distanceTo(cp) < 0.1) {
      setState(prev => ({ ...prev, isDrawing: false, drawingStartPoint: null }));
      return;
    }

    if (stateRef.current.activeTool === 'line') {
      const g = new THREE.BufferGeometry().setFromPoints([sp, cp]);
      addObject(new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0x00ff00 })), 'line');
    } else if (stateRef.current.activeTool === 'rectangle') {
      const dx = cp.x - sp.x;
      const dz = cp.z - sp.z;
      const shape = new THREE.Shape();
      shape.moveTo(0, 0);
      shape.lineTo(dx, 0);
      shape.lineTo(dx, dz);
      shape.lineTo(0, dz);
      shape.closePath();
      const m = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshStandardMaterial({ color: 0x4a90e2, side: THREE.DoubleSide }));
      m.position.copy(sp);
      m.rotation.x = -Math.PI / 2;
      addObject(m, 'rectangle');
    } else if (stateRef.current.activeTool === 'circle') {
      const r = sp.distanceTo(cp);
      const m = new THREE.Mesh(new THREE.CircleGeometry(r, 48), new THREE.MeshStandardMaterial({ color: 0xe24a4a, side: THREE.DoubleSide }));
      m.position.copy(sp);
      m.rotation.x = -Math.PI / 2;
      addObject(m, 'circle');
    } else if (stateRef.current.activeTool === 'polyline') {
      const g = new THREE.BufferGeometry().setFromPoints([sp, cp]);
      addObject(new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0x00ff00 })), 'polyline');
    }

    setState(prev => ({ ...prev, isDrawing: false, drawingStartPoint: null }));
  }, [addObject, clearPreview, getGroundPoint, snap]);

  const executeExtrude = useCallback((id: string, dist: number): void => {
    setState((prev) => {
      const obj = prev.objects.find((o) => o.id === id);
      if (!obj || !(obj.mesh instanceof THREE.Mesh)) return prev;
      const oldGeom = obj.mesh.geometry;
      obj.mesh.removeFromParent();

      const shape = new THREE.Shape();
      const attr = oldGeom.getAttribute('position');
      if (attr.count > 2) {
        const pts: THREE.Vector2[] = [];
        for (let i = 0; i < attr.count; i++) pts.push(new THREE.Vector2(attr.getX(i), attr.getY(i)));
        shape.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i].x, pts[i].y);
        shape.closePath();
      } else {
        shape.moveTo(-1, -1);
        shape.lineTo(1, -1);
        shape.lineTo(1, 1);
        shape.lineTo(-1, 1);
        shape.closePath();
      }

      const newGeom = new THREE.ExtrudeGeometry(shape, {
        steps: 1,
        depth: dist,
        bevelEnabled: true,
        bevelThickness: 0.05,
        bevelSize: 0.05,
        bevelSegments: 2,
      });

      oldGeom.dispose();
      obj.mesh.geometry = newGeom;
      obj.mesh.rotation.set(0, 0, 0);
      obj.mesh.position.y += dist / 2;
      obj.geometry = newGeom;
      obj.position.copy(obj.mesh.position);
      obj.rotation.copy(obj.mesh.rotation);
      sceneRef.current?.add(obj.mesh);
      saveHistory(prev.objects, prev.selectedId);
      return { ...prev };
    });
  }, [saveHistory]);

  const executeFillet = useCallback((id: string, radius: number): void => {
    setState((prev) => {
      const obj = prev.objects.find((o) => o.id === id);
      if (!obj || !(obj.mesh instanceof THREE.Mesh)) return prev;
      obj.mesh.removeFromParent();
      const w = 2;
      const h = 2;
      const r = Math.min(radius, w / 2, h / 2);
      const shape = new THREE.Shape();
      shape.moveTo(-w / 2 + r, -h / 2);
      shape.lineTo(w / 2 - r, -h / 2);
      shape.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
      shape.lineTo(w / 2, h / 2 - r);
      shape.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
      shape.lineTo(-w / 2 + r, h / 2);
      shape.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
      shape.lineTo(-w / 2, -h / 2 + r);
      shape.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);

      obj.mesh.geometry.dispose();
      obj.mesh.geometry = new THREE.ShapeGeometry(shape);
      obj.geometry = obj.mesh.geometry;
      sceneRef.current?.add(obj.mesh);
      saveHistory(prev.objects, prev.selectedId);
      return { ...prev };
    });
  }, [saveHistory]);

  const executeRotate = useCallback((id: string, axis: string, angle: number): void => {
    setState((prev) => {
      const obj = prev.objects.find((o) => o.id === id);
      if (!obj) return prev;
      if (axis === 'x') obj.mesh.rotation.x += angle;
      else if (axis === 'y') obj.mesh.rotation.y += angle;
      else obj.mesh.rotation.z += angle;
      obj.rotation.copy(obj.mesh.rotation);
      saveHistory(prev.objects, prev.selectedId);
      return { ...prev };
    });
  }, [saveHistory]);

  const executeScale = useCallback((id: string, sx: number, sy: number, sz: number): void => {
    setState((prev) => {
      const obj = prev.objects.find((o) => o.id === id);
      if (!obj) return prev;
      obj.mesh.scale.set(sx, sy, sz);
      obj.scale.copy(obj.mesh.scale);
      saveHistory(prev.objects, prev.selectedId);
      return { ...prev };
    });
  }, [saveHistory]);

  const executeErase = useCallback((id: string): void => {
    setState((prev) => {
      const obj = prev.objects.find((o) => o.id === id);
      if (!obj) return prev;
      disposeObject(obj.mesh);
      const objs = prev.objects.filter((o) => o.id !== id);
      const sel = prev.selectedId === id ? null : prev.selectedId;
      saveHistory(objs, sel);
      return { ...prev, objects: objs, selectedId: sel };
    });
  }, [disposeObject, saveHistory]);

  const handleResize = useCallback((): void => {
    const c = rendererRef.current?.domElement.parentElement;
    if (!c || !rendererRef.current || !cameraRef.current) return;
    const w = c.clientWidth;
    const h = c.clientHeight;

    if (cameraRef.current instanceof THREE.PerspectiveCamera) {
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
    } else {
      const s = 10;
      cameraRef.current.left = (-s * w) / h / 2;
      cameraRef.current.right = (s * w) / h / 2;
      cameraRef.current.top = s / 2;
      cameraRef.current.bottom = -s / 2;
      cameraRef.current.updateProjectionMatrix();
    }

    rendererRef.current.setSize(w, h);
  }, []);

  const exportScene = useCallback((): string => {
    const data = {
      objects: stateRef.current.objects.map((o) => ({
        id: o.id,
        type: o.type,
        position: o.position.toArray(),
        rotation: [o.rotation.x, o.rotation.y, o.rotation.z],
        scale: o.scale.toArray(),
        createdAt: o.createdAt,
      })),
      viewMode: stateRef.current.viewMode,
      orthoMode: stateRef.current.orthoMode,
    };
    return JSON.stringify(data);
  }, []);

  const importScene = useCallback((json: string): void => {
    try {
      const d = JSON.parse(json);
      stateRef.current.objects.forEach((o) => disposeObject(o.mesh));

      const newObjs: CADObject[] = [];
      if (Array.isArray(d.objects)) {
        d.objects.forEach((od: any) => {
          const pos = new THREE.Vector3(od.position[0], od.position[1], od.position[2]);
          const rot = new THREE.Euler(od.rotation[0], od.rotation[1], od.rotation[2]);
          const scl = new THREE.Vector3(od.scale[0], od.scale[1], od.scale[2]);

          let mesh: THREE.Mesh | THREE.Line;
          if (od.type === 'line' || od.type === 'polyline') {
            mesh = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0x00ff00 }));
          } else {
            mesh = new THREE.Mesh(new THREE.CircleGeometry(1, 48), new THREE.MeshStandardMaterial({ color: 0x4a90e2, side: THREE.DoubleSide }));
          }

          mesh.position.copy(pos);
          mesh.rotation.copy(rot);
          mesh.scale.copy(scl);
          sceneRef.current?.add(mesh);

          newObjs.push({
            id: od.id || genId(),
            mesh,
            type: od.type as ToolType,
            geometry: mesh instanceof THREE.Mesh ? mesh.geometry : mesh.geometry,
            material: mesh.material,
            position: pos,
            rotation: rot,
            scale: scl,
            createdAt: od.createdAt || Date.now(),
          });
        });
      }

      setState(prev => ({ ...prev, objects: newObjs, selectedId: null }));
      stateRef.current = { ...stateRef.current, objects: newObjs, selectedId: null };
      if (d.viewMode) lockView(d.viewMode);
    } catch (err) {
      console.error('Import failed:', err);
    }
  }, [disposeObject, genId, lockView]);

  useEffect(() => {
    return () => {
      cancelAnimationFrame(animFrameRef.current);
      rendererRef.current?.dispose();
      rendererRef.current?.domElement.remove();
    };
  }, []);

  return {
    state,
    initScene,
    undo,
    redo,
    setActiveTool: (t: ToolType) => setState(prev => ({ ...prev, activeTool: t, isDrawing: false, drawingStartPoint: null })),
    selectObject,
    lockView,
    toggleOrthoMode: toggleOrtho,
    setSnapEnabled: (e: boolean) => setState(prev => ({ ...prev, snapEnabled: e })),
    setGridVisible: (v: boolean) => {
      if (gridHelperRef.current) gridHelperRef.current.visible = v;
      setState(prev => ({ ...prev, gridVisible: v }));
    },
    executeExtrude,
    executeFillet,
    executeRotate,
    executeScale,
    executeErase,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleResize,
    exportScene,
    importScene,
    addObject,
  };
}