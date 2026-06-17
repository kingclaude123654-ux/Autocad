import { useRef, useState, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// --- Type Definitions ---
export type ViewMode = 'top' | 'front' | 'side' | 'isometric';
export type CADObject = {
  id: string;
  type: string;
  geometry: THREE.BufferGeometry;
  material: THREE.Material | THREE.Material[];
  mesh: THREE.Mesh | THREE.Line | THREE.LineLoop;
};

export type HistoryEntry = {
  objects: CADObject[];
  selectedId: string | null;
  // Add other relevant state for undo/redo
};

export interface CADEngineHook {
  objects: CADObject[];
  selectedId: string | null;
  viewMode: ViewMode;
  orthoMode: boolean;
  canvasRef: React.RefObject<HTMLDivElement>;
  // State setters
  setOrthoMode: (mode: boolean) => void;
  setViewMode: (mode: ViewMode) => void;
  // Drawing tools
  drawLine: (start: THREE.Vector3, end: THREE.Vector3) => void;
  drawPolyline: (points: THREE.Vector3[]) => void;
  drawRectangle: (p1: THREE.Vector3, p2: THREE.Vector3) => void;
  drawCircle: (center: THREE.Vector3, radius: number) => void;
  // Selection and manipulation
  selectObject: (id: string | null) => void;
  moveObject: (id: string, delta: THREE.Vector3) => void;
  // Transformation features
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
  // History
  undo: () => void;
  redo: () => void;
  // Memory management
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
        geometry: obj.geometry.clone(), // Deep clone geometry
        material: Array.isArray(obj.material) ? obj.material.map(m => m.clone()) : obj.material.clone(), // Deep clone material
        mesh: obj.mesh.clone(), // Deep clone mesh
      })),
      selectedId,
    };
    // Clear redo history
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
      // Re-render scene based on restored state
      // This will be handled by useEffect for objects
    }
  }, []);

  const redo = useCallback(() => {
    if (historyPointer.current < history.current.length - 1) {
      historyPointer.current++;
      const nextState = history.current[historyPointer.current];
      setObjects(nextState.objects);
      setSelectedId(nextState.selectedId);
      // Re-render scene based on restored state
      // This will be handled by useEffect for objects
    }
  }, []);

  // --- Memory Management ---
  const cleanupMemory = useCallback(() => {
    scene.current.children.forEach(child => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach(material => material.dispose());
        } else {
          child.material.dispose();
        }
        scene.current.remove(child);
      }
    });
    renderer.current?.dispose();
    // Note: Controls do not have a dispose method in OrbitControls
  }, []);

  // --- Camera & View Management ---
  const syncCameraMatrix = useCallback(() => {
    if (!camera.current || !renderer.current || !controls.current) return;

    const aspect = window.innerWidth / window.innerHeight; // Adjust as needed
    const frustumSize = 100; // For orthographic camera

    if (orthoMode) {
      camera.current = new THREE.OrthographicCamera(
        frustumSize * aspect / -2,
        frustumSize * aspect / 2,
        frustumSize / 2,
        frustumSize / -2,
        0.1,
        1000
      );
    } else {
      camera.current = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
    }

    // Set camera position based on viewMode
    switch (viewMode) {
      case 'top':
        camera.current.position.set(0, 100, 0);
        camera.current.up.set(0, 0, 1);
        break;
      case 'front':
        camera.current.position.set(0, 0, 100);
        camera.current.up.set(0, 1, 0);
        break;
      case 'side':
        camera.current.position.set(100, 0, 0);
        camera.current.up.set(0, 1, 0);
        break;
      case 'isometric':
      default:
        camera.current.position.set(100, 100, 100);
        camera.current.up.set(0, 1, 0);
        break;
    }
    camera.current.lookAt(scene.current.position);
    controls.current.object = camera.current; // Update controls with new camera
    controls.current.update();
    renderer.current.setSize(window.innerWidth, window.innerHeight); // Adjust as needed
    camera.current.updateProjectionMatrix();
  }, [orthoMode, viewMode]);

  // --- Drawing Tools (Placeholders for now) ---
  const drawLine = useCallback((start: THREE.Vector3, end: THREE.Vector3) => {
    const material = new THREE.LineBasicMaterial({ color: 0x0000ff });
    const points = [start, end];
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
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
    const shape = new THREE.Shape();
    shape.moveTo(p1.x, p1.y);
    shape.lineTo(p2.x, p1.y);
    shape.lineTo(p2.x, p2.y);
    shape.lineTo(p1.x, p2.y);
    shape.lineTo(p1.x, p1.y);
    const points = shape.getPoints().map(point => new THREE.Vector3(point.x, point.y, 0));
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const rectangle = new THREE.LineLoop(geometry, material); // Use LineLoop for closed shapes
    rectangle.name = `rectangle-${Date.now()}`;
    setObjects(prev => [...prev, { id: rectangle.name, type: 'rectangle', geometry, material, mesh: rectangle }]);
  }, []);

  const drawCircle = useCallback((center: THREE.Vector3, radius: number) => {
    const material = new THREE.LineBasicMaterial({ color: 0xffff00 });
    const geometry = new THREE.CircleGeometry(radius, 32);
    // CircleGeometry no longer has .vertices. Instead, we'll create points for the LineLoop directly.
    const points = [];
    const segments = 32;
    for (let i = 0; i <= segments; i++) {
      const theta = (i / segments) * Math.PI * 2;
      points.push(new THREE.Vector3(center.x + radius * Math.cos(theta), center.y + radius * Math.sin(theta), center.z));
    }
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const circle = new THREE.LineLoop(geometry, material);
    circle.position.copy(center);
    circle.name = `circle-${Date.now()}`;
    setObjects(prev => [...prev, { id: circle.name, type: 'circle', geometry, material, mesh: circle }]);
  }, []);

  // --- Selection and Manipulation (Placeholders for now) ---
  const selectObject = useCallback((id: string | null) => {
    setSelectedId(id);
  }, []);

  const moveObject = useCallback((id: string, delta: THREE.Vector3) => {
    setObjects(prevObjects =>
      prevObjects.map(obj =>
        obj.id === id
          ? { ...obj, mesh: obj.mesh.clone().translateOnAxis(delta.normalize(), delta.length()) }
          : obj
      )
    );
  }, []);

  // --- Transformation Features (Placeholders for now) ---
  const executeExtrude = useCallback((id: string, depth: number) => {
    setObjects(prevObjects =>
      prevObjects.map(obj => {
        if (obj.id === id && obj.mesh instanceof THREE.Line) {
          const points = (obj.geometry as THREE.BufferGeometry).attributes.position.array;
          const shape = new THREE.Shape();
          for (let i = 0; i < points.length; i += 3) {
            if (i === 0) {
              shape.moveTo(points[i], points[i + 1]);
            } else {
              shape.lineTo(points[i], points[i + 1]);
            }
          }
          const extrudeSettings = {
            steps: 1,
            depth: depth,
            bevelEnabled: false,
          };
          const extrudedGeometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
          const extrudedMesh = new THREE.Mesh(extrudedGeometry, new THREE.MeshPhongMaterial({ color: (obj.material as THREE.Material).color }));
          extrudedMesh.name = obj.id;
          return { ...obj, geometry: extrudedGeometry, material: extrudedMesh.material, mesh: extrudedMesh };
        }
        return obj;
      })
    );
  }, []);

  const executeFillet = useCallback((id: string, radius: number) => {
    setObjects(prevObjects =>
      prevObjects.map(obj => {
        if (obj.id === id && (obj.mesh instanceof THREE.Line || obj.mesh instanceof THREE.LineLoop)) {
          const oldGeometry = obj.geometry as THREE.BufferGeometry;
          const positions = oldGeometry.attributes.position.array;
          const newPositions: number[] = [];

          if (positions.length < 6) return obj; // Need at least two points for a line segment

          for (let i = 0; i < positions.length; i += 3) {
            const p1 = new THREE.Vector3(positions[i - 3], positions[i - 2], positions[i - 1]);
            const p2 = new THREE.Vector3(positions[i], positions[i + 1], positions[i + 2]);
            const p3 = new THREE.Vector3(positions[i + 3], positions[i + 4], positions[i + 5]);

            if (i === 0) {
              newPositions.push(p2.x, p2.y, p2.z);
              continue;
            }
            if (i === positions.length - 3) {
              newPositions.push(p2.x, p2.y, p2.z);
              continue;
            }

            // Simplified fillet: replace sharp corner with a curve
            const v1 = new THREE.Vector3().subVectors(p1, p2).normalize();
            const v2 = new THREE.Vector3().subVectors(p3, p2).normalize();

            const angle = v1.angleTo(v2);
            if (angle > 0.01) { // Only fillet if there's a significant angle
              const curvePoints = [];
              const segments = 8; // Number of segments for the fillet curve
              const startAngle = Math.atan2(v1.y, v1.x);
              const endAngle = Math.atan2(v2.y, v2.x);

              const center = p2.clone().add(v1.clone().add(v2).normalize().multiplyScalar(radius / Math.sin(angle / 2)));

              for (let j = 0; j <= segments; j++) {
                const t = j / segments;
                const currentAngle = startAngle + (endAngle - startAngle) * t;
                const x = center.x + radius * Math.cos(currentAngle);
                const y = center.y + radius * Math.sin(currentAngle);
                curvePoints.push(x, y, p2.z); // Assuming 2D fillet for simplicity
              }
              newPositions.push(...curvePoints);
            } else {
              newPositions.push(p2.x, p2.y, p2.z);
            }
          }

          const newGeometry = new THREE.BufferGeometry();
          newGeometry.setAttribute(
            'position',
            new THREE.Float32BufferAttribute(newPositions, 3)
          );
          const newMesh = new THREE.Line(newGeometry, obj.material);
          newMesh.name = obj.id;
          return { ...obj, geometry: newGeometry, mesh: newMesh };
        }
        return obj;
      })
    );
  }, []);

  const executeTrim = useCallback((id: string, cuttingId: string) => {
    setObjects(prevObjects => {
      const trimmedObject = prevObjects.find(obj => obj.id === id);
      const cuttingObject = prevObjects.find(obj => obj.id === cuttingId);

      if (!trimmedObject || !cuttingObject || !(trimmedObject.mesh instanceof THREE.Line) || !(cuttingObject.mesh instanceof THREE.Line)) {
        console.warn("Trim operation currently only supports lines and requires both objects to exist.");
        return prevObjects;
      }

      const trimmedPositions = (trimmedObject.geometry as THREE.BufferGeometry).attributes.position.array;
      const cuttingPositions = (cuttingObject.geometry as THREE.BufferGeometry).attributes.position.array;

      const newPositions: number[] = [];
      const intersectionPoints: THREE.Vector3[] = [];

      // Helper to find line-line intersection (2D for simplicity)
      const findIntersection = (p1: THREE.Vector2, p2: THREE.Vector2, p3: THREE.Vector2, p4: THREE.Vector2): THREE.Vector2 | null => {
        const den = (p1.x - p2.x) * (p3.y - p4.y) - (p1.y - p2.y) * (p3.x - p4.x);
        if (den === 0) return null; // Lines are parallel or collinear

        const t = ((p1.x - p3.x) * (p3.y - p4.y) - (p1.y - p3.y) * (p3.x - p4.x)) / den;
        const u = -((p1.x - p2.x) * (p1.y - p3.y) - (p1.y - p2.y) * (p1.x - p3.x)) / den;

        if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
          return new THREE.Vector2(p1.x + t * (p2.x - p1.x), p1.y + t * (p2.y - p1.y));
        }
        return null;
      };

      // Iterate through segments of the trimmed object
      for (let i = 0; i < trimmedPositions.length - 3; i += 3) {
        const seg1_p1 = new THREE.Vector2(trimmedPositions[i], trimmedPositions[i + 1]);
        const seg1_p2 = new THREE.Vector2(trimmedPositions[i + 3], trimmedPositions[i + 4]);

        let segmentCut = false;
        // Check intersection with cutting object segments
        for (let j = 0; j < cuttingPositions.length - 3; j += 3) {
          const seg2_p1 = new THREE.Vector2(cuttingPositions[j], cuttingPositions[j + 1]);
          const seg2_p2 = new THREE.Vector2(cuttingPositions[j + 3], cuttingPositions[j + 4]);

          const intersection = findIntersection(seg1_p1, seg1_p2, seg2_p1, seg2_p2);
          if (intersection) {
            intersectionPoints.push(new THREE.Vector3(intersection.x, intersection.y, trimmedPositions[i + 2]));
            segmentCut = true;
            break; // Segment is cut, no need to check further cutting segments
          }
        }

        if (!segmentCut) {
          // If no intersection, keep the segment
          newPositions.push(trimmedPositions[i], trimmedPositions[i + 1], trimmedPositions[i + 2]);
          if (i === trimmedPositions.length - 6) { // Add the last point of the last segment
            newPositions.push(trimmedPositions[i + 3], trimmedPositions[i + 4], trimmedPositions[i + 5]);
          }
        } else {
          // If cut, we need to decide which part to keep. For simplicity, we'll remove the entire segment.
          // A more advanced implementation would split the segment at the intersection point.
          console.log(`Segment from (${seg1_p1.x}, ${seg1_p1.y}) to (${seg1_p2.x}, ${seg1_p2.y}) was cut.`);
        }
      }

      if (newPositions.length === 0) {
        // If the entire object is trimmed, remove it
        return prevObjects.filter(obj => obj.id !== id);
      } else {
        const newGeometry = new THREE.BufferGeometry();
        newGeometry.setAttribute(
          'position',
          new THREE.Float32BufferAttribute(newPositions, 3)
        );
        const newMesh = new THREE.Line(newGeometry, trimmedObject.material);
        newMesh.name = trimmedObject.id;
        return prevObjects.map(obj => (obj.id === id ? { ...obj, geometry: newGeometry, mesh: newMesh } : obj));
      }
    });
  }, []);

  const executeExtend = useCallback((id: string, targetId: string) => {
    setObjects(prevObjects => {
      const lineToExtend = prevObjects.find(obj => obj.id === id);
      const targetLine = prevObjects.find(obj => obj.id === targetId);

      if (!lineToExtend || !targetLine || !(lineToExtend.mesh instanceof THREE.Line) || !(targetLine.mesh instanceof THREE.Line)) {
        console.warn("Extend operation currently only supports lines and requires both objects to exist.");
        return prevObjects;
      }

      const lineToExtendPositions = (lineToExtend.geometry as THREE.BufferGeometry).attributes.position.array;
      const targetLinePositions = (targetLine.geometry as THREE.BufferGeometry).attributes.position.array;

      const p1 = new THREE.Vector2(lineToExtendPositions[0], lineToExtendPositions[1]);
      const p2 = new THREE.Vector2(lineToExtendPositions[lineToExtendPositions.length - 3], lineToExtendPositions[lineToExtendPositions.length - 2]);

      const p3 = new THREE.Vector2(targetLinePositions[0], targetLinePositions[1]);
      const p4 = new THREE.Vector2(targetLinePositions[targetLinePositions.length - 3], targetLinePositions[targetLinePositions.length - 2]);

      // Helper to find line-line intersection (2D for simplicity, allowing extension beyond segments)
      const findLineLineIntersection = (l1p1: THREE.Vector2, l1p2: THREE.Vector2, l2p1: THREE.Vector2, l2p2: THREE.Vector2): THREE.Vector2 | null => {
        const den = (l1p1.x - l1p2.x) * (l2p1.y - l2p2.y) - (l1p1.y - l1p2.y) * (l2p1.x - l2p2.x);
        if (den === 0) return null; // Lines are parallel or collinear

        const t = ((l1p1.x - l2p1.x) * (l2p1.y - l2p2.y) - (l1p1.y - l2p1.y) * (l2p1.x - l2p2.x)) / den;
        const u = -((l1p1.x - l1p2.x) * (l1p1.y - l2p1.y) - (l1p1.y - l1p2.y) * (l1p1.x - l2p1.x)) / den;

        // For extension, we only care if the intersection point lies on the target line segment (u between 0 and 1)
        // and if the intersection point is in the direction of extension for the line to extend (t > 0 or t < 0 depending on which end is extended)
        if (u >= 0 && u <= 1) {
          return new THREE.Vector2(l1p1.x + t * (l1p2.x - l1p1.x), l1p1.y + t * (l1p2.y - l1p1.y));
        }
        return null;
      };

      const intersection = findLineLineIntersection(p1, p2, p3, p4);

      if (intersection) {
        const newPositions = [...lineToExtendPositions.slice(0, lineToExtendPositions.length - 3), intersection.x, intersection.y, lineToExtendPositions[lineToExtendPositions.length - 1]];
        const newGeometry = new THREE.BufferGeometry();
        newGeometry.setAttribute(
          'position',
          new THREE.Float32BufferAttribute(newPositions, 3)
        );
        const newMesh = new THREE.Line(newGeometry, lineToExtend.material);
        newMesh.name = lineToExtend.id;
        return prevObjects.map(obj => (obj.id === id ? { ...obj, geometry: newGeometry, mesh: newMesh } : obj));
      } else {
        console.warn("No intersection found for extension.");
        return prevObjects;
      }
    });
  }, []);

  const executeRotate = useCallback((id: string, axis: THREE.Vector3, angle: number) => {
    setObjects(prevObjects =>
      prevObjects.map(obj =>
        obj.id === id
          ? { ...obj, mesh: obj.mesh.clone().rotateOnAxis(axis.normalize(), angle) }
          : obj
      )
    );
  }, []);

  const executeOffset = useCallback((id: string, distance: number) => {
    setObjects(prevObjects =>
      prevObjects.map(obj => {
        if (obj.id === id && (obj.mesh instanceof THREE.Line || obj.mesh instanceof THREE.LineLoop)) {
          const oldGeometry = obj.geometry as THREE.BufferGeometry;
          const positions = oldGeometry.attributes.position.array;
          const newPositions: number[] = [];

          for (let i = 0; i < positions.length; i += 3) {
            const p1 = new THREE.Vector3(positions[i], positions[i + 1], positions[i + 2]);
            let p2;
            if (i + 3 < positions.length) {
              p2 = new THREE.Vector3(positions[i + 3], positions[i + 4], positions[i + 5]);
            } else if (obj.mesh instanceof THREE.LineLoop) {
              p2 = new THREE.Vector3(positions[0], positions[1], positions[2]); // For closed shapes, connect last to first
            } else {
              newPositions.push(p1.x, p1.y, p1.z); // Last point of an open line
              break;
            }

            const direction = new THREE.Vector3().subVectors(p2, p1).normalize();
            const normal = new THREE.Vector3(direction.y, -direction.x, 0); // Perpendicular in XY plane
            const offsetVector = normal.multiplyScalar(distance);

            const newP1 = p1.clone().add(offsetVector);
            newPositions.push(newP1.x, newP1.y, newP1.z);

            if (i + 3 >= positions.length && !(obj.mesh instanceof THREE.LineLoop)) {
              const newP2 = p2.clone().add(offsetVector);
              newPositions.push(newP2.x, newP2.y, newP2.z);
            }
          }

          const newGeometry = new THREE.BufferGeometry();
          newGeometry.setAttribute(
            'position',
            new THREE.Float32BufferAttribute(newPositions, 3)
          );
          const newMesh = (obj.mesh instanceof THREE.LineLoop) ? new THREE.LineLoop(newGeometry, obj.material) : new THREE.Line(newGeometry, obj.material);
          newMesh.name = obj.id;
          return { ...obj, geometry: newGeometry, mesh: newMesh };
        }
        return obj;
      })
    );
  }, []);

  const executeScale = useCallback((id: string, factor: THREE.Vector3) => {
    setObjects(prevObjects =>
      prevObjects.map(obj =>
        obj.id === id
          ? { ...obj, mesh: obj.mesh.clone().scale(factor) as THREE.Object3D }
          : obj
      )
    );
  }, []);

  const executeUnion = useCallback((id1: string, id2: string) => {
    console.warn("executeUnion: Full 3D Boolean operations require a dedicated library (e.g., three-bsp, three-csg). This is a simplified placeholder.");
    setObjects(prevObjects => {
      const obj1 = prevObjects.find(obj => obj.id === id1);
      if (!obj1) return prevObjects; // If obj1 doesn't exist, do nothing
      // For simplicity, we'll keep obj1 and remove obj2.
      // A real union would merge their geometries.
      return prevObjects.filter(obj => obj.id !== id2);
    });
  }, []);

  const executeSubtract = useCallback((id1: string, id2: string) => {
    console.warn("executeSubtract: Full 3D Boolean operations require a dedicated library (e.g., three-bsp, three-csg). This is a simplified placeholder.");
    setObjects(prevObjects => {
      // For simplicity, we'll remove both objects. A real subtract would modify obj1 by subtracting obj2.
      return prevObjects.filter(obj => obj.id !== id1 && obj.id !== id2);
    });
  }, []);

  const executeErase = useCallback((id: string) => {
    setObjects(prevObjects => prevObjects.filter(obj => obj.id !== id));
    setSelectedId(prevId => (prevId === id ? null : prevId));
  }, []);

  // --- Initial Setup and Render Loop ---
  useEffect(() => {
    if (!canvasRef.current) return;

    // Scene
    scene.current.background = new THREE.Color(0xf0f0f0);

    // Renderer
    renderer.current = new THREE.WebGLRenderer({ antialias: true });
    renderer.current.setSize(canvasRef.current.clientWidth, canvasRef.current.clientHeight);
    canvasRef.current.appendChild(renderer.current.domElement);

    // Camera (initial setup, will be synced by syncCameraMatrix)
    camera.current = new THREE.PerspectiveCamera(75, canvasRef.current.clientWidth / canvasRef.current.clientHeight, 0.1, 1000);
    camera.current.position.set(100, 100, 100);
    camera.current.lookAt(scene.current.position);

    // Controls
    controls.current = new OrbitControls(camera.current, renderer.current.domElement);
    controls.current.enableDamping = true;
    controls.current.dampingFactor = 0.05;

    // Grid Helper
    const gridHelper = new THREE.GridHelper(200, 20);
    scene.current.add(gridHelper);

    // Axes Helper
    const axesHelper = new THREE.AxesHelper(50);
    scene.current.add(axesHelper);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x606060);
    scene.current.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(1, 1, 1).normalize();
    scene.current.add(directionalLight);

    const animate = () => {
      requestAnimationFrame(animate);
      controls.current?.update();
      renderer.current?.render(scene.current, camera.current!);
    };
    animate();

    const handleResize = () => {
      if (camera.current && renderer.current && canvasRef.current) {
        const width = canvasRef.current.clientWidth;
        const height = canvasRef.current.clientHeight;
        if (camera.current instanceof THREE.PerspectiveCamera) {
          camera.current.aspect = width / height;
        } else if (camera.current instanceof THREE.OrthographicCamera) {
          const frustumSize = 100;
          camera.current.left = frustumSize * (width / height) / -2;
          camera.current.right = frustumSize * (width / height) / 2;
          camera.current.top = frustumSize / 2;
          camera.current.bottom = frustumSize / -2;
        }
        camera.current.updateProjectionMatrix();
        renderer.current.setSize(width, height);
      }
    };

    window.addEventListener('resize', handleResize);

    // Initial state save
    saveState();

    return () => {
      window.removeEventListener('resize', handleResize);
      cleanupMemory();
    };
  }, [cleanupMemory, saveState]);

  // Effect to update scene when objects change
  useEffect(() => {
    // Clear existing meshes from scene
    scene.current.children = scene.current.children.filter(child =>
      !(child instanceof THREE.Mesh)
    );

    objects.forEach(obj => {
      scene.current.add(obj.mesh);
    });

    // Highlight selected object
    scene.current.children.forEach(child => {
      if (child instanceof THREE.Mesh) {
        const cadObject = objects.find(o => o.id === child.name);
        if (cadObject) {
          // Reset material to original if not selected
          if (cadObject.id !== selectedId) {
            // Restore original material
            child.material = cadObject.material;
          } else {
            // Apply highlight material if selected
            // This is a simplified highlight, a proper implementation might involve a custom shader or outline pass
            if (Array.isArray(child.material)) {
              child.material = child.material.map(m => new THREE.MeshBasicMaterial({ color: 0xff0000, wireframe: true }));
            } else {
              child.material = new THREE.MeshBasicMaterial({ color: 0xff0000, wireframe: true });
            }
          }
        } else if (child instanceof THREE.Line || child instanceof THREE.LineLoop) {
          const cadObject = objects.find(o => o.id === child.name);
          if (cadObject) {
            if (cadObject.id !== selectedId) {
              child.material = cadObject.material;
            } else {
              if (Array.isArray(child.material)) {
                child.material = child.material.map(m => new THREE.LineBasicMaterial({ color: 0xff0000 }));
              } else {
                child.material = new THREE.LineBasicMaterial({ color: 0xff0000 });
              }
            }
          }
        }
      }
    });

    // Save state after objects update
    saveState();
  }, [objects, selectedId, saveState]);

  // Effect to sync camera when viewMode or orthoMode changes
  useEffect(() => {
    syncCameraMatrix();
  }, [viewMode, orthoMode, syncCameraMatrix]);

  return {
    objects,
    selectedId,
    viewMode,
    orthoMode,
    canvasRef,
    setOrthoMode,
    setViewMode,
    drawLine,
    drawPolyline,
    drawRectangle,
    drawCircle,
    selectObject,
    moveObject,
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
    undo,
    redo,
    cleanupMemory,
  };
};
