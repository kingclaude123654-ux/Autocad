import React from 'react';
import { ToolType } from '../types/cad';

interface LeftPanelProps {
  currentTool: ToolType;
  onSelectTool: (tool: ToolType) => void;
}

export const LeftPanel: React.FC<LeftPanelProps> = ({ currentTool, onSelectTool }) => {
  const tools = [
    { id: 'select', label: 'Select' },
    { id: 'line', label: 'Line' },
    { id: 'rectangle', label: 'Rect' },
    { id: 'circle', label: 'Circle' },
    { id: 'polygon', label: 'Poly' },
    { id: 'delete', label: 'Delete' },
  ];

  return (
    <div style={{ width: '100%', padding: '6px', display: 'flex', flexWrap: 'wrap', gap: '6px', background: '#1e293b', borderBottom: '2px solid #334155' }}>
      {tools.map((tool) => {
        const isSelected = currentTool === tool.id;
        return (
          <button
            key={tool.id}
            onClick={(e) => {
              e.stopPropagation();
              onSelectTool(tool.id as ToolType);
            }}
            style={{
              padding: '10px 14px',
              fontSize: '13px',
              fontWeight: 'bold',
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              backgroundColor: isSelected ? '#3b82f6' : '#475569',
              color: '#ffffff',
              boxShadow: isSelected ? '0px 0px 8px #3b82f6' : 'none'
            }}
          >
            {tool.label.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
};
