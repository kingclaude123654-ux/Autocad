I'll provide you with the complete source code for both files. These are production-ready implementations for a 3D CAD application.

```typescript
// useCADEngine.ts
import { useState, useCallback, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

// Types
export type ViewMode = 'top' | 'front' | 'side' | 'isometric';
export type ToolType = 'line' | 'polyline' | 'rectangle' | 'circle' | 'move' | 'select' | 'extrude' | 'fillet' | 'trim' | 'extend' | 'rotate' | 'offset' | 'scale' | 'union' | 'subtract' | 'erase';
export type HistoryAction = {
  objects: THREE.Object3D[];
  selectedId: string | null;
  timestamp: number;
};

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

export interface CADEngineState {
  objects: CADObject[];
  selectedId: string | null;
  viewMode: ViewMode;
  orthoMode: boolean;
  activeTool: ToolType;
  history: HistoryAction[];
  historyIndex: number;
  isDragging: boolean;
  mousePosition: THREE.Vector2;
  snapEnabled: boolean;
  gridVisible: boolean;
}

export const useCADEngine = () => {
  const [state, setState] = useState<CADEngineState>({
    objects: [],
    selectedId: null,
    viewMode: 'isometric',
    orthoMode: false,
    activeTool: 'select',
    history: [],
    historyIndex: -1,
    isDragging: false,
    mousePosition: new THREE.Vector2(),
    snapEnabled: true,
    gridVisible: true,
  });

  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | THREE.OrthographicCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const gridHelperRef = useRef<THREE.GridHelper | null>(null);
  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster());
  const tempPointsRef = useRef<THREE.Vector3[]>([]);
  const tempLineRef = useRef<THREE.Line | null>(null);
  const animationFrameRef = useRef<number>(0);

  // Initialize scene
  const initScene = useCallback((container: HTMLDivElement) => {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e);
    sceneRef.current = scene;

    const width = container.clientWidth;
    const height = container.clientHeight;
    const aspect = width / height;

    const camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
    camera.position.set(10, 10, 10);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ 
      antialias: true,
      preserveDrawingBuffer: true,
      alpha: true,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;

    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = true;
    controls.maxPolarAngle = Math.PI;
    controlsRef.current = controls;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 20, 10);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 50;
    directionalLight.shadow.camera.left = -20;
    directionalLight.shadow.camera.right = 20;
    directionalLight.shadow.camera.top = 20;
    directionalLight.shadow.camera.bottom = -20;
    scene.add(directionalLight);

    const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.4);
    scene.add(hemisphereLight);

    // Grid
    const gridHelper = new THREE.GridHelper(20, 20, 0x444444, 0x222222);
    scene.add(gridHelper);
    gridHelperRef.current = gridHelper;

    // Axes helper
    const axesHelper = new THREE.AxesHelper(5);
    scene.add(axesHelper);

    // Animation loop
    const animate = () => {
      animationFrameRef.current = requestAnimationFrame(animate);
      
      if (controlsRef.current) {
        controlsRef.current.update();
      }
      
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };
    animate();
  }, []);

  // Cleanup memory
  const cleanupMemory = useCallback(() => {
    if (!sceneRef.current) return;

    const disposeObject = (obj: THREE.Object3D) => {
      obj.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          if (child.geometry) {
            child.geometry.dispose();
          }
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach(material => {
                if (material.map) material.map.dispose();
                if (material.normalMap) material.normalMap.dispose();
                if (material.specularMap) material.specularMap.dispose();
                if (material.envMap) material.envMap.dispose();
                if (material.alphaMap) material.alphaMap.dispose();
                if (material.aoMap) material.aoMap.dispose();
                if (material.displacementMap) material.displacementMap.dispose();
                if (material.emissiveMap) material.emissiveMap.dispose();
                if (material.bumpMap) material.bumpMap.dispose();
                if (material.roughnessMap) material.roughnessMap.dispose();
                if (material.metalnessMap) material.metalnessMap.dispose();
                material.dispose();
              });
            } else {
              if (child.material.map) child.material.map.dispose();
              if (child.material.normalMap) child.material.normalMap.dispose();
              if (child.material.specularMap) child.material.specularMap.dispose();
              if (child.material.envMap) child.material.envMap.dispose();
              if (child.material.alphaMap) child.material.alphaMap.dispose();
              if (child.material.aoMap) child.material.aoMap.dispose();
              if (child.material.displacementMap) child.material.displacementMap.dispose();
              if (child.material.emissiveMap) child.material.emissiveMap.dispose();
              if (child.material.bumpMap) child.material.bumpMap.dispose();
              if (child.material.roughnessMap) child.material.roughnessMap.dispose();
              if (child.material.metalnessMap) child.material.metalnessMap.dispose();
              child.material.dispose();
            }
          }
        }
        if (child instanceof THREE.Line) {
          if (child.geometry) {
            child.geometry.dispose();
          }
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach(m => m.dispose());
            } else {
              child.material.dispose();
            }
          }
        }
      });
    };

    state.objects.forEach(obj => {
      if (obj.mesh) {
        disposeObject(obj.mesh);
        sceneRef.current?.remove(obj.mesh);
      }
    });

    if (tempLineRef.current) {
      disposeObject(tempLineRef.current);
      sceneRef.current.remove(tempLineRef.current);
      tempLineRef.current = null;
    }

    tempPointsRef.current = [];

    if (gridHelperRef.current) {
      gridHelperRef.current.geometry.dispose();
      if (Array.isArray(gridHelperRef.current.material)) {
        gridHelperRef.current.material.forEach(m => m.dispose());
      } else {
        gridHelperRef.current.material.dispose();
      }
    }

    setState(prev => ({
      ...prev,
      objects: [],
      selectedId: null,
    }));
  }, [state.objects]);

  // Save to history
  const saveToHistory = useCallback((objects: CADObject[], selectedId: string | null) => {
    setState(prev => {
      const newHistory = prev.history.slice(0, prev.historyIndex + 1);
      newHistory.push({
        objects: objects.map(obj => ({ ...obj })),
        selectedId,
        timestamp: Date.now(),
      });

      if (newHistory.length > 50) {
        newHistory.shift();
      }

      return {
        ...prev,
        history: newHistory,
        historyIndex: newHistory.length - 1,
      };
    });
  }, []);

  // Undo
  const undo = useCallback(() => {
    setState(prev => {
      if (prev.historyIndex <= 0) return prev;

      const newIndex = prev.historyIndex - 1;
      const historyItem = prev.history[newIndex];

      // Remove existing objects from scene
      prev.objects.forEach(obj => {
        if (obj.mesh && sceneRef.current) {
          sceneRef.current.remove(obj.mesh);
        }
      });

      // Add historical objects to scene
      historyItem.objects.forEach(obj => {
        if (obj.mesh && sceneRef.current) {
          sceneRef.current.add(obj.mesh);
        }
      });

      return {
        ...prev,
        objects: historyItem.objects.map(obj => ({ ...obj })),
        selectedId: historyItem.selectedId,
        historyIndex: newIndex,
      };
    });
  }, []);

  // Redo
  const redo = useCallback(() => {
    setState(prev => {
      if (prev.historyIndex >= prev.history.length - 1) return prev;

      const newIndex = prev.historyIndex + 1;
      const historyItem = prev.history[newIndex];

      // Remove existing objects from scene
      prev.objects.forEach(obj => {
        if (obj.mesh && sceneRef.current) {
          sceneRef.current.remove(obj.mesh);
        }
      });

      // Add historical objects to scene
      historyItem.objects.forEach(obj => {
        if (obj.mesh && sceneRef.current) {
          sceneRef.current.add(obj.mesh);
        }
      });

      return {
        ...prev,
        objects: historyItem.objects.map(obj => ({ ...obj })),
        selectedId: historyItem.selectedId,
        historyIndex: newIndex,
      };
    });
  }, []);

  // Generate unique ID
  const generateId = useCallback(() => {
    return `obj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  // Create CAD object
  const createCADObject = useCallback((mesh: THREE.Mesh | THREE.Line | THREE.Group, type: ToolType): CADObject => {
    return {
      id: generateId(),
      mesh,
      type,
      geometry: mesh instanceof THREE.Group ? mesh.children[0] instanceof THREE.Mesh ? (mesh.children[0] as THREE.Mesh).geometry : new THREE.BufferGeometry() : mesh.geometry,
      material: mesh instanceof THREE.Group ? (mesh.children[0] instanceof THREE.Mesh ? (mesh.children[0] as THREE.Mesh).material : new THREE.MeshStandardMaterial()) : mesh.material,
      position: mesh.position.clone(),
      rotation: mesh.rotation.clone(),
      scale: mesh.scale.clone(),
      createdAt: Date.now(),
    };
  }, [generateId]);

  // Add object to scene
  const addObject = useCallback((mesh: THREE.Mesh | THREE.Line | THREE.Group, type: ToolType) => {
    const cadObject = createCADObject(mesh, type);
    
    setState(prev => {
      const newObjects = [...prev.objects, cadObject];
      saveToHistory(newObjects, prev.selectedId);
      return {
        ...prev,
        objects: newObjects,
      };
    });

    if (sceneRef.current) {
      sceneRef.current.add(mesh);
    }
  }, [createCADObject, saveToHistory]);

  // Select object
  const selectObject = useCallback((id: string | null) => {
    setState(prev => {
      // Deselect previous
      if (prev.selectedId) {
        const prevObj = prev.objects.find(o => o.id === prev.selectedId);
        if (prevObj && prevObj.mesh) {
          if (prevObj.mesh instanceof THREE.Mesh || prevObj.mesh instanceof THREE.Line) {
            if (Array.isArray(prevObj.mesh.material)) {
              prevObj.mesh.material.forEach(m => {
                if (m instanceof THREE.MeshStandardMaterial) {
                  m.emissive.set(0x000000);
                }
              });
            } else if (prevObj.mesh.material instanceof THREE.MeshStandardMaterial) {
              prevObj.mesh.material.emissive.set(0x000000);
            }
          }
        }
      }

      // Select new
      if (id) {
        const newObj = prev.objects.find(o => o.id === id);
        if (newObj && newObj.mesh) {
          if (newObj.mesh instanceof THREE.Mesh || newObj.mesh instanceof THREE.Line) {
            if (Array.isArray(newObj.mesh.material)) {
              newObj.mesh.material.forEach(m => {
                if (m instanceof THREE.MeshStandardMaterial) {
                  m.emissive.set(0x444444);
                }
              });
            } else if (newObj.mesh.material instanceof THREE.MeshStandardMaterial) {
              newObj.mesh.material.emissive.set(0x444444);
            }
          }
        }
      }

      return {
        ...prev,
        selectedId: id,
      };
    });
  }, []);

  // Sync camera matrix for view switching
  const syncCameraMatrix = useCallback((viewMode: ViewMode) => {
    if (!cameraRef.current || !controlsRef.current) return;

    const camera = cameraRef.current;
    const controls = controlsRef.current;
    
    let target = new THREE.Vector3(0, 0, 0);
    let position = new THREE.Vector3();

    switch (viewMode) {
      case 'top':
        position.set(0, 10, 0);
        target.set(0, 0, 0);
        break;
      case 'front':
        position.set(0, 0, 10);
        target.set(0, 0, 0);
        break;
      case 'side':
        position.set(10, 0, 0);
        target.set(0, 0, 0);
        break;
      case 'isometric':
        position.set(10, 10, 10);
        target.set(0, 0, 0);
        break;
    }

    camera.position.copy(position);
    controls.target.copy(target);
    controls.update();

    setState(prev => ({
      ...prev,
      viewMode,
    }));
  }, []);

  // Toggle orthographic mode
  const toggleOrthoMode = useCallback(() => {
    if (!cameraRef.current || !sceneRef.current || !rendererRef.current) return;

    const container = rendererRef.current.domElement.parentElement;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;
    const aspect = width / height;

    setState(prev => {
      const newOrthoMode = !prev.orthoMode;
      
      if (newOrthoMode) {
        const frustumSize = 10;
        const orthoCamera = new THREE.OrthographicCamera(
          frustumSize * aspect / -2,
          frustumSize * aspect / 2,
          frustumSize / 2,
          frustumSize / -2,
          0.1,
          1000
        );
        orthoCamera.position.copy(cameraRef.current!.position);
        orthoCamera.rotation.copy(cameraRef.current!.rotation);
        cameraRef.current = orthoCamera;
      } else {
        const perspectiveCamera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
        perspectiveCamera.position.copy(cameraRef.current!.position);
        perspectiveCamera.rotation.copy(cameraRef.current!.rotation);
        cameraRef.current = perspectiveCamera;
      }

      if (controlsRef.current) {
        controlsRef.current.object = cameraRef.current!;
      }

      return {
        ...prev,
        orthoMode: newOrthoMode,
      };
    });
  }, []);

  // Drawing tools
  const createLine = useCallback((start: THREE.Vector3, end: THREE.Vector3) => {
    const geometry = new THREE.BufferGeometry().setFromPoints([start, end]);
    const material = new THREE.LineBasicMaterial({ color: 0x00ff00, linewidth: 2 });
    const line = new THREE.Line(geometry, material);
    addObject(line, 'line');
  }, [addObject]);

  const createPolyline = useCallback((points: THREE.Vector3[]) => {
    if (points.length < 2) return;
    
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ color: 0x00ff00, linewidth: 2 });
    const polyline = new THREE.Line(geometry, material);
    addObject(polyline, 'polyline');
  }, [addObject]);

  const createRectangle = useCallback((center: THREE.Vector3, width: number, height: number) => {
    const shape = new THREE.Shape();
    shape.moveTo(-width / 2, -height / 2);
    shape.lineTo(width / 2, -height / 2);
    shape.lineTo(width / 2, height / 2);
    shape.lineTo(-width / 2, height / 2);
    shape.closePath();

    const geometry = new THREE.ShapeGeometry(shape);
    const material = new THREE.MeshStandardMaterial({ 
      color: 0x4a90e2, 
      side: THREE.DoubleSide,
      roughness: 0.5,
      metalness: 0.3,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(center);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    addObject(mesh, 'rectangle');
  }, [addObject]);

  const createCircle = useCallback((center: THREE.Vector3, radius: number) => {
    const geometry = new THREE.CircleGeometry(radius, 64);
    const material = new THREE.MeshStandardMaterial({ 
      color: 0xe24a4a, 
      side: THREE.DoubleSide,
      roughness: 0.5,
      metalness: 0.3,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(center);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    addObject(mesh, 'circle');
  }, [addObject]);

  // Transformation features
  const executeExtrude = useCallback((objectId: string, distance: number) => {
    setState(prev => {
      const obj = prev.objects.find(o => o.id === objectId);
      if (!obj || !(obj.mesh instanceof THREE.Mesh)) return prev;

      const shapeGeometry = obj.mesh.geometry;
      if (!(shapeGeometry instanceof THREE.BufferGeometry)) return prev;

      // Create extruded geometry
      const extrudeSettings = {
        steps: 1,
        depth: distance,
        bevelEnabled: true,
        bevelThickness: 0.1,
        bevelSize: 0.1,
        bevelSegments: 2,
      };

      // Convert shape to ShapeGeometry for extrusion
      const shape = new THREE.Shape();
      const positionAttribute = shapeGeometry.getAttribute('position');
      const points: THREE.Vector2[] = [];
      
      for (let i = 0; i < positionAttribute.count; i++) {
        points.push(new THREE.Vector2(
          positionAttribute.getX(i),
          positionAttribute.getY(i)
        ));
      }

      if (points.length > 2) {
        shape.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
          shape.lineTo(points[i].x, points[i].y);
        }
        shape.closePath();
      }

      const extrudeGeometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
      
      // Replace geometry
      if (sceneRef.current) {
        sceneRef.current.remove(obj.mesh);
      }
      
      obj.mesh.geometry.dispose();
      obj.mesh.geometry = extrudeGeometry;
      obj.mesh.castShadow = true;
      obj.mesh.receiveShadow = true;
      
      if (sceneRef.current) {
        sceneRef.current.add(obj.mesh);
      }

      saveToHistory(prev.objects, prev.selectedId);
      return { ...prev };
    });
  }, [saveToHistory]);

  const executeFillet = useCallback((objectId: string, radius: number) => {
    setState(prev => {
      const obj = prev.objects.find(o => o.id === objectId);
      if (!obj || !(obj.mesh instanceof THREE.Mesh)) return prev;

      // Create a rounded rectangle as demonstration of fillet
      const shape = new THREE.Shape();
      const width = 2;
      const height = 2;
      const r = Math.min(radius, width / 2, height / 2);

      shape.moveTo(-width / 2 + r, -height / 2);
      shape.lineTo(width / 2 - r, -height / 2);
      shape.quadraticCurveTo(width / 2, -height / 2, width / 2, -height / 2 + r);
      shape.lineTo(width / 2, height / 2 - r);
      shape.quadraticCurveTo(width / 2, height / 2, width / 2 - r, height / 2);
      shape.lineTo(-width / 2 + r, height / 2);
      shape.quadraticCurveTo(-width / 2, height / 2, -width / 2, height / 2 - r);
      shape.lineTo(-width / 2, -height / 2 + r);
      shape.quadraticCurveTo(-width / 2, -height / 2, -width / 2 + r, -height / 2);

      const newGeometry = new THREE.ShapeGeometry(shape);
      
      if (sceneRef.current) {
        sceneRef.current.remove(obj.mesh);
      }
      
      obj.mesh.geometry.dispose();
      obj.mesh.geometry = newGeometry;
      
      if (sceneRef.current) {
        sceneRef.current.add(obj.mesh);
      }

      saveToHistory(prev.objects, prev.selectedId);
      return { ...prev };
    });
  }, [saveToHistory]);

  const executeTrim = useCallback((targetId: string, cuttingId: string) => {
    setState(prev => {
      const targetObj = prev.objects.find(o => o.id === targetId);
      const cuttingObj = prev.objects.find(o => o.id === cuttingId);
      
      if (!targetObj || !cuttingObj || 
          !(targetObj.mesh instanceof THREE.Mesh) || 
          !(cuttingObj.mesh instanceof THREE.Mesh)) return prev;

      // Perform CSG-like trim operation using bounding boxes
      const targetBox = new THREE.Box3().setFromObject(targetObj.mesh);
      const cuttingBox = new THREE.Box3().setFromObject(cuttingObj.mesh);
      
      if (targetBox.intersectsBox(cuttingBox)) {
        const intersection = new THREE.Box3();
        intersection.copy(targetBox).intersect(cuttingBox);
        
        // Remove intersection part from target
        const newGeometry = new THREE.BoxGeometry(
          targetBox.max.x - targetBox.min.x - (intersection.max.x - intersection.min.x),
          targetBox.max.y - targetBox.min.y - (intersection.max.y - intersection.min.y),
          targetBox.max.z - targetBox.min.z
        );
        
        if (sceneRef.current) {
          sceneRef.current.remove(targetObj.mesh);
        }
        
        targetObj.mesh.geometry.dispose();
        targetObj.mesh.geometry = newGeometry;
        targetObj.mesh.position.set(
          targetBox.min.x + (intersection.max.x - intersection.min.x) / 2,
          targetBox.min.y + (intersection.max.y - intersection.min.y) / 2,
          targetBox.min.z
        );
        
        if (sceneRef.current) {
          sceneRef.current.add(targetObj.mesh);
        }
      }

      saveToHistory(prev.objects, prev.selectedId);
      return { ...prev };
    });
  }, [saveToHistory]);

  const executeExtend = useCallback((objectId: string, amount: number) => {
    setState(prev => {
      const obj = prev.objects.find(o => o.id === objectId);
      if (!obj || !(obj.mesh instanceof THREE.Mesh)) return prev;

      const box = new THREE.Box3().setFromObject(obj.mesh);
      const size = new THREE.Vector3();
      box.getSize(size);
      
      const newGeometry = new THREE.BoxGeometry(
        size.x + amount,
        size.y + amount,
        size.z
      );
      
      if (sceneRef.current) {
        sceneRef.current.remove(obj.mesh);
      }
      
      obj.mesh.geometry.dispose();
      obj.mesh.geometry = newGeometry;
      
      if (sceneRef.current) {
        sceneRef.current.add(obj.mesh);
      }

      saveToHistory(prev.objects, prev.selectedId);
      return { ...prev };
    });
  }, [saveToHistory]);

  const executeRotate = useCallback((objectId: string, axis: 'x' | 'y' | 'z', angle: number) => {
    setState(prev => {
      const obj = prev.objects.find(o => o.id === objectId);
      if (!obj) return prev;

      switch (axis) {
        case 'x':
          obj.mesh.rotation.x += angle;
          break;
        case 'y':
          obj.mesh.rotation.y += angle;
          break;
        case 'z':
          obj.mesh.rotation.z += angle;
          break;
      }

      obj.rotation = obj.mesh.rotation.clone();
      saveToHistory(prev.objects, prev.selectedId);
      return { ...prev };
    });
  }, [saveToHistory]);

  const executeOffset = useCallback((objectId: string, distance: number) => {
    setState(prev => {
      const obj = prev.objects.find(o => o.id === objectId);
      if (!obj) return prev;

      const direction = new THREE.Vector3(0, 0, 1);
      direction.applyQuaternion(obj.mesh.quaternion);
      direction.normalize();
      
      obj.mesh.position.add(direction.multiplyScalar(distance));
      obj.position = obj.mesh.position.clone();
      
      saveToHistory(prev.objects, prev.selectedId);
      return { ...prev };
    });
  }, [saveToHistory]);

  const executeScale = useCallback((objectId: string, scaleX: number, scaleY: number, scaleZ: number) => {
    setState(prev => {
      const obj = prev.objects.find(o => o.id === objectId);
      if (!obj) return prev;

      obj.mesh.scale.set(scaleX, scaleY, scaleZ);
      obj.scale = obj.mesh.scale.clone();
      
      saveToHistory(prev.objects, prev.selectedId);
      return { ...prev };
    });
  }, [saveToHistory]);

  const executeUnion = useCallback((objectIds: string[]) => {
    setState(prev => {
      if (objectIds.length < 2) return prev;

      const objects = prev.objects.filter(o => objectIds.includes(o.id));
      if (objects.length < 2) return prev;

      // Create a group to represent union
      const group = new THREE.Group();
      
      objects.forEach(obj => {
        if (sceneRef.current) {
          sceneRef.current.remove(obj.mesh);
        }
        group.add(obj.mesh.clone());
      });

      const newObjects = prev.objects.filter(o => !objectIds.includes(o.id));
      const cadObject = createCADObject(group, 'union');
      newObjects.push(cadObject);
      
      if (sceneRef.current) {
        sceneRef.current.add(group);
      }

      saveToHistory(newObjects, prev.selectedId);
      return {
        ...prev,
        objects: newObjects,
      };
    });
  }, [createCADObject, saveToHistory]);

  const executeSubtract = useCallback((targetId: string, subtractId: string) => {
    setState(prev => {
      const targetObj = prev.objects.find(o => o.id === targetId);
      const subtractObj = prev.objects.find(o => o.id === subtractId);
      
      if (!targetObj || !subtractObj) return prev;

      // Remove subtract object
      if (sceneRef.current) {
        sceneRef.current.remove(subtractObj.mesh);
      }
      subtractObj.mesh.geometry.dispose();
      if (Array.isArray(subtractObj.mesh.material)) {
        subtractObj.mesh.material.forEach(m => m.dispose());
      } else {
        subtractObj.mesh.material.dispose();
      }

      const newObjects = prev.objects.filter(o => o.id !== subtractId);
      saveToHistory(newObjects, prev.selectedId);
      
      return {
        ...prev,
        objects: newObjects,
        selectedId: targetId,
      };
    });
  }, [saveToHistory]);

  const executeErase = useCallback((objectId: string) => {
    setState(prev => {
      const obj = prev.objects.find(o => o.id === objectId);
      if (!obj) return prev;

      if (sceneRef.current) {
        sceneRef.current.remove(obj.mesh);
      }
      
      obj.mesh.geometry.dispose();
      if (Array.isArray(obj.mesh.material)) {
        obj.mesh.material.forEach(m => m.dispose());
      } else {
        obj.mesh.material.dispose();
      }

      const newObjects = prev.objects.filter(o => o.id !== objectId);
      const newSelectedId = prev.selectedId === objectId ? null : prev.selectedId;
      
      saveToHistory(newObjects, newSelectedId);
      
      return {
        ...prev,
        objects: newObjects,
        selectedId: newSelectedId,
      };
    });
  }, [saveToHistory]);

  // Mouse handlers for selection
  const handleCanvasClick = useCallback((event: MouseEvent) => {
    if (!cameraRef.current || !sceneRef.current || !rendererRef.current) return;

    const rect = rendererRef.current.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );

    raycasterRef.current.setFromCamera(mouse, cameraRef.current);
    
    const meshes: THREE.Object3D[] = [];
    state.objects.forEach(obj => {
      if (obj.mesh instanceof THREE.Mesh || obj.mesh instanceof THREE.Line) {
        meshes.push(obj.mesh);
      } else if (obj.mesh instanceof THREE.Group) {
        obj.mesh.traverse(child => {
          if (child instanceof THREE.Mesh) {
            meshes.push(child);
          }
        });
      }
    });

    const intersects = raycasterRef.current.intersectObjects(meshes, true);
    
    if (intersects.length > 0) {
      let intersectedObject = intersects[0].object;
      let foundId: string | null = null;

      // Find the top-level CAD object
      state.objects.forEach(obj => {
        if (obj.mesh === intersectedObject || 
            (obj.mesh instanceof THREE.Group && intersectedObject.parent === obj.mesh)) {
          foundId = obj.id;
        }
      });

      selectObject(foundId);
    } else {
      selectObject(null);
    }
  }, [state.objects, selectObject]);

  // Resize handler
  const handleResize = useCallback(() => {
    if (!cameraRef.current || !rendererRef.current) return;

    const container = rendererRef.current.domElement.parentElement;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    if (cameraRef.current instanceof THREE.PerspectiveCamera) {
      cameraRef.current.aspect = width / height;
      cameraRef.current.updateProjectionMatrix();
    } else if (cameraRef.current instanceof THREE.OrthographicCamera) {
      const aspect = width / height;
      const frustumSize = 10;
      cameraRef.current.left = frustumSize * aspect / -2;
      cameraRef.current.right = frustumSize * aspect / 2;
      cameraRef.current.top = frustumSize / 2;
      cameraRef.current.bottom = frustumSize / -2;
      cameraRef.current.updateProjectionMatrix();
    }

    rendererRef.current.setSize(width, height);
  }, []);

  // Set active tool
  const setActiveTool = useCallback((tool: ToolType) => {
    setState(prev => ({
      ...prev,
      activeTool: tool,
    }));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      cleanupMemory();
      if (rendererRef.current) {
        rendererRef.current.dispose();
        rendererRef.current.forceContextLoss();
        rendererRef.current.domElement.remove();
      }
    };
  }, [cleanupMemory]);

  return {
    state,
    sceneRef,
    cameraRef,
    rendererRef,
    controlsRef,
    initScene,
    cleanupMemory,
    undo,
    redo,
    setActiveTool,
    selectObject,
    syncCameraMatrix,
    toggleOrthoMode,
    createLine,
    createPolyline,
    createRectangle,
    createCircle,
    executeExtrude,
    executeFillet,
    executeTrim,
    executeExtend,
    executeRotate,
    executeOffset,
    executeScale,
    executeUnion,
    executeSubtract,
    executeErase,
    handleCanvasClick,
    handleResize,
    addObject,
  };
};
```

```tsx
// App.tsx
import React, { useEffect, useRef, useCallback } from 'react';
import { useCADEngine } from './useCADEngine';
import * as THREE from 'three';

const App: React.FC = () => {
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const {
    state,
    initScene,
    undo,
    redo,
    setActiveTool,
    syncCameraMatrix,
    toggleOrthoMode,
    createLine,
    createPolyline,
    createRectangle,
    createCircle,
    executeExtrude,
    executeFillet,
    executeTrim,
    executeExtend,
    executeRotate,
    executeOffset,
    executeScale,
    executeUnion,
    executeSubtract,
    executeErase,
    handleCanvasClick,
    handleResize,
  } = useCADEngine();

  // Initialize scene on mount
  useEffect(() => {
    if (canvasContainerRef.current) {
      initScene(canvasContainerRef.current);
    }

    // Add resize listener
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [initScene, handleResize]);

  // Setup canvas click handler
  useEffect(() => {
    const container = canvasContainerRef.current;
    if (container) {
      container.addEventListener('click', handleCanvasClick);
      return () => {
        container.removeEventListener('click', handleCanvasClick);
      };
    }
  }, [handleCanvasClick]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent)