export type ToolType = 'select' | 'line' | 'rectangle' | 'circle' | 'polygon' | 'delete' | 'extrude' | 'union' | 'fillet' | 'trim' | 'deselect';
export type ViewMode = 'top' | 'front' | 'side' | 'isometric';

export interface Point2D {
  x: number;
  y: number;
}

export interface CADObject {
  id: string;
  type: 'line' | 'rectangle' | 'circle' | 'polygon' | 'mesh';
  points: Point2D[];
  color: string;
  layer: string;
  is3D: boolean;
  extrusionHeight?: number;
  properties: {
    radius?: number;
    width?: number;
    height?: number;
    sides?: number;
    length?: number;
  };
}
