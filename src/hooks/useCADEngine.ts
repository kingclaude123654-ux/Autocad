// src/hooks/useCADEngine.ts
import { useState, useCallback, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

export type ViewMode = 'top' | 'front' | 'side' | 'isometric';
export type ToolType = 'line' | 'polyline' | 'rectangle' | 'circle' | 'move' | 'select' | 'extrude' | 'fillet' | 'rotate' | 'scale' | 'erase';

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
  label: CSS2DObject | null;
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
  drawingCurrentPoint: THREE.Vector3 | null;
  previewMesh: THREE.Object3D | null;
  dimensionLabel: CSS2DObject | null;
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
  drawingCurrentPoint: null,
  previewMesh: null,
  dimensionLabel: null,
};

export function useCADEngine() {
  const [state, setState] = useState<CADEngineState>(initialState);

  const sceneRef = useRef<THREE.Scene>(new THREE.Scene());
  const cameraRef = useRef<THREE.PerspectiveCamera | THREE.OrthographicCamera>(new THREE.PerspectiveCamera(60, 1, 0.1, 1000));
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const labelRendererRef = useRef<CSS2DRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const gridHelperRef = useRef<THREE.GridHelper | null>(null);
  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster());
  const animFrameRef = useRef<number>(0);
  const drawingPlaneRef = useRef<THREE.Plane>(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));

  const initScene = useCallback((container: HTMLDivElement): void => {
    const scene = sceneRef.current;
    scene.background = new THREE.Color(0x1a1a2e);

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

    const labelRenderer = new CSS2DRenderer();
    labelRenderer.setSize(w, h);
    labelRenderer.domElement.style.position = 'absolute';
    labelRenderer.domElement.style.top = '0';
    labelRenderer.domElement.style.pointerEvents = 'none';
    container.appendChild(labelRenderer.domElement);
    labelRendererRef.current = labelRenderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.target.set(0, 0, 0);
    controlsRef.current = controls;

    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const dl = new THREE.DirectionalLight(0xffffff, 0.8);
    dl.position.set(5, 10, 5);
    scene.add(dl);

    const grid = new THREE.GridHelper(20, 20, 0x444444, 0x333333);
    scene.add(grid);
    gridHelperRef.current = grid;

    scene.add(new THREE.AxesHelper(5));

    let last = 0;
    const loop = (t: number): void => {
      animFrameRef.current = requestAnimationFrame(loop);
      if (t - last < 32) return;
      last = t;
      controlsRef.current?.update();
      if (rendererRef.current) rendererRef.current.render(scene, cameraRef.current);
      if (labelRendererRef.current) labelRendererRef.current.render(scene, cameraRef.current);
    };
    loop(0);
  }, []);

  const disposeMaterial = useCallback((m: THREE.Material): void => {
    if (m instanceof THREE.MeshStandardMaterial) {
      m.map?.dispose();
      m.normalMap?.dispose();
      m.roughnessMap?.dispose();
      m.metalnessMap?.dispose();
      m.aoMap?.dispose();
      m.emissiveMap?.dispose();
      m.bumpMap?.dispose();
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
      if (prev.previewMesh) {
        disposeObject(prev.previewMesh);
      }
      if (prev.dimensionLabel) {
        prev.dimensionLabel.removeFromParent();
        prev.dimensionLabel.element.remove();
      }
      return { ...prev, previewMesh: null, dimensionLabel: null };
    });
  }, [disposeObject]);

  const makeLabel = useCallback((text: string, pos: THREE.Vector3): CSS2DObject => {
    const d = document.createElement('div');
    d.textContent = text;
    d.style.cssText = 'background:rgba(0,0,0,0.85);color:#0f0;padding:3px 6px;border-radius:4px;font-size:11px;font-family:monospace;white-space:nowrap;';
    const lbl = new CSS2DObject(d);
    lbl.position.copy(pos);
    return lbl;
  }, []);

  const saveHistory = useCallback((objs: CADObject[], sel: string | null): void => {
    setState((prev: CADEngineState): CADEngineState => {
      const h = prev.history.slice(0, prev.historyIndex + 1);
      h.push({ objects: objs.map((o: CADObject): CADObject => ({ ...o, position: o.position.clone(), rotation: o.rotation.clone(), scale: o.scale.clone() })), selectedId: sel, timestamp: Date.now() });
      if (h.length > 50) h.shift();
      return { ...prev, history: h, historyIndex: h.length - 1 };
    });
  }, []);

  const undo = useCallback((): void => {
    setState((prev: CADEngineState): CADEngineState => {
      if (prev.historyIndex <= 0) return prev;
      const idx = prev.historyIndex - 1;
      const item = prev.history[idx];
      prev.objects.forEach((o: CADObject) => { o.mesh.removeFromParent(); o.label?.removeFromParent(); });
      item.objects.forEach((o: CADObject) => { sceneRef.current.add(o.mesh); if (o.label) sceneRef.current.add(o.label); });
      return { ...prev, objects: item.objects, selectedId: item.selectedId, historyIndex: idx };
    });
  }, []);

  const redo = useCallback((): void => {
    setState((prev: CADEngineState): CADEngineState => {
      if (prev.historyIndex >= prev.history.length - 1) return prev;
      const idx = prev.historyIndex + 1;
      const item = prev.history[idx];
      prev.objects.forEach((o: CADObject) => { o.mesh.removeFromParent(); o.label?.removeFromParent(); });
      item.objects.forEach((o: CADObject) => { sceneRef.current.add(o.mesh); if (o.label) sceneRef.current.add(o.label); });
      return { ...prev, objects: item.objects, selectedId: item.selectedId, historyIndex: idx };
    });
  }, []);

  const genId = useCallback((): string => 'o_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9), []);

  const addObject = useCallback((mesh: THREE.Mesh | THREE.Line, type: ToolType, labelText?: string): string => {
    const id = genId();
    const pos = mesh.position.clone();
    const lbl = labelText ? makeLabel(labelText, pos.clone().add(new THREE.Vector3(0, 0.3, 0))) : null;
    const obj: CADObject = {
      id, mesh, type,
      geometry: mesh.geometry,
      material: mesh.material,
      position: pos,
      rotation: mesh.rotation.clone(),
      scale: mesh.scale.clone(),
      createdAt: Date.now(),
      label: lbl,
    };
    sceneRef.current.add(mesh);
    if (lbl) sceneRef.current.add(lbl);
    setState((prev: CADEngineState): CADEngineState => {
      const objs = [...prev.objects, obj];
      saveHistory(objs, prev.selectedId);
      return { ...prev, objects: objs };
    });
    return id;
  }, [genId, makeLabel, saveHistory]);

  const selectObject = useCallback((id: string | null): void => {
    setState((prev: CADEngineState): CADEngineState => {
      const prevObj = prev.selectedId ? prev.objects.find((o: CADObject): boolean => o.id === prev.selectedId) : null;
      if (prevObj?.mesh instanceof THREE.Mesh) {
        const m = prevObj.mesh.material;
        if (m instanceof THREE.MeshStandardMaterial) { m.emissive.set(0); m.emissiveIntensity = 0; }
      }
      if (prevObj?.mesh instanceof THREE.Line) {
        const m = prevObj.mesh.material;
        if (m instanceof THREE.LineBasicMaterial) m.color.set(0x00ff00);
      }
      const newObj = id ? prev.objects.find((o: CADObject): boolean => o.id === id) : null;
      if (newObj?.mesh instanceof THREE.Mesh) {
        const m = newObj.mesh.material;
        if (m instanceof THREE.MeshStandardMaterial) { m.emissive.set(0x444444); m.emissiveIntensity = 0.5; }
      }
      if (newObj?.mesh instanceof THREE.Line) {
        const m = newObj.mesh.material;
        if (m instanceof THREE.LineBasicMaterial) m.color.set(0xffff00);
      }
      return { ...prev, selectedId: id };
    });
  }, []);

  const syncCameraMatrix = useCallback((vm: ViewMode): void => {
    const cam = cameraRef.current;
    const ctrl = controlsRef.current;
    if (!cam || !ctrl) return;
    let pos: THREE.Vector3;
    switch (vm) {
      case 'top': pos = new THREE.Vector3(0, 10, 0.001); break;
      case 'front': pos = new THREE.Vector3(0, 0, 10); break;
      case 'side': pos = new THREE.Vector3(10, 0, 0); break;
      default: pos = new THREE.Vector3(7, 7, 7); break;
    }
    cam.position.copy(pos);
    ctrl.target.set(0, 0, 0);
    ctrl.update();
    drawingPlaneRef.current = vm === 'top' ? new THREE.Plane(new THREE.Vector3(0, 1, 0), 0) :
      vm === 'front' ? new THREE.Plane(new THREE.Vector3(0, 0, 1), 0) :
      vm === 'side' ? new THREE.Plane(new THREE.Vector3(1, 0, 0), 0) :
      new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    setState((prev: CADEngineState): CADEngineState => ({ ...prev, viewMode: vm }));
  }, []);

  const toggleOrtho = useCallback((): void => {
    const container = rendererRef.current?.domElement.parentElement;
    if (!container || !cameraRef.current) return;
    const w = container.clientWidth, h = container.clientHeight;
    setState((prev: CADEngineState): CADEngineState => {
      const ortho = !prev.orthoMode;
      const p = cameraRef.current.position.clone();
      const r = cameraRef.current.rotation.clone();
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

  const getPoint = useCallback((x: number, y: number): THREE.Vector3 | null => {
    if (!rendererRef.current) return null;
    const rect = rendererRef.current.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2(((x - rect.left) / rect.width) * 2 - 1, -((y - rect.top) / rect.height) * 2 + 1);
    raycasterRef.current.setFromCamera(mouse, cameraRef.current);
    const pt = new THREE.Vector3();
    return raycasterRef.current.ray.intersectPlane(drawingPlaneRef.current, pt) ? pt : null;
  }, []);

  const snap = useCallback((pt: THREE.Vector3): THREE.Vector3 => {
    return new THREE.Vector3(Math.round(pt.x * 2) / 2, Math.round(pt.y * 2) / 2, Math.round(pt.z * 2) / 2);
  }, []);

  const pickObject = useCallback((x: number, y: number): string | null => {
    if (!rendererRef.current) return null;
    const rect = rendererRef.current.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2(((x - rect.left) / rect.width) * 2 - 1, -((y - rect.top) / rect.height) * 2 + 1);
    raycasterRef.current.setFromCamera(mouse, cameraRef.current);
    const targets: THREE.Object3D[] = [];
    state.objects.forEach((o: CADObject) => {
      if (o.mesh instanceof THREE.Mesh || o.mesh instanceof THREE.Line) targets.push(o.mesh);
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
    const t = e.touches[0];
    if (state.activeTool === 'select' || state.activeTool === 'move') {
      selectObject(pickObject(t.clientX, t.clientY));
      return;
    }
    const pt = getPoint(t.clientX, t.clientY);
    if (!pt) return;
    const sp = state.snapEnabled ? snap(pt) : pt;
    setState((prev: CADEngineState): CADEngineState => ({
      ...prev, isDrawing: true, drawingStartPoint: sp, drawingCurrentPoint: sp,
    }));
  }, [state.activeTool, state.snapEnabled, pickObject, selectObject, getPoint, snap]);

  const handleTouchMove = useCallback((e: TouchEvent): void => {
    e.preventDefault();
    if (!state.isDrawing || !state.drawingStartPoint) return;
    const t = e.touches[0];
    const pt = getPoint(t.clientX, t.clientY);
    if (!pt) return;
    const cp = state.snapEnabled ? snap(pt) : pt;
    clearPreview();
    const sp = state.drawingStartPoint;
    let mesh: THREE.Object3D | null = null;
    let txt = '';
    let lpos = new THREE.Vector3();
    switch (state.activeTool) {
      case 'line': {
        const g = new THREE.BufferGeometry().setFromPoints([sp, cp]);
        mesh = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xffff00 }));
        const len = sp.distanceTo(cp);
        txt = len.toFixed(2);
        lpos = sp.clone().add(cp).multiplyScalar(0.5);
        break;
      }
      case 'rectangle': {
        const dx = cp.x - sp.x, dz = cp.z - sp.z;
        const s = new THREE.Shape();
        s.moveTo(0, 0); s.lineTo(dx, 0); s.lineTo(dx, dz); s.lineTo(0, dz); s.closePath();
        const g = new THREE.ShapeGeometry(s);
        mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0xffff00, side: THREE.DoubleSide, transparent: true, opacity: 0.5 }));
        mesh.position.copy(sp);
        mesh.rotation.x = -Math.PI / 2;
        txt = Math.abs(dx).toFixed(2) + ' x ' + Math.abs(dz).toFixed(2);
        lpos.set(sp.x + dx / 2, sp.y + 0.2, sp.z + dz / 2);
        break;
      }
      case 'circle': {
        const r = sp.distanceTo(cp);
        const g = new THREE.CircleGeometry(r, 48);
        mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0xffff00, side: THREE.DoubleSide, transparent: true, opacity: 0.5 }));
        mesh.position.copy(sp);
        mesh.rotation.x = -Math.PI / 2;
        txt = 'R' + r.toFixed(2);
        lpos.set(sp.x, sp.y + 0.2, sp.z);
        break;
      }
      case 'polyline': {
        const pts = [sp, cp];
        const g = new THREE.BufferGeometry().setFromPoints(pts);
        mesh = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xffff00 }));
        txt = sp.distanceTo(cp).toFixed(2);
        lpos = cp.clone().add(new THREE.Vector3(0.2, 0.2, 0));
        break;
      }
    }
    let lbl: CSS2DObject | null = null;
    if (txt) lbl = makeLabel(txt, lpos);
    if (mesh) sceneRef.current.add(mesh);
    if (lbl) sceneRef.current.add(lbl);
    setState((prev: CADEngineState): CADEngineState => ({
      ...prev, drawingCurrentPoint: cp, previewMesh: mesh, dimensionLabel: lbl,
    }));
  }, [state.isDrawing, state.drawingStartPoint, state.activeTool, state.snapEnabled, getPoint, snap, clearPreview, makeLabel]);

  const handleTouchEnd = useCallback((e: TouchEvent): void => {
    e.preventDefault();
    if (!state.isDrawing || !state.drawingStartPoint || !state.drawingCurrentPoint) return;
    const sp = state.drawingStartPoint;
    const cp = state.drawingCurrentPoint;
    clearPreview();
    switch (state.activeTool) {
      case 'line': {
        const g = new THREE.BufferGeometry().setFromPoints([sp, cp]);
        const m = new THREE.LineBasicMaterial({ color: 0x00ff00 });
        addObject(new THREE.Line(g, m), 'line', sp.distanceTo(cp).toFixed(2));
        break;
      }
      case 'rectangle': {
        const dx = cp.x - sp.x, dz = cp.z - sp.z;
        const s = new THREE.Shape();
        s.moveTo(0, 0); s.lineTo(dx, 0); s.lineTo(dx, dz); s.lineTo(0, dz); s.closePath();
        const g = new THREE.ShapeGeometry(s);
        const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0x4a90e2, side: THREE.DoubleSide }));
        mesh.position.copy(sp);
        mesh.rotation.x = -Math.PI / 2;
        addObject(mesh, 'rectangle', Math.abs(dx).toFixed(2) + 'x' + Math.abs(dz).toFixed(2));
        break;
      }
      case 'circle': {
        const r = sp.distanceTo(cp);
        const g = new THREE.CircleGeometry(r, 48);
        const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0xe24a4a, side: THREE.DoubleSide }));
        mesh.position.copy(sp);
        mesh.rotation.x = -Math.PI / 2;
        addObject(mesh, 'circle', 'R' + r.toFixed(2));
        break;
      }
      case 'polyline': {
        const g = new THREE.BufferGeometry().setFromPoints([sp, cp]);
        addObject(new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0x00ff00 })), 'polyline', sp.distanceTo(cp).toFixed(2));
        break;
      }
    }
    setState((prev: CADEngineState): CADEngineState => ({
      ...prev, isDrawing: false, drawingStartPoint: null, drawingCurrentPoint: null,
    }));
  }, [state.isDrawing, state.drawingStartPoint, state.drawingCurrentPoint, state.activeTool, clearPreview, addObject]);

  const executeErase = useCallback((id: string): void => {
    setState((prev: CADEngineState): CADEngineState => {
      const obj = prev.objects.find((o: CADObject): boolean => o.id === id);
      if (!obj) return prev;
      disposeObject(obj.mesh);
      obj.label?.removeFromParent();
      obj.label?.element.remove();
      const objs = prev.objects.filter((o: CADObject): boolean => o.id !== id);
      const sel = prev.selectedId === id ? null : prev.selectedId;
      saveHistory(objs, sel);
      return { ...prev, objects: objs, selectedId: sel };
    });
  }, [disposeObject, saveHistory]);

  const executeExtrude = useCallback((id: string, dist: number): void => {
    setState((prev: CADEngineState): CADEngineState => {
      const obj = prev.objects.find((o: CADObject): boolean => o.id === id);
      if (!obj || !(obj.mesh instanceof THREE.Mesh)) return prev;
      const extSettings: THREE.ExtrudeGeometryOptions = { steps: 1, depth: dist, bevelEnabled: false };
      const shape = new THREE.Shape();
      const attr = obj.mesh.geometry.getAttribute('position');
      if (attr.count > 2) {
        const pts: THREE.Vector2[] = [];
        for (let i = 0; i < attr.count; i++) pts.push(new THREE.Vector2(attr.getX(i), attr.getY(i)));
        shape.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i].x, pts[i].y);
        shape.closePath();
      }
      obj.mesh.geometry.dispose();
      obj.mesh.geometry = new THREE.ExtrudeGeometry(shape, extSettings);
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

  const executeFillet = useCallback((id: string, radius: number): void => {
    setState((prev: CADEngineState): CADEngineState => {
      const obj = prev.objects.find((o: CADObject): boolean => o.id === id);
      if (!obj || !(obj.mesh instanceof THREE.Mesh)) return prev;
      const shape = new THREE.Shape();
      const w = 2, h = 2, r = Math.min(radius, w / 2, h / 2);
      shape.moveTo(-w / 2 + r, -h / 2); shape.lineTo(w / 2 - r, -h / 2);
      shape.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r); shape.lineTo(w / 2, h / 2 - r);
      shape.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2); shape.lineTo(-w / 2 + r, h / 2);
      shape.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r); shape.lineTo(-w / 2, -h / 2 + r);
      shape.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
      obj.mesh.geometry.dispose();
      obj.mesh.geometry = new THREE.ShapeGeometry(shape);
      saveHistory(prev.objects, prev.selectedId);
      return { ...prev };
    });
  }, [saveHistory]);

  const handleResize = useCallback((): void => {
    const c = rendererRef.current?.domElement.parentElement;
    if (!c || !rendererRef.current) return;
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
    labelRendererRef.current?.setSize(w, h);
  }, []);

  const exportScene = useCallback((): string => {
    return JSON.stringify({
      objects: state.objects.map((o: CADObject) => ({ id: o.id, type: o.type, position: o.position.toArray(), rotation: [o.rotation.x, o.rotation.y, o.rotation.z], scale: o.scale.toArray(), createdAt: o.createdAt })),
      viewMode: state.viewMode, orthoMode: state.orthoMode,
    });
  }, [state.objects, state.viewMode, state.orthoMode]);

  const importScene = useCallback((json: string): void => {
    try {
      const d = JSON.parse(json);
      state.objects.forEach((o: CADObject) => { disposeObject(o.mesh); o.label?.removeFromParent(); o.label?.element.remove(); });
      const newObjs: CADObject[] = [];
      if (Array.isArray(d.objects)) {
        d.objects.forEach((od: any) => {
          const pos = new THREE.Vector3(od.position[0], od.position[1], od.position[2]);
          const rot = new THREE.Euler(od.rotation[0], od.rotation[1], od.rotation[2]);
          const scl = new THREE.Vector3(od.scale[0], od.scale[1], od.scale[2]);
          let mesh: THREE.Mesh | THREE.Line;
          if (od.type === 'line' || od.type === 'polyline') {
            mesh = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0x00ff00 }));
          } else if (od.type === 'circle') {
            mesh = new THREE.Mesh(new THREE.CircleGeometry(1, 48), new THREE.MeshStandardMaterial({ color: 0xe24a4a, side: THREE.DoubleSide }));
          } else {
            mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshStandardMaterial({ color: 0x4a90e2, side: THREE.DoubleSide }));
          }
          mesh.position.copy(pos); mesh.rotation.copy(rot); mesh.scale.copy(scl);
          sceneRef.current.add(mesh);
          newObjs.push({ id: od.id || genId(), mesh, type: od.type as ToolType, geometry: mesh.geometry, material: mesh.material, position: pos, rotation: rot, scale: scl, createdAt: od.createdAt || Date.now(), label: null });
        });
      }
      setState((prev: CADEngineState): CADEngineState => ({ ...prev, objects: newObjs, selectedId: null }));
      if (d.viewMode) syncCameraMatrix(d.viewMode);
      if (d.orthoMode && d.orthoMode !== state.orthoMode) toggleOrtho();
    } catch (e) { console.error('Import failed:', e); }
  }, [state.objects, state.orthoMode, disposeObject, genId, syncCameraMatrix, toggleOrtho]);

  useEffect(() => { return () => { cancelAnimationFrame(animFrameRef.current); rendererRef.current?.dispose(); rendererRef.current?.domElement.remove(); labelRendererRef.current?.domElement.remove(); }; }, []);

  return { state, initScene, undo, redo, setActiveTool: (t: ToolType) => setState((prev: CADEngineState): CADEngineState => ({ ...prev, activeTool: t, isDrawing: false })), selectObject, syncCameraMatrix, toggleOrthoMode: toggleOrtho, setSnapEnabled: (e: boolean) => setState((prev: CADEngineState): CADEngineState => ({ ...prev, snapEnabled: e })), setGridVisible: (v: boolean) => { if (gridHelperRef.current) gridHelperRef.current.visible = v; setState((prev: CADEngineState): CADEngineState => ({ ...prev, gridVisible: v })); }, executeExtrude, executeFillet, executeRotate, executeScale, executeErase, handleTouchStart, handleTouchMove, handleTouchEnd, handleResize, exportScene, importScene, addObject };
}