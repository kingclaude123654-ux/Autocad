import React from 'react';
import { ToolType } from '../types/cad';

interface LeftPanelProps {
  currentTool: ToolType;
  onSelectTool: (tool: ToolType) => void;
  onTrim: () => void;
  onFillet: () => void;
  onUnion: () => void;
}

export const LeftPanel: React.FC<LeftPanelProps> = ({ currentTool, onSelectTool, onTrim, onFillet, onUnion }) => {
  const drawTools = [
    { id: 'select', label: 'SELECT' },
    { id: 'deselect', label: 'DESELECT' },
    { id: 'line', label: 'LINE' },
    { id: 'rectangle', label: 'RECT' },
    { id: 'circle', label: 'CIRCLE' },
    { id: 'polygon', label: 'TRIANGLE' },
  ];

  const modTools = [
    { id: 'trim', label: '✂️ TRIM', action: onTrim },
    { id: 'fillet', label: '📐 FILLET', action: onFillet },
    { id: 'union', label: '🔲 UNION', action: onUnion },
  ];

  return (
    <div style={{ width: '100%', padding: '8px', background: '#111827', borderTop: '2px solid #374151', display: 'flex', flexDirection: 'column', gap: '6px' }}>
      
      {/* 2D Drafting Tools Row */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
        {drawTools.map((t) => {
          const isSel = currentTool === t.id;
          return (
            <button key={t.id} onClick={() => onSelectTool(t.id as ToolType)} style={{ flex: 1, minWidth: '75px', padding: '8px 4px', fontSize: '11px', fontWeight: 'bold', borderRadius: '4px', border: 'none', backgroundColor: isSel ? '#2563eb' : '#374151', color: '#fff' }}>
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Advanced 3D Operations Toolkits Row */}
      <div style={{ display: 'flex', gap: '4px' }}>
        {modTools.map((t) => (
          <button key={t.id} onClick={t.action} style={{ flex: 1, padding: '8px 2px', fontSize: '11px', fontWeight: 'bold', borderRadius: '4px', border: 'none', backgroundColor: '#b45309', color: '#fff' }}>
            {t.label}
          </button>
        ))}
      </div>

    </div>
  );
};
