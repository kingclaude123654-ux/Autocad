import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

// --- SYSTEM MODULE IDENTIFIERS ---
export type ViewMode = 'top' | 'front' | 'side' | 'isometric';
export type ToolType = 
  | 'select' | 'pan' | 'move' | 'copy' | 'erase'
  | 'line' | 'polyline' | 'rectangle' | 'triangle' | 'circle'
  | 'extrude' | 'fillet' | 'chamfer' | 'union' | 'subtract';

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
  properties?: {
    length?: number;
    width?: number;
    height?: number;
    radius?: number;
  };
}

export default function App() {
  // --- MASTER STATE PLATFORM ---
  const [objects, setObjects] = useState<CADObject[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [currentTool, setCurrentTool] = useState<ToolType>('line');
  const [viewMode, setViewMode] = useState<ViewMode>('top');
  const [hudFeedback, setHudFeedback] = useState<string>('AutoCAD Engine Online. Select tool to begin layout.');
  
  const [snapToGrid, setSnapToGrid] = useState<boolean>(false);
  const [orthoMode, setOrthoMode] = useState<boolean>(false);
  
  const unit = 'mm';
  const workspaceSize = 1000;
  const gridSpacing = 20;

  // Track History Matrices (Undo / Redo Setup)
  const [history, setHistory] = useState<CADObject[][]>([[]]);
  const [historyIndex, setHistoryIndex] = useState<number>(0);

  // --- CORE SYSTEM POINTER ENGINE REFS ---
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const previewLineRef = useRef<THREE.Line | null>(null);
  const visualObjectsMapRef = useRef<Map<string, THREE.Object3D>>(new Map());

  // Input Calculators
  const isDrawingRef = useRef<boolean>(false);
  const startPointRef = useRef<Point2D | null>(null);
  const currentPointRef = useRef<Point2D | null>(null);
  const polylinePointsRef = useRef<Point2D[]>([]);
  
  // Navigation Trackers
  const cameraOffsetRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 0));
  const cameraZoomRef = useRef<number>(1.0);
  const isPanningRef = useRef<boolean>(false);
  const panStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Atomic state syncing mirror to completely bypass closure freezing bugs
  const stateRef = useRef({ currentTool, objects, selectedId, orthoMode, snapToGrid, viewMode, gridSpacing });
  useEffect(() => {
    stateRef.current = { currentTool, objects, selectedId, orthoMode, snapToGrid, viewMode, gridSpacing };
  }, [currentTool, objects, selectedId, orthoMode, snapToGrid, viewMode]);

  const generateId = () => Math.random().toString(36).substring(2, 9);

  // --- FORCE CAMERA SPACE RECALCULATIONS ---
  const updateCameraTransformationMatrix = () => {
    if (!cameraRef.current || !rendererRef.current || !sceneRef.current) return;
    const offset = cameraOffsetRef.current;
    const distanceTarget = 400 * cameraZoomRef.current;

    if (viewMode === 'top') {
      cameraRef.current.position.set(offset.x, distanceTarget, offset.z + 0.001);
    } else if (viewMode === 'front') {
      cameraRef.current.position.set(offset.x, offset.y, distanceTarget);
    } else if (viewMode === 'side') {
      cameraRef.current.position.set(distanceTarget, offset.y, offset.z);
    } else if (viewMode === 'isometric') {
      cameraRef.current.position.set(offset.x + distanceTarget * 0.7, offset.y + distanceTarget * 0.7, offset.z + distanceTarget * 0.7);
    }
    
    cameraRef.current.lookAt(offset.x, offset.y, offset.z);
    cameraRef.current.updateProjectionMatrix();
    rendererRef.current.render(sceneRef.current, cameraRef.current);
  };

  useEffect(() => { updateCameraTransformationMatrix(); }, [viewMode]);

  const pushStateToHistory = (nextMatrix: CADObject[]) => {
    const historicalTimeline = history.slice(0, historyIndex + 1);
    setHistory([...historicalTimeline, nextMatrix]);
    setHistoryIndex(historicalTimeline.length);
    setObjects(nextMatrix);
  };

  const runUndoCycle = () => {
    if (historyIndex > 0) {
      const targetIdx = historyIndex - 1;
      setHistoryIndex(targetIdx);
      setObjects(history[targetIdx]);
      setHudFeedback("Undo action performed.");
    } else {
      setHudFeedback("History limit reached.");
    }
  };

  const runRedoCycle = () => {
    if (historyIndex < history.length - 1) {
      const targetIdx = historyIndex + 1;
      setHistoryIndex(targetIdx);
      setObjects(history[targetIdx]);
      setHudFeedback("Redo action performed.");
    } else {
      setHudFeedback("Newest layout reached.");
    }
  };

  // --- SPATIAL MATH COORDINATE TRACER ---
  const calculateRaycastWorkspaceIntersection = (clientX: number, clientY: number): Point2D | null => {
    if (!containerRef.current || !cameraRef.current) return null;
    const boundaries = containerRef.current.getBoundingClientRect();
    const clipSpaceX = ((clientX - boundaries.left) / boundaries.width) * 2 - 1;
    const clipSpaceY = -((clientY - boundaries.top) / boundaries.height) * 2 + 1;

    const computationalRaycaster = new THREE.Raycaster();
    computationalRaycaster.setFromCamera(new THREE.Vector2(clipSpaceX, clipSpaceY), cameraRef.current);

    let geometricSurfaceNormal = new THREE.Vector3(0, 1, 0);
    if (stateRef.current.viewMode === 'front') geometricSurfaceNormal.set(0, 0, 1);
    if (stateRef.current.viewMode === 'side') geometricSurfaceNormal.set(1, 0, 0);

    const calculationPlane = new THREE.Plane(geometricSurfaceNormal, 0);
    const spatialIntersectionVector = new THREE.Vector3();

    if (computationalRaycaster.ray.intersectPlane(calculationPlane, spatialIntersectionVector)) {
      let absoluteX = spatialIntersectionVector.x;
      let absoluteY = (stateRef.current.viewMode === 'front' || stateRef.current.viewMode === 'side') 
        ? spatialIntersectionVector.y 
        : spatialIntersectionVector.z;

      if (stateRef.current.snapToGrid) {
        absoluteX = Math.round(absoluteX / stateRef.current.gridSpacing) * stateRef.current.gridSpacing;
        absoluteY = Math.round(absoluteY / stateRef.current.gridSpacing) * stateRef.current.gridSpacing;
      }
      return { x: absoluteX, y: absoluteY };
    }
    return null;
  };

  // --- UNIFIED POINTER CONTROLLER ENGINE ---
  const handleEnginePointerDown = (e: PointerEvent) => {
    const tool = stateRef.current.currentTool;
    if (tool === 'pan' || e.button === 2) {
      isPanningRef.current = true;
      panStartRef.current = { x: e.clientX, y: e.clientY };
      return;
    }

    const calculatedVectorCoords = calculateRaycastWorkspaceIntersection(e.clientX, e.clientY);
    if (!calculatedVectorCoords) return;

    if (tool === 'select' || tool === 'erase' || tool === 'extrude' || tool === 'fillet' || tool === 'chamfer') {
      const selectedMatch = stateRef.current.objects.find(obj => 
        obj.points.some(pt => Math.abs(pt.x - calculatedVectorCoords.x) < 25 && Math.abs(pt.y - calculatedVectorCoords.y) < 25)
      );

      if (selectedMatch) {
        setSelectedId(selectedMatch.id);
        setHudFeedback(`Focused Target: ${selectedMatch.type.toUpperCase()}`);
        if (tool === 'erase') {
          const absoluteRemainingList = stateRef.current.objects.filter(o => o.id !== selectedMatch.id);
          pushStateToHistory(absoluteRemainingList);
          setSelectedId(null);
          setHudFeedback("Element deleted.");
        }
      } else {
        setSelectedId(null);
      }
      return;
    }

    // Initialize Draw Sequence
    isDrawingRef.current = true;
    startPointRef.current = calculatedVectorCoords;
    currentPointRef.current = calculatedVectorCoords;

    if (tool === 'polyline') {
      if (polylinePointsRef.current.length === 0) {
        polylinePointsRef.current.push(calculatedVectorCoords);
      }
      startPointRef.current = polylinePointsRef.current[polylinePointsRef.current.length - 1];
    }
  };

  const handleEnginePointerMove = (e: PointerEvent) => {
    if (isPanningRef.current) {
      const movementDeltaX = e.clientX - panStartRef.current.x;
      const movementDeltaY = e.clientY - panStartRef.current.y;
      panStartRef.current = { x: e.clientX, y: e.clientY };

      const panMultiplier = 0.5 * cameraZoomRef.current;
      if (stateRef.current.viewMode === 'top') {
        cameraOffsetRef.current.x -= movementDeltaX * panMultiplier;
        cameraOffsetRef.current.z -= movementDeltaY * panMultiplier;
      } else {
        cameraOffsetRef.current.x -= movementDeltaX * panMultiplier;
        cameraOffsetRef.current.y += movementDeltaY * panMultiplier;
      }
      updateCameraTransformationMatrix();
      return;
    }

    if (!isDrawingRef.current || !startPointRef.current) return;

    let relativeWorkspaceCoords = calculateRaycastWorkspaceIntersection(e.clientX, e.clientY);
    if (!relativeWorkspaceCoords) return;

    if (stateRef.current.orthoMode) {
      const alignmentDifferenceX = Math.abs(relativeWorkspaceCoords.x - startPointRef.current.x);
      const alignmentDifferenceY = Math.abs(relativeWorkspaceCoords.y - startPointRef.current.y);
      if (alignmentDifferenceX > alignmentDifferenceY) {
        relativeWorkspaceCoords = { x: relativeWorkspaceCoords.x, y: startPointRef.current.y };
      } else {
        relativeWorkspaceCoords = { x: startPointRef.current.x, y: relativeWorkspaceCoords.y };
      }
    }

    currentPointRef.current = relativeWorkspaceCoords;
    const originPoint = startPointRef.current;
    const dynamicCalculatedRadiusLength = Math.round(Math.hypot(relativeWorkspaceCoords.x - originPoint.x, relativeWorkspaceCoords.y - originPoint.y));

    if (previewLineRef.current) {
      const dynamicPreviewPointsArray: THREE.Vector3[] = [];
      const tool = stateRef.current.currentTool;

      if (tool === 'line' || tool === 'polyline') {
        dynamicPreviewPointsArray.push(new THREE.Vector3(originPoint.x, 0.6, originPoint.y), new THREE.Vector3(relativeWorkspaceCoords.x, 0.6, relativeWorkspaceCoords.y));
      } else if (tool === 'rectangle') {
        dynamicPreviewPointsArray.push(
          new THREE.Vector3(originPoint.x, 0.6, originPoint.y),
          new THREE.Vector3(relativeWorkspaceCoords.x, 0.6, originPoint.y),
          new THREE.Vector3(relativeWorkspaceCoords.x, 0.6, relativeWorkspaceCoords.y),
          new THREE.Vector3(originPoint.x, 0.6, relativeWorkspaceCoords.y),
          new THREE.Vector3(originPoint.x, 0.6, originPoint.y)
        );
      } else if (tool === 'triangle') {
        for (let i = 0; i <= 3; i++) {
          const radialAngleStep = (i / 3) * Math.PI * 2;
          dynamicPreviewPointsArray.push(new THREE.Vector3(originPoint.x + Math.cos(radialAngleStep) * dynamicCalculatedRadiusLength, 0.6, originPoint.y + Math.sin(radialAngleStep) * dynamicCalculatedRadiusLength));
        }
      } else if (tool === 'circle') {
        for (let i = 0; i <= 64; i++) {
          const radialAngleStep = (i / 64) * Math.PI * 2;
          dynamicPreviewPointsArray.push(new THREE.Vector3(originPoint.x + Math.cos(radialAngleStep) * dynamicCalculatedRadiusLength, 0.6, originPoint.y + Math.sin(radialAngleStep) * dynamicCalculatedRadiusLength));
        }
      }

      previewLineRef.current.geometry.setFromPoints(dynamicPreviewPointsArray);
      if (rendererRef.current && cameraRef.current && sceneRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    }
  };

  const handleEnginePointerUp = () => {
    if (isPanningRef.current) {
      isPanningRef.current = false;
      return;
    }

    if (!isDrawingRef.current || !startPointRef.current || !currentPointRef.current) {
      isDrawingRef.current = false;
      return;
    }

    isDrawingRef.current = false;
    const originPoint = startPointRef.current;
    const endpointsMatrix = currentPointRef.current;
    const finalCalculatedUnitDimension = Math.round(Math.hypot(endpointsMatrix.x - originPoint.x, endpointsMatrix.y - originPoint.y));

    if (finalCalculatedUnitDimension < 2) return;

    let targetCreatedNode: CADObject | null = null;
    const tool = stateRef.current.currentTool;

    if (tool === 'line') {
      targetCreatedNode = {
        id: generateId(),
        type: 'line',
        points: [originPoint, endpointsMatrix],
        color: '#3b82f6',
        layer: '0',
        is3D: false,
        properties: { length: finalCalculatedUnitDimension }
      };
    } else if (tool === 'polyline') {
      polylinePointsRef.current.push(endpointsMatrix);
      const freezeImmutableArray = [...polylinePointsRef.current];
      
      setObjects((prev) => [
        ...prev.filter(o => o.id !== 'temp_pline'),
        { id: 'temp_pline', type: 'polyline', points: freezeImmutableArray, color: '#38bdf8', layer: '0', is3D: false }
      ]);
      return; 
    } else if (tool === 'rectangle') {
      targetCreatedNode = {
        id: generateId(),
        type: 'rectangle',
        points: [originPoint, { x: endpointsMatrix.x, y: originPoint.y }, endpointsMatrix, { x: originPoint.x, y: endpointsMatrix.y }],
        color: '#10b981',
        layer: '0',
        is3D: false,
        properties: { width: Math.abs(endpointsMatrix.x - originPoint.x), height: Math.abs(endpointsMatrix.y - originPoint.y) }
      };
    } else if (tool === 'triangle') {
      const localTriangleVertices: Point2D[] = [];
      for (let i = 0; i < 3; i++) {
        const thetaStep = (i / 3) * Math.PI * 2;
        localTriangleVertices.push({ x: originPoint.x + Math.cos(thetaStep) * finalCalculatedUnitDimension, y: originPoint.y + Math.sin(thetaStep) * finalCalculatedUnitDimension });
      }
      targetCreatedNode = {
        id: generateId(),
        type: 'triangle',
        points: localTriangleVertices,
        color: '#f59e0b',
        layer: '0',
        is3D: false,
        properties: { length: finalCalculatedUnitDimension }
      };
    } else if (tool === 'circle') {
      const localCircleVertices: Point2D[] = [];
      for (let i = 0; i < 64; i++) {
        const thetaStep = (i / 64) * Math.PI * 2;
        localCircleVertices.push({ x: originPoint.x + Math.cos(thetaStep) * finalCalculatedUnitDimension, y: originPoint.y + Math.sin(thetaStep) * finalCalculatedUnitDimension });
      }
      targetCreatedNode = {
        id: generateId(),
        type: 'circle',
        points: localCircleVertices,
        color: '#a855f7',
        layer: '0',
        is3D: false,
        properties: { radius: finalCalculatedUnitDimension }
      };
    }

    if (targetCreatedNode) {
      const activeStateMatrix = stateRef.current.objects.filter(o => o.id !== 'temp_pline');
      const compiledTotalTimelineState = [...activeStateMatrix, targetCreatedNode];
      pushStateToHistory(compiledTotalTimelineState);
      setSelectedId(targetCreatedNode.id);
      setHudFeedback(`Committed ${targetCreatedNode.type.toUpperCase()} | Scale: ${finalCalculatedUnitDimension}${unit}`);
    }

    startPointRef.current = null;
    currentPointRef.current = null;
    if (previewLineRef.current) {
      previewLineRef.current.geometry.setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    }
  };

  const closePolylineNodeSequence = () => {
    if (polylinePointsRef.current.length < 2) return;
    const committedPolylineNode: CADObject = {
      id: generateId(),
      type: 'polyline',
      points: [...polylinePointsRef.current],
      color: '#06b6d4',
      layer: '0',
      is3D: false
    };
    const pureStateListWithoutTemp = stateRef.current.objects.filter(o => o.id !== 'temp_pline');
    pushStateToHistory([...pureStateListWithoutTemp, committedPolylineNode]);
    polylinePointsRef.current = [];
    setHudFeedback("Polyline geometry structure pinned down successfully.");
  };

  // --- MODIFIERS RUNTIME ENGINE ---
  const applyExtrusionLogicToNode = () => {
    if (!selectedId) return alert('Tap and highlight a drawing element first.');
    const depthStr = prompt("Specify absolute extrusion height (mm):", "60");
    if (!depthStr) return;
    const computedNumericalDepthValue = parseFloat(depthStr) || 60;

    const modifiedTimelineObjectsList = objects.map(obj => 
      obj.id === selectedId ? { ...obj, is3D: true, extrusionHeight: computedNumericalDepthValue } : obj
    );
    pushStateToHistory(modifiedTimelineObjectsList);
    setViewMode('isometric');
    setHudFeedback(`Node modified to 3D Extrusion Depth: ${computedNumericalDepthValue}mm`);
  };

  const triggerDynamicFilletEdge = () => {
    if (!selectedId) return alert('Highlight an element first.');
    const radiusDimensionInput = prompt("Enter Fillet Arc Radius:", "15");
    if (!radiusDimensionInput) return;
    setHudFeedback(`Simulated radial curve fillet at edge matching: ${radiusDimensionInput}mm`);
  };

  const triggerDynamicChamferEdge = () => {
    if (!selectedId) return alert('Highlight an element first.');
    const flatCutDimensionInput = prompt("Enter Chamfer Bevel Dimension:", "12");
    if (!flatCutDimensionInput) return;
    setHudFeedback(`Simulated planar bevel edge cut chamfer matching: ${flatCutDimensionInput}mm`);
  };

  const clearCanvasGridWorkspace = () => {
    if (window.confirm("Initialize clean working environment blueprint?")) {
      setObjects([]);
      setSelectedId(null);
      polylinePointsRef.current = [];
      setHistory([[]]);
      setHistoryIndex(0);
      setHudFeedback("AutoCAD active working matrix cleared clean.");
    }
  };

  const downloadSessionJSONDataBlueprint = () => {
    const rawJSONSerializationStreamString = JSON.stringify(objects, null, 2);
    const targetFileBlobContainer = new Blob([rawJSONSerializationStreamString], { type: 'application/json' });
    const localVirtualAnchorElement = document.createElement('a');
    localVirtualAnchorElement.download = `cad_blueprint_export_${Date.now()}.json`;
    localVirtualAnchorElement.href = URL.createObjectURL(targetFileBlobContainer);
    localVirtualAnchorElement.click();
    setHudFeedback("Project JSON blueprint package database saved safely.");
  };

  const executePDFVectorOutputPrintJob = () => {
    setHudFeedback("Preparing print canvas spool...");
    setTimeout(() => {
      window.print();
      setHudFeedback("PDF rendering completed successfully.");
    }, 400);
  };

  // --- COMPONENT PIPELINE LIFE INITIALIZER ---
  useEffect(() => {
    if (!containerRef.current) return;
    const computedWidth = containerRef.current.clientWidth || window.innerWidth;
    const computedHeight = containerRef.current.clientHeight || (window.innerHeight - 56);

    const graphicsEngineRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
    graphicsEngineRenderer.setSize(computedWidth, computedHeight);
    graphicsEngineRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    containerRef.current.innerHTML = '';
    containerRef.current.appendChild(graphicsEngineRenderer.domElement);
    rendererRef.current = graphicsEngineRenderer;

    const standardSceneGraphInstance = new THREE.Scene();
    standardSceneGraphInstance.background = new THREE.Color(0x060a13); 
    sceneRef.current = standardSceneGraphInstance;

    const systemPerspectiveCameraInstance = new THREE.PerspectiveCamera(45, computedWidth / computedHeight, 1, 10000);
    cameraRef.current = systemPerspectiveCameraInstance;

    standardSceneGraphInstance.add(new THREE.AmbientLight(0xffffff, 0.95));
    const structuralDirectionalSunlightNode = new THREE.DirectionalLight(0xffffff, 0.55);
    structuralDirectionalSunlightNode.position.set(300, 600, 300);
    standardSceneGraphInstance.add(structuralDirectionalSunlightNode);

    const calculationsDivisionsMetric = Math.round(workspaceSize / gridSpacing);
    const computationalGridMeshHelper = new THREE.GridHelper(workspaceSize, calculationsDivisionsMetric, 0x4f46e5, 0x111827);
    standardSceneGraphInstance.add(computationalGridMeshHelper);

    const activePreviewLineMaterialNode = new THREE.LineBasicMaterial({ color: 0xf43f5e, linewidth: 3, depthTest: false });
    const realTimePreviewLineGeometryReference = new THREE.Line(new THREE.BufferGeometry(), activePreviewLineMaterialNode);
    realTimePreviewLineGeometryReference.renderOrder = 2000;
    standardSceneGraphInstance.add(realTimePreviewLineGeometryReference);
    previewLineRef.current = realTimePreviewLineGeometryReference;

    const interceptorTargetElementHost = containerRef.current;
    interceptorTargetElementHost.addEventListener('pointerdown', handleEnginePointerDown);
    interceptorTargetElementHost.addEventListener('pointermove', handleEnginePointerMove);
    window.addEventListener('pointerup', handleEnginePointerUp);

    const handleWindowViewportResizeEvent = () => {
      if (!containerRef.current || !cameraRef.current || !rendererRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
      rendererRef.current.render(sceneRef.current!, cameraRef.current);
    };
    window.addEventListener('resize', handleWindowViewportResizeEvent);

    updateCameraTransformationMatrix();

    return () => {
      interceptorTargetElementHost.removeEventListener('pointerdown', handleEnginePointerDown);
      interceptorTargetElementHost.removeEventListener('pointermove', handleEnginePointerMove);
      window.removeEventListener('pointerup', handleEnginePointerUp);
      window.removeEventListener('resize', handleWindowViewportResizeEvent);
      graphicsEngineRenderer.dispose();
    };
  }, []);

  // --- SEPARATION SYNC RE-RENDER RE-DRAW SEQUENCER ---
  useEffect(() => {
    if (!sceneRef.current || !rendererRef.current || !cameraRef.current) return;
    
    visualObjectsMapRef.current.forEach(item => sceneRef.current?.remove(item));
    visualObjectsMapRef.current.clear();

    objects.forEach((dataNode) => {
      if (!dataNode || !dataNode.points) return;
      const isTargetHighlighted = dataNode.id === selectedId;
      const computationalHexColorToken = isTargetHighlighted ? 0xf43f5e : new THREE.Color(dataNode.color || '#3b82f6').getHex();
      const unifiedNodeGeometricGroup = new THREE.Group();

      if (dataNode.is3D && dataNode.extrusionHeight) {
        const customPolygonalShape = new THREE.Shape();
        if (dataNode.points.length > 1) {
          customPolygonalShape.moveTo(dataNode.points[0].x, dataNode.points[0].y);
          for (let i = 1; i < dataNode.points.length; i++) {
            customPolygonalShape.lineTo(dataNode.points[i].x, dataNode.points[i].y);
          }
          if (dataNode.type !== 'line') {
            customPolygonalShape.lineTo(dataNode.points[0].x, dataNode.points[0].y);
          }

          const processingExtrudeMeshGeometry = new THREE.ExtrudeGeometry(customPolygonalShape, { depth: dataNode.extrusionHeight, bevelEnabled: false });
          processingExtrudeMeshGeometry.rotateX(-Math.PI / 2);
          const structuralShaderMaterialContainer = new THREE.MeshStandardMaterial({ color: computationalHexColorToken, roughness: 0.25, side: THREE.DoubleSide });
          const mechanicalSolidStructuralMesh = new THREE.Mesh(processingExtrudeMeshGeometry, structuralShaderMaterialContainer);
          unifiedNodeGeometricGroup.add(mechanicalSolidStructuralMesh);
        }
      } else {
        const structuralPositionVectorsTimelineList: THREE.Vector3[] = [];
        dataNode.points.forEach(pt => pt && structuralPositionVectorsTimelineList.push(new THREE.Vector3(pt.x, 0.5, pt.y)));

        if (dataNode.type !== 'line' && dataNode.type !== 'polyline' && structuralPositionVectorsTimelineList.length > 0) {
          structuralPositionVectorsTimelineList.push(structuralPositionVectorsTimelineList[0].clone());
        }

        if (structuralPositionVectorsTimelineList.length > 0) {
          const targetedBufferGeometryAllocationNode = new THREE.BufferGeometry().setFromPoints(structuralPositionVectorsTimelineList);
          const dynamicOutlinedWireframeLineMesh = new THREE.Line(targetedBufferGeometryAllocationNode, new THREE.LineBasicMaterial({ color: computationalHexColorToken, linewidth: 3, depthTest: false }));
          dynamicOutlinedWireframeLineMesh.renderOrder = 100;
          unifiedNodeGeometricGroup.add(dynamicOutlinedWireframeLineMesh);
        }

        // TEXT OVERLAY LAYER
        if (dataNode.points.length >= 2) {
          const p1 = dataNode.points[0];
          const p2 = dataNode.points[dataNode.points.length - 1];
          let textualMeasurementString = `${Math.round(Math.hypot(p2.x - p1.x, p2.y - p1.y))}${unit}`;
          
          if (dataNode.type === 'circle' && dataNode.properties?.radius) {
            textualMeasurementString = `R:${dataNode.properties.radius}${unit}`;
          }

          const dynamicLabelCanvasElement = document.createElement('canvas');
          dynamicLabelCanvasElement.width = 160; dynamicLabelCanvasElement.height = 64;
          const processingCanvasContext2D = dynamicLabelCanvasElement.getContext('2d');
          if (processingCanvasContext2D) {
            processingCanvasContext2D.fillStyle = '#f59e0b';
            processingCanvasContext2D.font = 'bold 22px monospace';
            processingCanvasContext2D.fillText(textualMeasurementString, 12, 36);
            
            const dynamicLabelTextureReferenceInstance = new THREE.CanvasTexture(dynamicLabelCanvasElement);
            const geometricLabelSpriteMeshNode = new THREE.Sprite(new THREE.SpriteMaterial({ map: dynamicLabelTextureReferenceInstance, depthTest: false }));
            geometricLabelSpriteMeshNode.position.set((p1.x + p2.x) / 2, 6, (p1.y + p2.y) / 2);
            geometricLabelSpriteMeshNode.scale.set(22, 11, 1);
            unifiedNodeGeometricGroup.add(geometricLabelSpriteMeshNode);
          }
        }
      }

      sceneRef.current!.add(unifiedNodeGeometricGroup);
      visualObjectsMapRef.current.set(dataNode.id, unifiedNodeGeometricGroup);
    });

    rendererRef.current.render(sceneRef.current, cameraRef.current);
  }, [objects, selectedId]);

  return (
    <div className="fixed inset-0 w-screen h-screen flex flex-col font-sans overflow-hidden select-none bg-slate-950 text-slate-100">
      
      {/* ACTION ROW HEADER CONFIGURATION BAR */}
      <header className="h-14 px-4 flex items-center justify-between border-b shrink-0 z-20 bg-slate-900 border-slate-800">
        <div className="flex items-center gap-2">
          <span className="text-xs font-black tracking-widest text-indigo-400 uppercase">Engine_CAD Native App</span>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto max-w-xl">
          <button onClick={clearCanvasGridWorkspace} className="p-1 px-2 rounded bg-slate-950 text-[10px] font-bold border border-slate-800">NEW</button>
          <button onClick={downloadSessionJSONDataBlueprint} className="p-1 px-2 rounded bg-slate-950 text-[10px] font-bold border border-slate-800 text-sky-400">SAVE AS</button>
          <button onClick={executePDFVectorOutputPrintJob} className="p-1 px-2 rounded bg-emerald-600 text-[10px] font-bold text-white shadow">EXPORT PDF</button>
          <button onClick={runUndoCycle} className="p-1 px-2 rounded bg-slate-800 text-[10px] font-bold">⤺ UNDO</button>
          <button onClick={runRedoCycle} className="p-1 px-2 rounded bg-slate-800 text-[10px] font-bold">⤻ REDO</button>
          
          <label className="flex items-center gap-1 text-[10px] font-bold cursor-pointer bg-slate-950 px-2 py-1 rounded border border-slate-800">
            <input type="checkbox" checked={snapToGrid} onChange={(e) => setSnapToGrid(e.target.checked)} className="accent-indigo-500" />
            SNAP
          </label>
          <label className="flex items-center gap-1 text-[10px] font-bold cursor-pointer bg-slate-950 px-2 py-1 rounded border border-slate-800">
            <input type="checkbox" checked={orthoMode} onChange={(e) => setOrthoMode(e.target.checked)} className="accent-indigo-500" />
            ORTHO
          </label>
        </div>
      </header>

      {/* THREE.JS WORKSPACE CANVAS WRAPPER INTERFACE VIEWPORT */}
      <div className="flex-1 flex flex-col md:flex-row relative w-full h-full min-h-0 overflow-hidden">
        
        {/* Absolute injection zone ensuring 100% viewport dimensions bounds protection */}
        <main ref={containerRef} className="absolute inset-0 md:relative flex-1 w-full h-full min-h-0 bg-slate-950 touch-none z-0" style={{ minWidth: '0' }} />

        {/* CONTROLS MATRIX PANEL DRAWER */}
        <aside className="absolute bottom-16 left-0 right-0 md:relative md:bottom-auto md:left-auto md:right-auto w-full md:w-64 p-3 flex flex-row md:flex-col gap-4 border-t md:border-t-0 md:border-l overflow-x-auto md:overflow-y-auto shrink-0 z-10 bg-slate-900/95 border-slate-800 backdrop-blur-sm">
          
          <div className="min-w-[170px] md:min-w-0">
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Vector Core Primitives</h3>
            <div className="grid grid-cols-2 gap-1">
              {(['select', 'pan', 'move', 'copy', 'erase', 'line', 'polyline', 'rectangle', 'triangle', 'circle'] as ToolType[]).map((tool) => (
                <button
                  key={tool}
                  onClick={() => {
                    if (tool !== 'polyline') {
                      polylinePointsRef.current = [];
                      setObjects(prev => prev.filter(o => o.id !== 'temp_pline'));
                    }
                    setCurrentTool(tool);
                  }}
                  className={`py-1 px-2 text-left rounded capitalize text-[10px] font-bold border ${
                    currentTool === tool ? 'bg-indigo-600 border-indigo-500 text-white shadow' : 'bg-slate-950 border-slate-800 text-slate-300'
                  }`}
                >
                  {tool}
                </button>
              ))}
              {currentTool === 'polyline' && (
                <button onClick={closePolylineNodeSequence} className="col-span-2 py-1 px-2 rounded bg-cyan-700 hover:bg-cyan-600 text-[10px] font-black text-white text-center border border-cyan-500">
                  ✓ Close Polyline Path
                </button>
              )}
            </div>
          </div>

          <div className="min-w-[130px] md:min-w-0 flex flex-col gap-1 border-l md:border-l-0 md:border-t pl-3 md:pl-0 md:pt-2 border-slate-800">
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Calculated Modifiers</h3>
            <div className="grid grid-cols-1 gap-1">
              <button onClick={applyExtrusionLogicToNode} className="py-1 px-2 text-left rounded text-[10px] font-bold bg-indigo-950 text-indigo-300 border border-indigo-800">⬔ Extrude 3D Node</button>
              <button onClick={triggerDynamicFilletEdge} className="py-1 px-2 text-left rounded text-[10px] font-bold bg-slate-950 border border-slate-800 text-slate-300">⤷ Curve Fillet</button>
              <button onClick={triggerDynamicChamferEdge} className="py-1 px-2 text-left rounded text-[10px] font-bold bg-slate-950 border border-slate-800 text-slate-300">⧌ Flat Chamfer</button>
            </div>
          </div>

          <div className="min-w-[120px] md:min-w-0 border-l md:border-l-0 md:border-t pl-3 md:pl-0 md:pt-2 border-slate-800">
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Projection Formats</h3>
            <div className="grid grid-cols-2 gap-1">
              {(['top', 'front', 'side', 'isometric'] as ViewMode[]).map((view) => (
                <button
                  key={view}
                  onClick={() => setViewMode(view)}
                  className={`py-1 px-1 text-center rounded capitalize text-[10px] font-bold border ${
                    viewMode === view ? 'bg-amber-600 border-amber-500 text-white shadow' : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  {view}
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* STATUS BAR FOOTER WINDOW CONTROLLER */}
        <footer className="absolute bottom-2 left-2 right-2 px-3 py-1.5 rounded border flex items-center justify-between backdrop-blur shadow-2xl z-20 bg-slate-900/95 border-slate-800 text-emerald-400">
          <div className="flex items-center gap-2 font-mono text-[10px]">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="truncate max-w-[180px] sm:max-w-xs">{hudFeedback}</span>
          </div>
          <div className="font-mono text-[9px] text-slate-500 flex gap-2 shrink-0">
            <span>TOOL: {currentTool.toUpperCase()}</span>
            <span>|</span>
            <span>NODES: {objects.length}</span>
          </div>
        </footer>

      </div>
    </div>
  );
}
