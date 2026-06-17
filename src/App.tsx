import { useState, useCallback, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export type ViewMode = 'top' | 'front' | 'side' | 'isometric';
export type ToolType =
  | 'line'
  | 'polyline'
  | 'rectangle'
  | 'circle'
  | 'select'
  | 'extrude'
  | 'fillet'
  | 'rotate'
  | 'scale'
  | 'erase';

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
  shapePoints?: THREE.Vector2[];
  shapeKind?: 'line' | 'rectangle' | 'circle' | 'polyline';
  circleRadius?: number;
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

  const gestureModeRef = useRef<'idle' | 'draw' | 'cam'>('idle');

  const disposeMaterial = useCallback((m: THREE.Material): void => {
    const mm = m as THREE.MeshStandardMaterial;
    mm.map?.dispose();
    mm.normalMap?.dispose();
    mm.roughnessMap?.dispose();
    mm.metalnessMap?.dispose();
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

  const genId = useCallback((): string => {
    return 'o' + Date.now() + Math.random().toString(36).slice(2, 9);
  }, []);

  const saveHistory = useCallback((objs: CADObject[], sel: string | null): void => {
    setState(prev => {
      const h = prev.history.slice(0, prev.historyIndex + 1);
      h.push({
        objects: objs.map(o => ({
          ...o,
          position: o.position.clone(),
          rotation: o.rotation.clone(),
          scale: o.scale.clone(),
          shapePoints: o.shapePoints ? o.shapePoints.map(p => p.clone()) : undefined,
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
    controls.enableRotate = true;
    controls.enablePan = true;
    controls.enableZoom = true;
    controls.target.set(0, 0, 0);
    controlsRef.current = controls;

    scene.add(new THREE.AmbientLight(0xffffff, 0.75));
    const dl = new THREE.DirectionalLight(0xffffff, 0.95);
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

  const setCameraLock = useCallback((locked: boolean): void => {
    if (!controlsRef.current) return;
    controlsRef.current.enabled = !locked;
    controlsRef.current.enableRotate = !locked;
    controlsRef.current.enablePan = !locked;
    controlsRef.current.enableZoom = !locked;
  }, []);

  const addObject = useCallback((mesh: THREE.Mesh | THREE.Line | THREE.Group, type: ToolType, extra?: Partial<CADObject>): string => {
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
      ...extra,
    };
    sceneRef.current?.add(mesh);
    setState(prev => {
      const objs = [...prev.objects, obj];
      saveHistory(objs, prev.selectedId);
      return { ...prev, objects: objs };
    });
    return id;
  }, [genId, saveHistory]);

  const selectObject = useCallback((id: string | null): void => {
    setState(prev => {
      const prevObj = prev.selectedId ? prev.objects.find(o => o.id === prev.selectedId) : null;
      if (prevObj && prevObj.mesh instanceof THREE.Mesh) {
        const mat = prevObj.mesh.material;
        if (mat instanceof THREE.MeshStandardMaterial) {
          mat.emissive?.set(0);
          mat.emissiveIntensity = 0;
        }
      }
      const newObj = id ? prev.objects.find(o => o.id === id) : null;
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

    setCameraLock(false);

    let pos: THREE.Vector3;
    if (vm === 'top') pos = new THREE.Vector3(0, 10, 0.001);
    else if (vm === 'front') pos = new THREE.Vector3(0, 0, 10);
    else if (vm === 'side') pos = new THREE.Vector3(10, 0, 0);
    else pos = new THREE.Vector3(7, 7, 7);

    cameraRef.current.position.copy(pos);
    controlsRef.current.target.set(0, 0, 0);
    controlsRef.current.update();

    setState(prev => ({ ...prev, viewMode: vm }));
  }, [setCameraLock]);

  const toggleOrtho = useCallback((): void => {
    const container = rendererRef.current?.domElement.parentElement;
    if (!container || !cameraRef.current || !controlsRef.current) return;

    const w = container.clientWidth;
    const h = container.clientHeight;
    const ortho = !stateRef.current.orthoMode;
    const p = cameraRef.current.position.clone();

    let nextCamera: THREE.PerspectiveCamera | THREE.OrthographicCamera;

    if (ortho) {
      const s = 10;
      nextCamera = new THREE.OrthographicCamera((-s * w) / h / 2, (s * w) / h / 2, s / 2, -s / 2, 0.1, 1000);
    } else {
      nextCamera = new THREE.PerspectiveCamera(60, w / h, 0.1, 1000);
    }

    nextCamera.position.copy(p);
    nextCamera.lookAt(0, 0, 0);
    cameraRef.current = nextCamera;
    controlsRef.current.object = nextCamera;
    controlsRef.current.target.set(0, 0, 0);
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
    stateRef.current.objects.forEach(o => {
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

  const makeRectPoints = (sp: THREE.Vector3, cp: THREE.Vector3): THREE.Vector2[] => {
    return [
      new THREE.Vector2(sp.x, sp.z),
      new THREE.Vector2(cp.x, sp.z),
      new THREE.Vector2(cp.x, cp.z),
      new THREE.Vector2(sp.x, cp.z),
    ];
  };

  const createLineMesh = (sp: THREE.Vector3, cp: THREE.Vector3, color: number) => {
    const g = new THREE.BufferGeometry().setFromPoints([sp, cp]);
    return new THREE.Line(g, new THREE.LineBasicMaterial({ color }));
  };

  const createRectMesh = (sp: THREE.Vector3, cp: THREE.Vector3, color: number, opacity = 1) => {
    const dx = cp.x - sp.x;
    const dz = cp.z - sp.z;
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(dx, 0);
    shape.lineTo(dx, dz);
    shape.lineTo(0, dz);
    shape.closePath();
    const mesh = new THREE.Mesh(
      new THREE.ShapeGeometry(shape),
      new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide, transparent: opacity < 1, opacity })
    );
    mesh.position.copy(sp);
    mesh.rotation.x = -Math.PI / 2;
    return mesh;
  };

  const createCircleMesh = (sp: THREE.Vector3, cp: THREE.Vector3, color: number, opacity = 1) => {
    const r = sp.distanceTo(cp);
    const mesh = new THREE.Mesh(
      new THREE.CircleGeometry(r, 48),
      new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide, transparent: opacity < 1, opacity })
    );
    mesh.position.copy(sp);
    mesh.rotation.x = -Math.PI / 2;
    return mesh;
  };

  const handleTouchStart = useCallback((e: TouchEvent): void => {
    e.preventDefault();
    const count = e.touches.length;
    setState(prev => ({ ...prev, touchCount: count }));

    if (count >= 2) {
      gestureModeRef.current = 'cam';
      setCameraLock(false);
      return;
    }

    const t = e.touches[0];
    if (stateRef.current.activeTool === 'select') {
      const id = pickObject(t.clientX, t.clientY);
      selectObject(id);
      return;
    }

    gestureModeRef.current = 'draw';
    setCameraLock(true);

    const pt = getGroundPoint(t.clientX, t.clientY);
    if (!pt) return;
    const sp = stateRef.current.snapEnabled ? snap(pt) : pt;
    setState(prev => ({ ...prev, isDrawing: true, drawingStartPoint: sp }));
  }, [pickObject, selectObject, getGroundPoint, snap, setCameraLock]);

  const handleTouchMove = useCallback((e: TouchEvent): void => {
    e.preventDefault();
    const count = e.touches.length;
    setState(prev => ({ ...prev, touchCount: count }));

    if (count >= 2) {
      gestureModeRef.current = 'cam';
      clearPreview();
      setState(prev => ({ ...prev, isDrawing: false, drawingStartPoint: null }));
      setCameraLock(false);
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
      preview = createLineMesh(sp, cp, 0xffff00);
    } else if (stateRef.current.activeTool === 'rectangle') {
      preview = createRectMesh(sp, cp, 0xffff00, 0.45);
    } else if (stateRef.current.activeTool === 'circle') {
      preview = createCircleMesh(sp, cp, 0xffff00, 0.45);
    } else if (stateRef.current.activeTool === 'polyline') {
      preview = createLineMesh(sp, cp, 0xffff00);
    }

    if (preview) sceneRef.current?.add(preview);
    setState(prev => ({ ...prev, previewMesh: preview }));
  }, [getGroundPoint, snap, clearPreview, setCameraLock]);

  const handleTouchEnd = useCallback((e: TouchEvent): void => {
    e.preventDefault();
    const count = e.touches.length;
    setState(prev => ({ ...prev, touchCount: count }));

    if (count === 0 && gestureModeRef.current === 'cam') {
      gestureModeRef.current = 'idle';
      return;
    }

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
      setCameraLock(false);
      return;
    }

    if (stateRef.current.activeTool === 'line') {
      const mesh = createLineMesh(sp, cp, 0x00ff00);
      addObject(mesh, 'line', { shapeKind: 'line', shapePoints: [new THREE.Vector2(sp.x, sp.z), new THREE.Vector2(cp.x, cp.z)] });
    } else if (stateRef.current.activeTool === 'rectangle') {
      const mesh = createRectMesh(sp, cp, 0x4a90e2, 1);
      addObject(mesh, 'rectangle', { shapeKind: 'rectangle', shapePoints: makeRectPoints(sp, cp) });
    } else if (stateRef.current.activeTool === 'circle') {
      const mesh = createCircleMesh(sp, cp, 0xe24a4a, 1);
      addObject(mesh, 'circle', { shapeKind: 'circle', circleRadius: sp.distanceTo(cp) });
    } else if (stateRef.current.activeTool === 'polyline') {
      const mesh = createLineMesh(sp, cp, 0x00ff00);
      addObject(mesh, 'polyline', { shapeKind: 'polyline', shapePoints: [new THREE.Vector2(sp.x, sp.z), new THREE.Vector2(cp.x, cp.z)] });
    }

    setState(prev => ({ ...prev, isDrawing: false, drawingStartPoint: null }));
    gestureModeRef.current = 'idle';
    setCameraLock(false);
  }, [addObject, clearPreview, getGroundPoint, snap, setCameraLock]);

  const executeExtrude = useCallback((id: string, dist: number): void => {
    setState(prev => {
      const obj = prev.objects.find(o => o.id === id);
      if (!obj || !(obj.mesh instanceof THREE.Mesh)) return prev;

      const oldGeom = obj.mesh.geometry;
      obj.mesh.removeFromParent();

      let shape: THREE.Shape;

      if (obj.shapeKind === 'circle' && obj.circleRadius) {
        const s = new THREE.Shape();
        s.absarc(0, 0, obj.circleRadius, 0, Math.PI * 2, false);
        shape = s;
        obj.mesh.position.y = dist / 2;
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
        bevelEnabled: true,
        bevelThickness: 0.05,
        bevelSize: 0.05,
        bevelSegments: 2,
      });

      oldGeom.dispose();
      obj.mesh.geometry = newGeom;
      obj.mesh.rotation.set(0, 0, 0);
      obj.mesh.position.y = dist / 2;
      obj.geometry = newGeom;
      obj.position.copy(obj.mesh.position);
      obj.rotation.copy(obj.mesh.rotation);
      sceneRef.current?.add(obj.mesh);
      saveHistory(prev.objects, prev.selectedId);
      return { ...prev };
    });
  }, [saveHistory]);

  const executeFillet = useCallback((id: string, radius: number): void => {
    setState(prev => {
      const obj = prev.objects.find(o => o.id === id);
      if (!obj || !(obj.mesh instanceof THREE.Mesh) || obj.shapeKind !== 'rectangle') return prev;
      if (!obj.shapePoints || obj.shapePoints.length < 4) return prev;

      obj.mesh.removeFromParent();

      const xs = obj.shapePoints.map(p => p.x);
      const ys = obj.shapePoints.map(p => p.y);
      const minX = Math.min(...xs), maxX = Math.max(...xs);
      const minY = Math.min(...ys), maxY = Math.max(...ys);
      const w = Math.max(0.1, maxX - minX);
      const h = Math.max(0.1, maxY - minY);
      const r = Math.min(radius, w / 2, h / 2);

      const shape = new THREE.Shape();
      shape.moveTo(minX + r, minY);
      shape.lineTo(maxX - r, minY);
      shape.quadraticCurveTo(maxX, minY, maxX, minY + r);
      shape.lineTo(maxX, maxY - r);
      shape.quadraticCurveTo(maxX, maxY, maxX - r, maxY);
      shape.lineTo(minX + r, maxY);
      shape.quadraticCurveTo(minX, maxY, minX, maxY - r);
      shape.lineTo(minX, minY + r);
      shape.quadraticCurveTo(minX, minY, minX + r, minY);

      const geom = new THREE.ShapeGeometry(shape);
      const mat = new THREE.MeshStandardMaterial({ color: 0x4a90e2, side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.set(0, 0, 0);
      mesh.rotation.x = -Math.PI / 2;

      obj.mesh.geometry.dispose();
      obj.mesh = mesh;
      obj.geometry = geom;
      obj.material = mat;
      obj.shapePoints = [
        new THREE.Vector2(minX + r, minY),
        new THREE.Vector2(maxX - r, minY),
        new THREE.Vector2(maxX, minY + r),
        new THREE.Vector2(maxX, maxY - r),
        new THREE.Vector2(maxX - r, maxY),
        new THREE.Vector2(minX + r, maxY),
        new THREE.Vector2(minX, maxY - r),
        new THREE.Vector2(minX, minY + r),
      ];
      sceneRef.current?.add(mesh);
      saveHistory(prev.objects, prev.selectedId);
      return { ...prev };
    });
  }, [saveHistory]);

  const executeRotate = useCallback((id: string, axis: string, angle: number): void => {
    setState(prev => {
      const obj = prev.objects.find(o => o.id === id);
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
    setState(prev => {
      const obj = prev.objects.find(o => o.id === id);
      if (!obj) return prev;
      obj.mesh.scale.set(sx, sy, sz);
      obj.scale.copy(obj.mesh.scale);
      saveHistory(prev.objects, prev.selectedId);
      return { ...prev };
    });
  }, [saveHistory]);

  const executeErase = useCallback((id: string): void => {
    setState(prev => {
      const obj = prev.objects.find(o => o.id === id);
      if (!obj) return prev;
      disposeObject(obj.mesh);
      const objs = prev.objects.filter(o => o.id !== id);
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
      objects: stateRef.current.objects.map(o => ({
        id: o.id,
        type: o.type,
        position: o.position.toArray(),
        rotation: [o.rotation.x, o.rotation.y, o.rotation.z],
        scale: o.scale.toArray(),
        createdAt: o.createdAt,
        shapeKind: o.shapeKind,
        shapePoints: o.shapePoints?.map(p => [p.x, p.y]),
        circleRadius: o.circleRadius,
      })),
      viewMode: stateRef.current.viewMode,
      orthoMode: stateRef.current.orthoMode,
    };
    return JSON.stringify(data);
  }, []);

  const importScene = useCallback((json: string): void => {
    try {
      const d = JSON.parse(json);
      stateRef.current.objects.forEach(o => disposeObject(o.mesh));
      const newObjs: CADObject[] = [];

      if (Array.isArray(d.objects)) {
        d.objects.forEach((od: any) => {
          const pos = new THREE.Vector3(od.position[0], od.position[1], od.position[2]);
          const rot = new THREE.Euler(od.rotation[0], od.rotation[1], od.rotation[2]);
          const scl = new THREE.Vector3(od.scale[0], od.scale[1], od.scale[2]);

          let mesh: THREE.Mesh | THREE.Line;
          let shapeKind = od.shapeKind as CADObject['shapeKind'] | undefined;
          let shapePoints: THREE.Vector2[] | undefined;
          let circleRadius: number | undefined;

          if (shapeKind === 'line' || od.type === 'line' || od.type === 'polyline') {
            const pts = od.shapePoints?.map((p: number[]) => new THREE.Vector2(p[0], p[1])) ?? [new THREE.Vector2(-1, 0), new THREE.Vector2(1, 0)];
            shapePoints = pts;
            const g = new THREE.BufferGeometry().setFromPoints([
              new THREE.Vector3(pts[0].x, 0, pts[0].y),
              new THREE.Vector3(pts[pts.length - 1].x, 0, pts[pts.length - 1].y),
            ]);
            mesh = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0x00ff00 }));
          } else if (shapeKind === 'circle' || od.type === 'circle') {
            circleRadius = od.circleRadius ?? 1;
            mesh = new THREE.Mesh(
              new THREE.CircleGeometry(circleRadius, 48),
              new THREE.MeshStandardMaterial({ color: 0xe24a4a, side: THREE.DoubleSide })
            );
            mesh.rotation.x = -Math.PI / 2;
          } else {
            shapePoints = od.shapePoints?.map((p: number[]) => new THREE.Vector2(p[0], p[1])) ?? [
              new THREE.Vector2(-1, -1),
              new THREE.Vector2(1, -1),
              new THREE.Vector2(1, 1),
              new THREE.Vector2(-1, 1),
            ];
            const minX = Math.min(...shapePoints.map(p => p.x));
            const maxX = Math.max(...shapePoints.map(p => p.x));
            const minY = Math.min(...shapePoints.map(p => p.y));
            const maxY = Math.max(...shapePoints.map(p => p.y));
            const shape = new THREE.Shape();
            shape.moveTo(minX, minY);
            shape.lineTo(maxX, minY);
            shape.lineTo(maxX, maxY);
            shape.lineTo(minX, maxY);
            shape.closePath();
            mesh = new THREE.Mesh(
              new THREE.ShapeGeometry(shape),
              new THREE.MeshStandardMaterial({ color: 0x4a90e2, side: THREE.DoubleSide })
            );
            mesh.rotation.x = -Math.PI / 2;
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
            shapeKind,
            shapePoints,
            circleRadius,
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
    undo: () => {
      setState(prev => {
        if (prev.historyIndex <= 0) return prev;
        const idx = prev.historyIndex - 1;
        const item = prev.history[idx];
        prev.objects.forEach(o => o.mesh.removeFromParent());
        item.objects.forEach(o => sceneRef.current?.add(o.mesh));
        return { ...prev, objects: item.objects, selectedId: item.selectedId, historyIndex: idx };
      });
    },
    redo: () => {
      setState(prev => {
        if (prev.historyIndex >= prev.history.length - 1) return prev;
        const idx = prev.historyIndex + 1;
        const item = prev.history[idx];
        prev.objects.forEach(o => o.mesh.removeFromParent());
        item.objects.forEach(o => sceneRef.current?.add(o.mesh));
        return { ...prev, objects: item.objects, selectedId: item.selectedId, historyIndex: idx };
      });
    },
    setActiveTool: (t: ToolType) =>
      setState(prev => ({ ...prev, activeTool: t, isDrawing: false, drawingStartPoint: null })),
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
    setCameraLock,
  };
}