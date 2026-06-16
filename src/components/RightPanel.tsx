import React, { useState } from 'react';
import { CADObject } from '../types/cad';

interface RightPanelProps {
  selectedObject: CADObject | null;
  onExtrude: (id: string, depth: number) => void;
  onUpdateColor: (id: string, color: string) => void;
}

export const RightPanel: React.FC<RightPanelProps> = ({ selectedObject, onExtrude }) => {
  const [h, setH] = useState<string>('20');

  return (
    <div style={{ padding: '8px', color: '#fff', fontSize: '11px', display: 'flex', flexDirection: 'column', gap: '10px', height: '100%' }}>
      <div style={{ fontWeight: 'bold', borderBottom: '1px solid #475569', paddingBottom: '4px', color: '#94a3b8' }}>INSPECTOR</div>

      {!selectedObject ? (
        <span style={{ color: '#64748b', fontSize: '10px' }}>Tap SELECT tool, then select an object on the grid to open modifications matrix.</span>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div>Type: <strong style={{ color: '#38bdf8' }}>{selectedObject.type.toUpperCase()}</strong></div>
          <div>Space: <span>{selectedObject.is3D ? '3D Block' : '2D Plane'}</span></div>
          
          {!selectedObject.is3D && (
            <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px', borderTop: '1px solid #334155', paddingTop: '8px' }}>
              <label style={{ fontSize: '9px', color: '#94a3b8' }}>EXTRUDE HEIGHT:</label>
              <input type="number" value={h} onChange={(e) => setH(e.target.value)} style={{ width: '100%', padding: '4px', background: '#0f172a', border: '1px solid #475569', color: '#fff', borderRadius: '4px' }} />
              <button onClick={() => onExtrude(selectedObject.id, parseFloat(h) || 15)} style={{ width: '100%', padding: '6px', backgroundColor: '#16a34a', color: '#fff', border: 'none', fontWeight: 'bold', borderRadius: '4px', marginTop: '2px' }}>BUILD 3D</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
