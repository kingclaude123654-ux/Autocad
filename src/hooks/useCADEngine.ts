Let me create completely fresh, properly formatted files. I'll write them character by character to ensure no truncation.

src/hooks/useCADEngine.ts:

```typescript
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

  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | THREE.OrthographicCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const gridHelperRef = useRef<THREE.GridHelper | null>(null);
  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster());
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
    if (m instanceof THREE.MeshStandardMaterial) {
      m.map?.dispose();
      m.normalMap?.dispose();
      m.roughnessMap?.dispose();
      m.metalnessMap?.dispose();
    }
    m.dispose();
  }, []);

  const disposeObject = useCallback((obj: THREE.Object3D): void => {
    obj.traverse((child: THREE.Object3D) => {
      if (child instanceof THREE.Mesh) {
        child.geometry?.dispose();
        const mat = child.material;
        if (Array.isArray(mat)) {
          mat.forEach((x: THREE.Material) => disposeMaterial(x));
        } else {
          disposeMaterial(mat as THREE.Material);
        }
      }
      if (child instanceof THREE.Line) {
        child.geometry?.dispose();
        const mat = child.material;
        if (Array.isArray(mat)) {
          mat.forEach((x: THREE.Material) => x.dispose());
        } else {
          (mat as THREE.Material)?.dispose();
        }
      }
    });
    obj.removeFromParent();
  }, [disposeMaterial]);

  const clearPreview = useCallback((): void => {
    setState((prev: CADEngineState): CADEngineState => {
      if (prev.previewMesh) {
        disposeObject(prev.previewMesh);
      }
      return { ...prev, previewMesh: null };
    });
  }, [disposeObject]);

  const saveHistory = useCallback((objs: CADObject[], sel: string | null): void => {
    setState((prev: CADEngineState): CADEngineState => {
      const h = prev.history.slice(0, prev.historyIndex + 1);
      h.push({
        objects: objs.map((o: CADObject): CADObject => ({
          ...o,
          position: o.position.clone(),
          rotation: o.rotation.clone(),
          scale: o.scale.clone(),
        })),
        selectedId: sel,
        timestamp: Date.now(),
      });
      if (h.length > 50) {
        h.shift();
      }
      return { ...prev, history: h, historyIndex: h.length - 1 };
    });
  }, []);

  const undo = useCallback((): void => {
    setState((prev: CADEngineState): CADEngineState => {
      if (prev.historyIndex <= 0) return prev;
      const idx = prev.historyIndex - 1;
      const item = prev.history[idx];
      prev.objects.forEach((o: CADObject) => { o.mesh.removeFromParent(); });
      item.objects.forEach((o: CADObject) => { sceneRef.current?.add(o.mesh); });
      return { ...prev, objects: item.objects, selectedId: item.selectedId, historyIndex: idx };
    });
  }, []);

  const redo = useCallback((): void => {
    setState((prev: CADEngineState): CADEngineState => {
      if (prev.historyIndex >= prev.history.length - 1) return prev;
      const idx = prev.historyIndex + 1;
      const item = prev.history[idx];
      prev.objects.forEach((o: CADObject) => { o.mesh.removeFromParent(); });
      item.objects.forEach((o: CADObject) => { sceneRef.current?.add(o.mesh); });
      return { ...prev, objects: item.objects, selectedId: item.selectedId, historyIndex: idx };
    });
  }, []);

  const genId = useCallback((): string => {
    return 'o_' + Date.now().toString() + '_' + Math.random().toString(36).slice(2, 9);
  }, []);

  const getMeshMaterial = (mesh: THREE.Mesh | THREE.Line | THREE.Group): THREE.Material | THREE.Material[] => {
    if (mesh instanceof THREE.Mesh) return mesh.material;
    if (mesh instanceof THREE.Line) return mesh.material;
    return new THREE.MeshStandardMaterial();
  };

  const getMeshGeometry = (mesh: THREE.Mesh | THREE.Line | THREE.Group): THREE.BufferGeometry => {
    if (mesh instanceof THREE.Mesh) return mesh.geometry;
    if (mesh instanceof THREE.Line) return mesh.geometry;
    return new THREE.BufferGeometry();
  };

  const addObject = useCallback((mesh: THREE.Mesh | THREE.Line | THREE.Group, type: ToolType): string => {
    const id = genId();
    const obj: CADObject = {
      id, mesh, type,
      geometry: getMeshGeometry(mesh),
      material: getMeshMaterial(mesh),
      position: mesh.position.clone(),
      rotation: mesh.rotation.clone(),
      scale: mesh.scale.clone(),
      createdAt: Date.now(),
    };
    sceneRef.current?.add(mesh);
    setState((prev: CADEngineState): CADEngineState => {
      const objs = [...prev.objects, obj];
      saveHistory(objs, prev.selectedId);
      return { ...prev, objects: objs };
    });
    return id;
  }, [genId, saveHistory]);

  const selectObject = useCallback((id: string | null): void => {
    setState((prev: CADEngineState): CADEngineState => {
      const prevObj = prev.selectedId ? prev.objects.find((o: CADObject): boolean => o.id === prev.selectedId) : null;
      if (prevObj) {
        const mat = getMeshMaterial(prevObj.mesh);
        if (mat instanceof THREE.MeshStandardMaterial) {
          mat.emissive?.set(0);
          mat.emissiveIntensity = 0;
        }
        if (mat instanceof THREE.LineBasicMaterial) {
          mat.color.set(0x00ff00);
        }
      }
      const newObj = id ? prev.objects.find((o: CADObject): boolean => o.id === id) : null;
      if (newObj) {
        const mat = getMeshMaterial(newObj.mesh);
        if (mat instanceof THREE.MeshStandardMaterial) {
          mat.emissive?.set(0x444444);
          mat.emissiveIntensity = 0.5;
        }
        if (mat instanceof THREE.LineBasicMaterial) {
          mat.color.set(0xffff00);
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
    if (vm === 'top') {
      pos = new THREE.Vector3(0, 10, 0.001);
    } else if (vm === 'front') {
      pos = new THREE.Vector3(0, 0, 10);
    } else if (vm === 'side') {
      pos = new THREE.Vector3(10, 0, 0);
    } else {
      pos = new THREE.Vector3(7, 7, 7);
    }
    cam.position.copy(pos);
    ctrl.target.set(0, 0, 0);
    ctrl.update();
    setState((prev: CADEngineState): CADEngineState => ({ ...prev, viewMode: vm }));
  }, []);

  const toggleOrtho = useCallback((): void => {
    const container = rendererRef.current?.domElement.parentElement;
    if (!container || !cameraRef.current) return;
    const w = container.clientWidth;
    const h = container.clientHeight;
    setState((prev: CADEngineState): CADEngineState => {
      const ortho = !prev.orthoMode;
      const p = cameraRef.current!.position.clone();
      if (ortho) {
        const s = 10;
        const oc = new THREE.OrthographicCamera(-s * w / h / 2, s * w / h / 2, s / 2, -s / 2, 0.1, 1000);
        oc.position.copy(p);
        cameraRef.current = oc;
      } else {
        const pc = new THREE.PerspectiveCamera(60, w / h, 0.1, 1000);
        pc.position.copy(p);
        cameraRef.current = pc;
      }
      if (controlsRef.current) {
        (controlsRef.current as any).object = cameraRef.current;
      }
      return { ...prev, orthoMode: ortho };
    });
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
    state.objects.forEach((o: CADObject) => {
      if (o.mesh instanceof THREE.Mesh || o.mesh instanceof THREE.Line) {
        targets.push(o.mesh);
      }
    });
    const hits = raycasterRef.current.intersectObjects(targets, false);
    if (hits.length > 0) {
      for (const o of state.objects) {
        if (o.mesh === hits[0].object) return o.id;
      }
    }
    return null;
  }, [state.objects]);

  const handleTouchStart = useCallback((e: TouchEvent): void => {
    e.preventDefault();
    const count = e.touches.length;
    setState((prev: CADEngineState): CADEngineState => ({ ...prev, touchCount: count }));
    if (count >= 2) return;
    const t = e.touches[0];
    if (state.activeTool === 'select') {
      const id = pickObject(t.clientX, t.clientY);
      selectObject(id);
      return;
    }
    const pt = getGroundPoint(t.clientX, t.clientY);
    if (!pt) return;
    const sp = state.snapEnabled ? snap(pt) : pt;
    setState((prev: CADEngineState): CADEngineState => ({ ...prev, isDrawing: true, drawingStartPoint: sp }));
  }, [state.activeTool, state.snapEnabled, pickObject, selectObject, getGroundPoint, snap]);

  const handleTouchMove = useCallback((e: TouchEvent): void => {
    e.preventDefault();
    const count = e.touches.length;
    setState((prev: CADEngineState): CADEngineState => ({ ...prev, touchCount: count }));
    if (count >= 2) {
      if (state.isDrawing) {
        clearPreview();
        setState((prev: CADEngineState): CADEngineState => ({ ...prev, isDrawing: false, drawingStartPoint: null }));
      }
      return;
    }
    if (!state.isDrawing || !state.drawingStartPoint) return;
    const t = e.touches[0];
    const pt = getGroundPoint(t.clientX, t.clientY);
    if (!pt) return;
    const cp = state.snapEnabled ? snap(pt) : pt;
    clearPreview();
    const sp = state.drawingStartPoint;
    let preview: THREE.Mesh | THREE.Line | null = null;
    if (state.activeTool === 'line') {
      const g = new THREE.BufferGeometry().setFromPoints([sp, cp]);
      preview = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xffff00 }));
    } else if (state.activeTool === 'rectangle') {
      const dx = cp.x - sp.x;
      const dz = cp.z - sp.z;
      const shape = new THREE.Shape();
      shape.moveTo(0, 0);
      shape.lineTo(dx, 0);
      shape.lineTo(dx, dz);
      shape.lineTo(0, dz);
      shape.closePath();
      const g = new THREE.ShapeGeometry(shape);
      const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0xffff00, side: THREE.DoubleSide, transparent: true, opacity: 0.5 }));
      m.position.copy(sp);
      m.rotation.x = -Math.PI / 2;
      preview = m;
    } else if (state.activeTool === 'circle') {
      const r = sp.distanceTo(cp);
      const g = new THREE.CircleGeometry(r, 48);
      const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0xffff00, side: THREE.DoubleSide, transparent: true, opacity: 0.5 }));
      m.position.copy(sp);
      m.rotation.x = -Math.PI / 2;
      preview = m;
    } else if (state.activeTool === 'polyline') {
      const g = new THREE.BufferGeometry().setFromPoints([sp, cp]);
      preview = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xffff00 }));
    }
    if (preview) sceneRef.current?.add(preview);
    setState((prev: CADEngineState): CADEngineState => ({ ...prev, previewMesh: preview }));
  }, [state.isDrawing, state.drawingStartPoint, state.activeTool, state.snapEnabled, getGroundPoint, snap, clearPreview]);

  const handleTouchEnd = useCallback((e: TouchEvent): void => {
    e.preventDefault();
    const count = e.touches.length;
    setState((prev: CADEngineState): CADEngineState => ({ ...prev, touchCount: count }));
    if (!state.isDrawing || !state.drawingStartPoint) return;
    clearPreview();
    const sp = state.drawingStartPoint;
    let cp = sp.clone();
    if (e.changedTouches.length > 0) {
      const t = e.changedTouches[0];
      const pt = getGroundPoint(t.clientX, t.clientY);
      if (pt) cp = state.snapEnabled ? snap(pt) : pt;
    }
    if (sp.distanceTo(cp) < 0.1) {
      setState((prev: CADEngineState): CADEngineState => ({ ...prev, isDrawing: false, drawingStartPoint: null }));
      return;
    }
    if (state.activeTool === 'line') {
      const g = new THREE.BufferGeometry().setFromPoints([sp, cp]);
      addObject(new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0x00ff00 })), 'line');
    } else if (state.activeTool === 'rectangle') {
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
    } else if (state.activeTool === 'circle') {
      const r = sp.distanceTo(cp);
      const m = new THREE.Mesh(new THREE.CircleGeometry(r, 48), new THREE.MeshStandardMaterial({ color: 0xe24a4a, side: THREE.DoubleSide }));
      m.position.copy(sp);
      m.rotation.x = -Math.PI / 2;
      addObject(m, 'circle');
    } else if (state.activeTool === 'polyline') {
      const g = new THREE.BufferGeometry().setFromPoints([sp, cp]);
      addObject(new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0x00ff00 })), 'polyline');
    }
    setState((prev: CADEngineState): CADEngineState => ({ ...prev, isDrawing: false, drawingStartPoint: null }));
  }, [state.isDrawing, state.drawingStartPoint, state.activeTool, state.snapEnabled, clearPreview, getGroundPoint, snap, addObject]);

  const executeExtrude = useCallback((id: string, dist: number): void => {
    setState((prev: CADEngineState): CADEngineState => {
      const obj = prev.objects.find((o: CADObject): boolean => o.id === id);
      if (!obj || !(obj.mesh instanceof THREE.Mesh)) return prev;
      const oldGeom = obj.mesh.geometry;
      obj.mesh.removeFromParent();
      const extSettings: THREE.ExtrudeGeometryOptions = {
        steps: 1,
        depth: dist,
        bevelEnabled: true,
        bevelThickness: 0.05,
        bevelSize: 0.05,
        bevelSegments: 2,
      };
      const shape = new THREE.Shape();
      const attr = oldGeom.getAttribute('position');
      if (attr.count > 2) {
        const pts: THREE.Vector2[] = [];
        for (let i = 0; i < attr.count; i++) {
          pts.push(new THREE.Vector2(attr.getX(i), attr.getY(i)));
        }
        shape.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) {
          shape.lineTo(pts[i].x, pts[i].y);
        }
        shape.closePath();
      } else {
        shape.moveTo(-1, -1);
        shape.lineTo(1, -1);
        shape.lineTo(1, 1);
        shape.lineTo(-1, 1);
        shape.closePath();
      }
      const newGeom = new THREE.ExtrudeGeometry(shape, extSettings);
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
    setState((prev: CADEngineState): CADEngineState => {
      const obj = prev.objects.find((o: CADObject): boolean => o.id === id);
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
    setState((prev: CADEngineState): CADEngineState => {
      const obj = prev.objects.find((o: CADObject): boolean => o.id === id);
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
    setState((prev: CADEngineState): CADEngineState => {
      const obj = prev.objects.find((o: CADObject): boolean => o.id === id);
      if (!obj) return prev;
      obj.mesh.scale.set(sx, sy, sz);
      obj.scale.copy(obj.mesh.scale);
      saveHistory(prev.objects, prev.selectedId);
      return { ...prev };
    });
  }, [saveHistory]);

  const executeErase = useCallback((id: string): void => {
    setState((prev: CADEngineState): CADEngineState => {
      const obj = prev.objects.find((o: CADObject): boolean => o.id === id);
      if (!obj) return prev;
      disposeObject(obj.mesh);
      const objs = prev.objects.filter((o: CADObject): boolean => o.id !== id);
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
      cameraRef.current.left = -s * w / h / 2;
      cameraRef.current.right = s * w / h / 2;
      cameraRef.current.top = s / 2;
      cameraRef.current.bottom = -s / 2;
      cameraRef.current.updateProjectionMatrix();
    }
    rendererRef.current.setSize(w, h);
  }, []);

  const exportScene = useCallback((): string => {
    const data = {
      objects: state.objects.map((o: CADObject) => ({
        id: o.id,
        type: o.type,
        position: o.position.toArray(),
        rotation: [o.rotation.x, o.rotation.y, o.rotation.z],
        scale: o.scale.toArray(),
        createdAt: o.createdAt,
      })),
      viewMode: state.viewMode,
      orthoMode: state.orthoMode,
    };
    return JSON.stringify(data);
  }, [state.objects, state.viewMode, state.orthoMode]);

  const importScene = useCallback((json: string): void => {
    try {
      const d = JSON.parse(json);
      state.objects.forEach((o: CADObject) => disposeObject(o.mesh));
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
            mesh = new THREE.Mesh(new THREE.CircleGeometry(1, 48), new THREE.MeshStandardMaterial({ color: od.type === 'circle' ? 0xe24a4a : 0x4a90e2, side: THREE.DoubleSide }));
          }
          mesh.position.copy(pos);
          mesh.rotation.copy(rot);
          mesh.scale.copy(scl);
          sceneRef.current?.add(mesh);
          newObjs.push({
            id: od.id || genId(),
            mesh,
            type: od.type as ToolType,
            geometry: mesh instanceof THREE.Mesh ? mesh.geometry : (mesh as THREE.Line).geometry,
            material: mesh.material,
            position: pos,
            rotation: rot,
            scale: scl,
            createdAt: od.createdAt || Date.now(),
          });
        });
      }
      setState((prev: CADEngineState): CADEngineState => ({ ...prev, objects: newObjs, selectedId: null }));
      if (d.viewMode) lockView(d.viewMode);
    } catch (e) {
      console.error('Import failed:', e);
    }
  }, [state.objects, disposeObject, genId, lockView]);

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
    setActiveTool: (t: ToolType) => setState((prev: CADEngineState): CADEngineState => ({ ...prev, activeTool: t, isDrawing: false, drawingStartPoint: null })),
    selectObject,
    lockView,
    toggleOrthoMode: toggleOrtho,
    setSnapEnabled: (e: boolean) => setState((prev: CADEngineState): CADEngineState => ({ ...prev, snapEnabled: e })),
    setGridVisible: (v: boolean) => {
      if (gridHelperRef.current) gridHelperRef.current.visible = v;
      setState((prev: CADEngineState): CADEngineState => ({ ...prev, gridVisible: v }));
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
```

src/App.tsx:

```typescript
import React, { useEffect, useRef, useCallback, useState } from 'react';
import { useCADEngine } from './hooks/useCADEngine';

const S = {
  app: { display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', backgroundColor: '#1a1a2e', color: '#fff', fontFamily: 'sans-serif', overflow: 'hidden', userSelect: 'none', touchAction: 'none' } as React.CSSProperties,
  canvas: { flex: 1, position: 'relative', overflow: 'hidden', backgroundColor: '#1a1a2e', touchAction: 'none' } as React.CSSProperties,
  bar: { display: 'flex', overflowX: 'auto', padding: '6px 8px', backgroundColor: '#16213e', borderBottom: '1px solid #0f3460', gap: 4, minHeight: 40, alignItems: 'center', flexWrap: 'nowrap' } as React.CSSProperties,
  bbar: { display: 'flex', overflowX: 'auto', padding: '6px 8px', backgroundColor: '#16213e', borderTop: '1px solid #0f3460', gap: 4, minHeight: 44, alignItems: 'center', justifyContent: 'center' } as React.CSSProperties,
  status: { display: 'flex', justifyContent: 'space-between', padding: '3px 8px', backgroundColor: '#0f3460', fontSize: 10, color: '#aaa', minHeight: 22, alignItems: 'center' } as React.CSSProperties,
};

const B = (a: boolean): React.CSSProperties => ({ padding: '6px 10px', backgroundColor: a ? '#e94560' : '#0f3460', color: '#fff', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: a ? 'bold' : 'normal', whiteSpace: 'nowrap', minWidth: 40, minHeight: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' });
const SB: React.CSSProperties = { ...B(false), fontSize: 10, padding: '4px 8px', minHeight: 32 };
const TB = (a: boolean): React.CSSProperties => ({ ...B(a), borderRadius: 20 });
const AB: React.CSSProperties = { ...B(false), fontSize: 11, padding: '8px 12px', minHeight: 40 };
const Sep: React.CSSProperties = { width: 1, height: 24, backgroundColor: '#0f3460', margin: '0 2px' };

const App: React.FC = () => {
  const ref = useRef<HTMLDivElement>(null);
  const finp = useRef<HTMLInputElement>(null);
  const e = useCADEngine();
  const { state, initScene, undo, redo, lockView, toggleOrthoMode, setSnapEnabled, setGridVisible, executeExtrude, executeFillet, executeRotate, executeScale, executeErase, handleTouchStart, handleTouchMove, handleTouchEnd, handleResize, exportScene, importScene } = e;
  const [ui, setUi] = useState(true);

  useEffect(() => {
    if (ref.current) initScene(ref.current);
    window.addEventListener('resize', handleResize);
    return () => { window.removeEventListener('resize', handleResize); };
  }, [initScene, handleResize]);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    c.addEventListener('touchstart', handleTouchStart, { passive: false });
    c.addEventListener('touchmove', handleTouchMove, { passive: false });
    c.addEventListener('touchend', handleTouchEnd, { passive: false });
    return () => {
      c.removeEventListener('touchstart', handleTouchStart);
      c.removeEventListener('touchmove', handleTouchMove);
      c.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  const save = useCallback(() => {
    const j = exportScene();
    const b = new Blob([j], { type: 'application/json' });
    const u = URL.createObjectURL(b);
    const a = document.createElement