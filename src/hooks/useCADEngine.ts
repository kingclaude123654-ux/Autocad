// src/hooks/useCADEngine.ts
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

const initialState: CADEngineState = {
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
};

export function useCADEngine() {
  const [state, setState] = useState<CADEngineState>(initialState);

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
    controls.dampingFactor = 0.1;
    controls.target.set(0, 0, 0);
    controls.enablePan = true;
    controls.enableZoom = true;
    controls.enableRotate = true;
    controlsRef.current = controls;

    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const dl = new THREE.DirectionalLight(0xffffff, 0.9);
    dl.position.set(5, 10, 5);
    scene.add(dl);
    const dl2 = new THREE.DirectionalLight(0xffffff, 0.4);
    dl2.position.set(-5, 0, -5);
    scene.add(dl2);

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
        if (Array.isArray(mat)) mat.forEach((x: THREE.Material) => disposeMaterial(x));
        else disposeMaterial(mat as THREE.Material);
      }
      if (child instanceof THREE.Line) {
        child.geometry?.dispose();
        const mat = child.material;
        if (Array.isArray(mat)) mat.forEach((x: THREE.Material) => x.dispose());
        else (mat as THREE.Material)?.dispose();
      }
    });
    obj.removeFromParent();
  }, [disposeMaterial]);

  const clearPreview = useCallback((): void => {
    setState((prev: CADEngineState): CADEngineState => {
      if (prev.previewMesh) disposeObject(prev.previewMesh);
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
      if (h.length > 50) h.shift();
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

  const genId = useCallback((): string => 'o_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9), []);

  const addObject = useCallback((mesh: THREE.Mesh | THREE.Line | THREE.Group, type: ToolType): string => {
    const id = genId();
    const obj: CADObject = {
      id, mesh, type,
      geometry: mesh instanceof THREE.Mesh ? mesh.geometry : (mesh as THREE.Line).geometry,
      material: mesh.material,
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
      if (prevObj?.mesh instanceof THREE.Mesh) {
        const m = prevObj.mesh.material;
        if (m instanceof THREE.MeshStandardMaterial) { m.emissive?.set(0); m.emissiveIntensity = 0; }
      }
      if (prevObj?.mesh instanceof THREE.Line) {
        const m = prevObj.mesh.material;
        if (m instanceof THREE.LineBasicMaterial) m.color.set(0x00ff00);
      }
      const newObj = id ? prev.objects.find((o: CADObject): boolean => o.id === id) : null;
      if (newObj?.mesh instanceof THREE.Mesh) {
        const m = newObj.mesh.material;
        if (m instanceof THREE.MeshStandardMaterial) { m.emissive?.set(0x444444); m.emissiveIntensity = 0.5; }
      }
      if (newObj?.mesh instanceof THREE.Line) {
        const m = newObj.mesh.material;
        if (m instanceof THREE.LineBasicMaterial) m.color.set(0xffff00);
      }
      return { ...prev, selectedId: id };
    });
  }, []);

  // Lock camera - critical for view stability
  const lockView = useCallback((vm: ViewMode): void => {
    if (!cameraRef.current || !controlsRef.current) return;
    const cam = cameraRef.current;
    const ctrl = controlsRef.current;
    let pos: THREE.Vector3;
    let up = new THREE.Vector3(0, 1, 0);
    switch (vm) {
      case 'top': pos = new THREE.Vector3(0, 10, 0.001); up.set(0, 0, -1); break;
      case 'front': pos = new THREE.Vector3(0, 0, 10); break;
      case 'side': pos = new THREE.Vector3(10, 0, 0); break;
      default: pos = new THREE.Vector3(7, 7, 7); break;
    }
    cam.position.copy(pos);
    ctrl.target.set(0, 0, 0);
    ctrl.up.copy(up);
    ctrl.update();
    // Disable controls temporarily to lock view
    ctrl.enableRotate = false;
    ctrl.enablePan = false;
    ctrl.enableZoom = false;
    setTimeout(() => {
      if (controlsRef.current) {
        controlsRef.current.enableRotate = true;
        controlsRef.current.enablePan = true;
        controlsRef.current.enableZoom = true;
      }
    }, 100);
    setState((prev: CADEngineState): CADEngineState => ({ ...prev, viewMode: vm }));
  }, []);

  const toggleOrtho = useCallback((): void => {
    const container = rendererRef.current?.domElement.parentElement;
    if (!container || !cameraRef.current) return;
    const w = container.clientWidth, h = container.clientHeight;
    setState((prev: CADEngineState): CADEngineState => {
      const ortho = !prev.orthoMode;
      const p = cameraRef.current!.position.clone();
      const r = cameraRef.current!.rotation.clone();
      if (ortho) {
        const s = 10;
        cameraRef.current = new THREE.OrthographicCamera(-s * w / h / 2, s * w / h / 2, s / 2, -s / 2, 0.1, 1000);
      } else {
        cameraRef.current = new THREE.PerspectiveCamera(60, w / h, 0.1, 1000);
      }
      cameraRef.current.position.copy(p);
      cameraRef.current.rotation.copy(r);
      if (controlsRef.current) (controlsRef.current as any).object = cameraRef.current;
      return { ...prev, orthoMode: ortho };
    });
  }, []);

  // Get point on ground plane (Y=0) - all 2D drawing on this plane
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
      if (o.mesh instanceof THREE.Mesh || o.mesh instanceof THREE.Line) targets.push(o.mesh);
      else if (o.mesh instanceof THREE.Group) o.mesh.traverse((c: THREE.Object3D) => { if (c instanceof THREE.Mesh) targets.push(c); });
    });
    const hits = raycasterRef.current.intersectObjects(targets, false);
    if (hits.length > 0) {
      for (const o of state.objects) {
        if (o.mesh === hits[0].object) return o.id;
        if (o.mesh instanceof THREE.Group) {
          let p: THREE.Object3D | null = hits[0].object;
          while (p) { if (p === o.mesh) return o.id; p = p.parent; }
        }
      }
    }
    return null;
  }, [state.objects]);

  // TOUCH HANDLERS - 1 finger draw, 2 fingers camera
  const handleTouchStart = useCallback((e: TouchEvent): void => {
    e.preventDefault();
    const count = e.touches.length;
    setState((prev: CADEngineState): CADEngineState => ({ ...prev, touchCount: count }));

    // 2+ fingers = camera control only, don't draw
    if (count >= 2) return;

    // 1 finger
    const t = e.touches[0];
    if (state.activeTool === 'select') {
      const id = pickObject(t.clientX, t.clientY);
      selectObject(id);
      return;
    }

    // Drawing tools
    const pt = getGroundPoint(t.clientX, t.clientY);
    if (!pt) return;
    const sp = state.snapEnabled ? snap(pt) : pt;
    setState((prev: CADEngineState): CADEngineState => ({
      ...prev, isDrawing: true, drawingStartPoint: sp,
    }));
  }, [state.activeTool, state.snapEnabled, pickObject, selectObject, getGroundPoint, snap]);

  const handleTouchMove = useCallback((e: TouchEvent): void => {
    e.preventDefault();
    const count = e.touches.length;
    setState((prev: CADEngineState): CADEngineState => ({ ...prev, touchCount: count }));

    // 2+ fingers = camera control
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

    switch (state.activeTool) {
      case 'line': {
        const g = new THREE.BufferGeometry().setFromPoints([sp, cp]);
        preview = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xffff00 }));
        break;
      }
      case 'rectangle': {
        const dx = cp.x - sp.x;
        const dz = cp.z - sp.z;
        const shape = new THREE.Shape();
        shape.moveTo(0, 0);
        shape.lineTo(dx, 0);
        shape.lineTo(dx, dz);
        shape.lineTo(0, dz);
        shape.closePath();
        const g = new THREE.ShapeGeometry(shape);
        const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0xffff00, side: THREE.DoubleSide, transparent: true, opacity: 0.5 }));
        mesh.position.copy(sp);
        mesh.rotation.x = -Math.PI / 2;
        preview = mesh;
        break;
      }
      case 'circle': {
        const r = sp.distanceTo(cp);
        const g = new THREE.CircleGeometry(r, 48);
        const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0xffff00, side: THREE.DoubleSide, transparent: true, opacity: 0.5 }));
        mesh.position.copy(sp);
        mesh.rotation.x = -Math.PI / 2;
        preview = mesh;
        break;
      }
      case 'polyline': {
        const g = new THREE.BufferGeometry().setFromPoints([sp, cp]);
        preview = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xffff00 }));
        break;
      }
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

    // Get last known point from touch move or use start
    const sp = state.drawingStartPoint;
    // We need the end point - use raycaster with last touch position
    let cp = sp.clone();
    if (e.changedTouches.length > 0) {
      const t = e.changedTouches[0];
      const pt = getGroundPoint(t.clientX, t.clientY);
      if (pt) cp = state.snapEnabled ? snap(pt) : pt;
    }

    const minDist = 0.1;
    if (sp.distanceTo(cp) < minDist) {
      setState((prev: CADEngineState): CADEngineState => ({ ...prev, isDrawing: false, drawingStartPoint: null }));
      return;
    }

    switch (state.activeTool) {
      case 'line': {
        const g = new THREE.BufferGeometry().setFromPoints([sp, cp]);
        addObject(new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0x00ff00 })), 'line');
        break;
      }
      case 'rectangle': {
        const dx = cp.x - sp.x;
        const dz = cp.z - sp.z;
        const shape = new THREE.Shape();
        shape.moveTo(0, 0);
        shape.lineTo(dx, 0);
        shape.lineTo(dx, dz);
        shape.lineTo(0, dz);
        shape.closePath();
        const g = new THREE.ShapeGeometry(shape);
        const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0x4a90e2, side: THREE.DoubleSide }));
        mesh.position.copy(sp);
        mesh.rotation.x = -Math.PI / 2;
        addObject(mesh, 'rectangle');
        break;
      }
      case 'circle': {
        const r = sp.distanceTo(cp);
        const g = new THREE.CircleGeometry(r, 48);
        const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0xe24a4a, side: THREE.DoubleSide }));
        mesh.position.copy(sp);
        mesh.rotation.x = -Math.PI / 2;
        addObject(mesh, 'circle');
        break;
      }
      case 'polyline': {
        const g = new THREE.BufferGeometry().setFromPoints([sp, cp]);
        addObject(new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0x00ff00 })), 'polyline');
        break;
      }
    }

    setState((prev: CADEngineState): CADEngineState => ({ ...prev, isDrawing: false, drawingStartPoint: null }));
  }, [state.isDrawing, state.drawingStartPoint, state.activeTool, state.snapEnabled, clearPreview, getGroundPoint, snap, addObject]);

  // Extrude - makes 2D flat shape into 3D
  const executeExtrude = useCallback((id: string, dist: number): void => {
    setState((prev: CADEngineState): CADEngineState => {
      const obj = prev.objects.find((o: CADObject): boolean => o.id === id);
      if (!obj || !(obj.mesh instanceof THREE.Mesh)) return prev;

      const oldGeom = obj.mesh.geometry;
      obj.mesh.removeFromParent();

      const extSettings: THREE.ExtrudeGeometryOptions = { steps: 1, depth: dist, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 2 };
      const shape = new THREE.Shape();
      const attr = oldGeom.getAttribute('position');
      
      if (attr.count > 2) {
        const pts: THREE.Vector2[] = [];
        for (let i = 0; i < attr.count; i++) pts.push(new THREE.Vector2(attr.getX(i), attr.getY(i)));
        shape.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i].x, pts[i].y);
        shape.closePath();
      } else {
        shape.moveTo(-1, -1); shape.lineTo(1, -1); shape.lineTo(1, 1); shape.lineTo(-1, 1); shape.closePath();
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
      const shape = new THREE.Shape();
      const w = 2, h = 2, r = Math.min(radius, w / 2, h / 2);
      shape.moveTo(-w / 2 + r, -h / 2); shape.lineTo(w / 2 - r, -h / 2);
      shape.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r); shape.lineTo(w / 2, h / 2 - r);
      shape.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2); shape.lineTo(-w / 2 + r, h / 2);
      shape.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r); shape.lineTo(-w / 2, -h / 2 + r);
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
    const w = c.clientWidth, h = c.clientHeight;
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
    return JSON.stringify({
      objects: state.objects.map((o: CADObject) => ({
        id: o.id, type: o.type,
        position: o.position.toArray(),
        rotation: [o.rotation.x, o.rotation.y, o.rotation.z],
        scale: o.scale.toArray(),
        createdAt: o.createdAt,
      })),
      viewMode: state.viewMode,
      orthoMode: state.orthoMode,
    });
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
          mesh.position.copy(pos); mesh.rotation.copy(rot); mesh.scale.copy(scl);
          sceneRef.current?.add(mesh);
          newObjs.push({
            id: od.id || genId(), mesh, type: od.type as ToolType,
            geometry: mesh.geometry, material: mesh.material,
            position: pos, rotation: rot, scale: scl,
            createdAt: od.createdAt || Date.now(),
          });
        });
      }
      setState((prev: CADEngineState): CADEngineState => ({ ...prev, objects: newObjs, selectedId: null }));
      if (d.viewMode) lockView(d.viewMode);
    } catch (e) { console.error('Import failed:', e); }
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