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
    const rect = rendererRef.current.domElement.getBoundingClientRec