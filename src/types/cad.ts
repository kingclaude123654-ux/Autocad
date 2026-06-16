export type ToolType = 'select' | 'line' | 'rectangle' | 'circle' | 'arc' | 'polygon' | 'polyline' | 'move' | 'copy' | 'rotate' | 'scale' | 'delete' | 'extrude' | 'union' | 'fillet';
export type ViewMode = 'top' | 'front' | 'side' | 'isometric';

export interface Point2D {
  x: number;
  y: number;
}

export interface CADObject {
  id: string;
  type: 'line' | 'rectangle' | 'circle' | 'arc' | 'polygon' | 'polyline' | 'mesh';
  points: Point2D[];
  color: string;
  layer: string;
  is3D: boolean;
  extrusionHeight?: number;
  threeMeshId?: string;
  properties: {
    radius?: number;
    width?: number;
    height?: number;
    sides?: number;
  };
}

export interface SnapConfig {
  grid: boolean;
  endpoint: boolean;
  midpoint: boolean;
  center: boolean;
}
