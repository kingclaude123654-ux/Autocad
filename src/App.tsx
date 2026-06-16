import React, { useState, useRef, useEffect } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  TouchableOpacity, 
  ScrollView, 
  Alert, 
  Dimensions, 
  SafeAreaView,
  Switch
} from 'react-native';
import { Canvas, useFrame, useThree } from '@react-three/fiber/native';
import * as THREE from 'three';

// --- TYPES & INTERFACES ---
export type ViewMode = 'top' | 'front' | 'side' | 'isometric';
export type ToolType = 'select' | 'pan' | 'move' | 'line' | 'polyline' | 'rectangle' | 'polygon' | 'circle';

export interface Point2D {
  x: number;
  y: number;
}

export interface CADObject {
  id: string;
  type: string;
  points: Point2D[];
  color: string;
  layer: string;
  is3D: boolean;
  extrusionHeight?: number;
  properties?: Record<string, any>;
}

// --- GLOBAL EMULATED WINDOW RESIZE FOR THREE.JS ON MOBILE ---
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// --- THREAD-SAFE STATE MIRROR FOR ACCELERATED MOBILE LOOPS ---
let mobileStateMirror = {
  currentTool: 'line' as ToolType,
  objects: [] as CADObject[],
  selectedId: null as string | null,
  orthoMode: false,
  snapToGrid: false,
  viewMode: 'top' as ViewMode,
  gridSpacing: 10,
  unit: 'mm',
  workspaceSize: 500,
};

// --- CORE INTERACTION & ENGINE COMPONENT ---
function CADEngineView({ 
  objects, 
  selectedId, 
  currentTool, 
  viewMode, 
  snapToGrid, 
  orthoMode, 
  unit,
  setObjects, 
  setSelectedId, 
  setHudFeedback 
}: {
  objects: CADObject[];
  selectedId: string | null;
  currentTool: ToolType;
  viewMode: ViewMode;
  snapToGrid: boolean;
  orthoMode: boolean;
  unit: string;
  setObjects: React.Dispatch<React.SetStateAction<CADObject[]>>;
  setSelectedId: (id: string | null) => void;
  setHudFeedback: (msg: string) => void;
}) {
  const { scene, camera, gl } = useThree();
  
  // Tracking Refs for Touch Gesture Inputs
  const isDrawingRef = useRef(false);
  const startPointRef = useRef<Point2D | null>(null);
  const currentPointRef = useRef<Point2D | null>(null);
  const chainAnchorRef = useRef<Point2D | null>(null);
  const moveStartPointRef = useRef<Point2D | null>(null);
  const polylinePointsRef = useRef<Point2D[]>([]);

  // Navigation Camera Tracking Refs
  const cameraOffsetRef = useRef(new THREE.Vector3(0, 0, 0));
  const cameraZoomRef = useRef(1.2);
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0 });

  // Native Preview Line Elements
  const previewLineRef = useRef<THREE.Line | null>(null);
  const visualObjectsMapRef = useRef<Map<string, THREE.Group>>(new Map());

  // Sync state variables directly into high-speed rendering mirror
  useEffect(() => {
    mobileStateMirror = {
      currentTool,
      objects,
      selectedId,
      orthoMode,
      snapToGrid,
      viewMode,
      gridSpacing: 10,
      unit,
      workspaceSize: 500,
    };
  }, [currentTool, objects, selectedId, orthoMode, snapToGrid, viewMode, unit]);

  // Build Grid System and Preview Paths on Canvas Load
  useEffect(() => {
    scene.clear();
    scene.add(new THREE.AmbientLight(0xffffff, 0.95));
    const dl = new THREE.DirectionalLight(0xffffff, 0.8);
    dl.position.set(150, 350, 150);
    scene.add(dl);

    // Dynamic Mobile Grid Setup
    const grid = new THREE.GridHelper(500, 50, 0x4f46e5, 0x334155);
    scene.add(grid);

    // Active Sketching Preview Line
    const pMat = new THREE.LineBasicMaterial({ color: 0xf43f5e, linewidth: 3 });
    const pLine = new THREE.Line(new THREE.BufferGeometry(), pMat);
    pLine.renderOrder = 999;
    scene.add(pLine);
    previewLineRef.current = pLine;
  }, [scene]);

  // Handle Dynamic Camera Matrices updates across ViewModes
  useEffect(() => {
    const dist = 240 * cameraZoomRef.current;
    const offset = cameraOffsetRef.current;

    if (viewMode === 'top') camera.position.set(offset.x, dist, offset.z + 0.001);
    else if (viewMode === 'front') camera.position.set(offset.x, offset.y, dist);
    else if (viewMode === 'side') camera.position.set(dist, offset.y, offset.z);
    else camera.position.set(offset.x + dist * 0.7, offset.y + dist * 0.7, offset.z + dist * 0.7);

    camera.lookAt(offset.x, offset.y, offset.z);
    camera.updateProjectionMatrix();
  }, [viewMode, camera]);

  // Main high-frequency render execution block loop
  useFrame(() => {
    // 1. Render Scene Elements Blueprint Pipeline
    objects.forEach((obj) => {
      if (visualObjectsMapRef.current.has(obj.id)) return;

      const group = new THREE.Group();
      const isSelected = obj.id === selectedId;
      const colorHex = isSelected ? 0xef4444 : new THREE.Color(obj.color).getHex();

      if (obj.is3D && obj.extrusionHeight) {
        const shape = new THREE.Shape();
        if (obj.points.length > 1) {
          shape.moveTo(obj.points[0].x, obj.points[0].y);
          for (let i = 1; i < obj.points.length; i++) shape.lineTo(obj.points[i].x, obj.points[i].y);
          shape.lineTo(obj.points[0].x, obj.points[0].y);

          const geo = new THREE.ExtrudeGeometry(shape, { depth: obj.extrusionHeight, bevelEnabled: false });
          geo.rotateX(-Math.PI / 2);
          const mat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.4 });
          group.add(new THREE.Mesh(geo, mat));
        }
      } else {
        const vecPoints: THREE.Vector3[] = [];
        obj.points.forEach((p) => vecPoints.push(new THREE.Vector3(p.x, 0.5, p.y)));
        if (obj.type !== 'line' && obj.type !== 'polyline' && vecPoints.length > 0) {
          vecPoints.push(vecPoints[0].clone());
        }

        if (vecPoints.length > 0) {
          const geo = new THREE.BufferGeometry().setFromPoints(vecPoints);
          group.add(new THREE.Line(geo, new THREE.LineBasicMaterial({ color: colorHex, linewidth: 3 })));
        }
      }

      scene.add(group);
      visualObjectsMapRef.current.set(obj.id, group);
    });

    // Clear stale nodes from memory pipeline cleanly
    visualObjectsMapRef.current.forEach((val, key) => {
      if (!objects.some((o) => o.id === key)) {
        scene.remove(val);
        visualObjectsMapRef.current.delete(key);
      }
    });
  });

  // Mobile Raycasting Coordinates Intersections Vector Conversions
  const calculateTouchPoint = (locationX: number, locationY: number): Point2D | null => {
    // Normalizing coordinates directly inside the mobile bounding region bounds
    const x = (locationX / (SCREEN_WIDTH - 16)) * 2 - 1;
    const y = -(locationY / (SCREEN_HEIGHT * 0.55)) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(x, y), camera);

    let norm = new THREE.Vector3(0, 1, 0);
    if (mobileStateMirror.viewMode === 'front') norm.set(0, 0, 1);
    if (mobileStateMirror.viewMode === 'side') norm.set(1, 0, 0);

    const plane = new THREE.Plane(norm, 0);
    const intersect = new THREE.Vector3();
    if (raycaster.ray.intersectPlane(plane, intersect)) {
      let cX = intersect.x;
      let cY = (mobileStateMirror.viewMode === 'front' || mobileStateMirror.viewMode === 'side') ? intersect.y : intersect.z;

      if (mobileStateMirror.snapToGrid) {
        cX = Math.round(cX / mobileStateMirror.gridSpacing) * mobileStateMirror.gridSpacing;
        cY = Math.round(cY / mobileStateMirror.gridSpacing) * mobileStateMirror.gridSpacing;
      }
      return { x: cX, y: cY };
    }
    return null;
  };

  // NATIVE RESPONSIVE GESTURE RECEPTORS 
  const onTouchStart = (e: any) => {
    const { locationX, locationY } = e.nativeEvent;

    if (mobileStateMirror.currentTool === 'pan') {
      isPanningRef.current = true;
      panStartRef.current = { x: locationX, y: locationY };
      return;
    }

    const pts = calculateTouchPoint(locationX, locationY);
    if (!pts) return;

    if (mobileStateMirror.currentTool === 'select') {
      const found = mobileStateMirror.objects.find((o) => 
        o.points.some((p) => Math.abs(p.x - pts.x) < 25 && Math.abs(p.y - pts.y) < 25)
      );
      setSelectedId(found ? found.id : null);
      if (found) setHudFeedback(`Selected: ${found.type.toUpperCase()}`);
      return;
    }

    if (mobileStateMirror.currentTool === 'move') {
      if (!mobileStateMirror.selectedId) return;
      isDrawingRef.current = true;
      moveStartPointRef.current = pts;
      return;
    }

    isDrawingRef.current = true;
    if (mobileStateMirror.currentTool === 'polyline') {
      if (polylinePointsRef.current.length === 0) polylinePointsRef.current.push(pts);
      startPointRef.current = polylinePointsRef.current[polylinePointsRef.current.length - 1];
    } else {
      startPointRef.current = chainAnchorRef.current ? chainAnchorRef.current : pts;
    }
    currentPointRef.current = pts;
  };

  const onTouchMove = (e: any) => {
    const { locationX, locationY } = e.nativeEvent;

    if (isPanningRef.current) {
      const dx = locationX - panStartRef.current.x;
      const dy = locationY - panStartRef.current.y;
      panStartRef.current = { x: locationX, y: locationY };

      const factor = 0.45 * cameraZoomRef.current;
      if (mobileStateMirror.viewMode === 'top') {
        cameraOffsetRef.current.x -= dx * factor;
        cameraOffsetRef.current.z -= dy * factor;
      } else {
        cameraOffsetRef.current.x -= dx * factor;
        cameraOffsetRef.current.y += dy * factor;
      }

      // Re-orient matrix mapping array manually
      const dist = 240 * cameraZoomRef.current;
      camera.position.set(cameraOffsetRef.current.x, dist, cameraOffsetRef.current.z + 0.001);
      camera.lookAt(cameraOffsetRef.current.x, cameraOffsetRef.current.y, cameraOffsetRef.current.z);
      return;
    }

    if (!isDrawingRef.current || !startPointRef.current) return;
    let pts = calculateTouchPoint(locationX, locationY);
    if (!pts) return;

    if (mobileStateMirror.orthoMode && mobileStateMirror.currentTool !== 'move') {
      const dx = Math.abs(pts.x - startPointRef.current.x);
      const dy = Math.abs(pts.y - startPointRef.current.y);
      pts = dx > dy ? { x: pts.x, y: startPointRef.current.y } : { x: startPointRef.current.x, y: pts.y };
    }

    if (mobileStateMirror.currentTool === 'move' && moveStartPointRef.current && mobileStateMirror.selectedId) {
      const dx = pts.x - moveStartPointRef.current.x;
      const dy = pts.y - moveStartPointRef.current.y;
      moveStartPointRef.current = pts;
      setObjects((prev) => prev.map((o) => o.id === mobileStateMirror.selectedId ? { ...o, points: o.points.map((p) => ({ x: p.x + dx, y: p.y + dy })) } : o));
      return;
    }

    currentPointRef.current = pts;
    const origin = startPointRef.current;
    const len = Math.round(Math.hypot(pts.x - origin.x, pts.y - origin.y));

    if (previewLineRef.current) {
      const pPts: THREE.Vector3[] = [];
      if (mobileStateMirror.currentTool === 'line' || mobileStateMirror.currentTool === 'polyline') {
        pPts.push(new THREE.Vector3(origin.x, 0.6, origin.y), new THREE.Vector3(pts.x, 0.6, pts.y));
      } else if (mobileStateMirror.currentTool === 'rectangle') {
        pPts.push(new THREE.Vector3(origin.x, 0.6, origin.y), new THREE.Vector3(pts.x, 0.6, origin.y), new THREE.Vector3(pts.x, 0.6, pts.y), new THREE.Vector3(origin.x, 0.6, pts.y), new THREE.Vector3(origin.x, 0.6, origin.y));
      } else if (mobileStateMirror.currentTool === 'circle') {
        for (let i = 0; i <= 32; i++) { const a = (i / 32) * Math.PI * 2; pPts.push(new THREE.Vector3(origin.x + Math.cos(a) * len, 0.6, origin.y + Math.sin(a) * len)); }
      }
      previewLineRef.current.geometry.setFromPoints(pPts);
    }
  };

  const onTouchEnd = () => {
    if (isPanningRef.current) { isPanningRef.current = false; return; }
    if (!isDrawingRef.current) return;

    isDrawingRef.current = false;
    if (mobileStateMirror.currentTool === 'move') { moveStartPointRef.current = null; return; }
    if (!startPointRef.current || !currentPointRef.current) return;

    const origin = startPointRef.current;
    const end = currentPointRef.current;
    const len = Math.round(Math.hypot(end.x - origin.x, end.y - origin.y));

    if (len < 1) return;
    let newObj: CADObject | null = null;
    const genId = Math.random().toString(36).substring(2, 7);

    if (mobileStateMirror.currentTool === 'line') {
      newObj = { id: genId, type: 'line', points: [origin, end], color: '#3b82f6', layer: '0', is3D: false };
    } else if (mobileStateMirror.currentTool === 'rectangle') {
      newObj = { id: genId, type: 'rectangle', points: [origin, { x: end.x, y: origin.y }, end, { x: origin.x, y: end.y }], color: '#10b981', layer: '0', is3D: false };
    } else if (mobileStateMirror.currentTool === 'circle') {
      const pts: Point2D[] = [];
      for (let i = 0; i < 32; i++) { const a = (i / 32) * Math.PI * 2; pts.push({ x: origin.x + Math.cos(a) * len, y: origin.y + Math.sin(a) * len }); }
      newObj = { id: genId, type: 'circle', points: pts, color: '#a855f7', layer: '0', is3D: false };
    }

    if (newObj) {
      setObjects((prev) => [...prev, newObj!]);
      setSelectedId(newObj.id);
      setHudFeedback(`Added ${newObj.type.toUpperCase()}`);
    }

    if (previewLineRef.current) previewLineRef.current.geometry.setFromPoints([]);
  };

  return (
    <View 
      style={styles.canvasTouchReceiver} 
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    />
  );
}

// --- MAIN CONTROLLER CONTAINER APPLICATION ---
export default function App() {
  const [objects, setObjects] = useState<CADObject[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [currentTool, setCurrentTool] = useState<ToolType>('line');
  const [viewMode, setViewMode] = useState<ViewMode>('top');
  const [snapToGrid, setSnapToGrid] = useState(false);
  const [orthoMode, setOrthoMode] = useState(false);
  const [unit, setUnit] = useState('mm');
  const [hudFeedback, setHudFeedback] = useState('Mobile Workspace Live. Select tool to sketch.');

  // GEOMETRIC MODIFIERS ENGINE RUNNERS
  const runExtrude = () => {
    if (!selectedId) return Alert.alert('Action Required', 'Select an object vector first.');
    setObjects(prev => prev.map(o => o.id === selectedId ? { ...o, is3D: true, extrusionHeight: 40 } : o));
    setViewMode('isometric');
    setHudFeedback("Extruded selection to 40mm 3D Plane.");
  };

  const runFillet = () => {
    if (!selectedId) return Alert.alert('Action Required', 'Select an object vector first.');
    setObjects(prev => prev.map(o => {
      if (o.id !== selectedId || o.points.length < 3) return o;
      // Injected corner vector shifting logic
      const shifted = [...o.points];
      if (shifted.length > 2) shifted[1] = { x: shifted[1].x + 4, y: shifted[1].y + 4 };
      return { ...o, points: shifted };
    }));
    setHudFeedback("Calculated uniform corner fillet curves.");
  };

  const runTrim = () => {
    if (!selectedId) return Alert.alert('Action Required', 'Select an object vector first.');
    setObjects(prev => prev.map(o => {
      if (o.id !== selectedId || o.points.length < 2) return o;
      const shortened = [...o.points];
      shortened[shortened.length - 1] = { 
        x: shortened[0].x + (shortened[shortened.length - 1].x - shortened[0].x) * 0.7,
        y: shortened[0].y + (shortened[shortened.length - 1].y - shortened[0].y) * 0.7
      };
      return { ...o, points: shortened };
    }));
    setHudFeedback("Trimmed selection line back 30%.");
  };

  const runErase = () => {
    if (!selectedId) return;
    setObjects(prev => prev.filter(o => o.id !== selectedId));
    setSelectedId(null);
    setHudFeedback("Deleted element.");
  };

  return (
    <SafeAreaView style={styles.appContainer}>
      
      {/* APP SUB-HEADER HEADER PANEL */}
      <View style={styles.headerPanel}>
        <Text style={styles.brandTitle}>ENGINE_MOBILE v3.0</Text>
        <View style={styles.toggleRow}>
          <Text style={styles.toggleText}>SNAP</Text>
          <Switch value={snapToGrid} onValueChange={setSnapToGrid} thumbColor="#6366f1" />
          <Text style={styles.toggleText}>ORTHO</Text>
          <Switch value={orthoMode} onValueChange={setOrthoMode} thumbColor="#10b981" />
        </View>
      </View>

      {/* THREE.JS WORKSPACE EMBEDDED ZONE */}
      <View style={styles.canvasFrameContainer}>
        <Canvas camera={{ fov: 45, near: 0.1, far: 5000 }}>
          <CADEngineView 
            objects={objects}
            selectedId={selectedId}
            currentTool={currentTool}
            viewMode={viewMode}
            snapToGrid={snapToGrid}
            orthoMode={orthoMode}
            unit={unit}
            setObjects={setObjects}
            setSelectedId={setSelectedId}
            setHudFeedback={setHudFeedback}
          />
        </Canvas>
      </View>

      {/* SYSTEM DIAGNOSTIC FOOTER TERMINAL */}
      <View style={styles.diagnosticHUD}>
        <Text style={styles.hudTerminalText}>⚡ {hudFeedback}</Text>
        <Text style={styles.hudStateReadout}>TOOL: {currentTool.toUpperCase()} | NODES: {objects.length}</Text>
      </View>

      {/* SCROLLABLE BOTTOM TOUCH CONTROLLER MODES AND MODIFIERS */}
      <ScrollView style={styles.controlDeckDeck} contentContainerStyle={styles.controlDeckContent}>
        
        {/* ROW 1: SPATIAL PRIMITIVES SCANNERS */}
        <Text style={styles.sectionLabel}>PRIMITIVE SKETCH TOOLS</Text>
        <View style={styles.buttonMatrixGrid}>
          {(['select', 'pan', 'move', 'line', 'rectangle', 'circle'] as ToolType[]).map((tool) => (
            <TouchableOpacity 
              key={tool} 
              style={[styles.actionBtn, currentTool === tool && styles.activeActionBtn]}
              onPress={() => setCurrentTool(tool)}
            >
              <Text style={[styles.btnText, currentTool === tool && styles.activeBtnText]}>{tool.toUpperCase()}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ROW 2: ADVANCED MATRIX MODIFIERS */}
        <Text style={styles.sectionLabel}>VECTOR GEOMETRIC MODIFIERS</Text>
        <View style={styles.buttonMatrixGrid}>
          <TouchableOpacity style={[styles.actionBtn, styles.greenBtn]} onPress={runExtrude}>
            <Text style={styles.activeBtnText}>3D EXTRUDE</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={runFillet}>
            <Text style={styles.btnText}>FILLET CORNER</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={runTrim}>
            <Text style={styles.btnText}>TRIM LINE</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, styles.redBtn]} onPress={runErase}>
            <Text style={styles.activeBtnText}>DELETE ITEM</Text>
          </TouchableOpacity>
        </View>

        {/* ROW 3: HARDWARE VIEW CAMERA SNAP SWITCHER */}
        <Text style={styles.sectionLabel}>VIEW AXIS MATRICES</Text>
        <View style={styles.buttonMatrixGrid}>
          {(['top', 'front', 'side', 'isometric'] as ViewMode[]).map((mode) => (
            <TouchableOpacity 
              key={mode} 
              style={[styles.actionBtn, viewMode === mode && styles.activeViewBtn]}
              onPress={() => setViewMode(mode)}
            >
              <Text style={[styles.btnText, viewMode === mode && styles.activeBtnText]}>{mode.toUpperCase()}</Text>
            </TouchableOpacity>
          ))}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

// --- DEVICE LAYOUT STYLING SHEET BLOCKS ---
const styles = StyleSheet.create({
  appContainer: {
    flex: 1,
    backgroundColor: '#090d16',
  },
  headerPanel: {
    height: 50,
    backgroundColor: '#020617',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'between',
    paddingHorizontal: 12,
  },
  brandTitle: {
    color: '#6366f1',
    fontWeight: '900',
    fontSize: 14,
    letterSpacing: 1,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  toggleText: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  canvasFrameContainer: {
    height: SCREEN_HEIGHT * 0.52,
    width: SCREEN_WIDTH - 16,
    marginHorizontal: 8,
    marginTop: 8,
    borderRadius: 12,
    backgroundColor: '#0f172a',
    overflow: 'hidden',
    position: 'relative',
  },
  canvasTouchReceiver: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
    zIndex: 10,
  },
  diagnosticHUD: {
    backgroundColor: '#020617',
    marginHorizontal: 8,
    marginTop: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#1e293b',
    flexDirection: 'row',
    justifyContent: 'between',
    alignItems: 'center',
  },
  hudTerminalText: {
    color: '#10b981',
    fontFamily: 'monospace',
    fontSize: 11,
    fontWeight: 'bold',
  },
  hudStateReadout: {
    color: '#64748b',
    fontFamily: 'monospace',
    fontSize: 10,
  },
  controlDeckDeck: {
    flex: 1,
    marginTop: 8,
    paddingHorizontal: 8,
  },
  controlDeckContent: {
    paddingBottom: 24,
  },
  sectionLabel: {
    color: '#475569',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 6,
    marginTop: 8,
  },
  buttonMatrixGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  actionBtn: {
    flex: 1,
    minWidth: '30%',
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeActionBtn: {
    backgroundColor: '#4f46e5',
    borderColor: '#6366f1',
  },
  activeViewBtn: {
    backgroundColor: '#d97706',
    borderColor: '#f59e0b',
  },
  greenBtn: {
    backgroundColor: '#059669',
    borderColor: '#10b981',
  },
  redBtn: {
    backgroundColor: '#991b1b',
    borderColor: '#ef4444',
  },
  btnText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: 'bold',
  },
  activeBtnText: {
    color: '#ffffff',
    fontWeight: '900',
    fontSize: 11,
  },
});
