import React from 'react';
import { MousePointer, Move, Copy, RotateCw, Maximize, Trash2, Box, Square, Circle, Milestone, Triangle } from 'lucide-react';
import { ToolType } from '../types/cad';

interface LeftPanelProps {
  currentTool: ToolType;
  onSelectTool: (tool: ToolType) => void;
}

export const LeftPanel: React.FC<LeftPanelProps> = ({ currentTool, onSelectTool }) => {
  const tools = [
    { id: 'select', label: 'Select Object', icon: MousePointer, section: 'navigate' },
    { id: 'line', label: 'Draw Line', icon: Milestone, section: 'draw' },
    { id: 'rectangle', label: 'Draw Rect', icon: Square, section: 'draw' },
    { id: 'circle', label: 'Draw Circle', icon: Circle, section: 'draw' },
    { id: 'polygon', label: 'Draw Polygon', icon: Triangle, section: 'draw' },
    { id: 'move', label: 'Transform Move', icon: Move, section: 'modify' },
    { id: 'copy', label: 'Duplicate Copy', icon: Copy, section: 'modify' },
    { id: 'rotate', label: 'Rotate Mesh', icon: RotateCw, section: 'modify' },
    { id: 'scale', label: 'Scale Object', icon: Maximize, section: 'modify' },
    { id: 'extrude', label: 'Extrude to 3D', icon: Box, section: '3D modeling' },
    { id: 'delete', label: 'Delete Entity', icon: Trash2, section: 'danger' },
  ];

  return (
    <aside className="w-16 md:w-56 border-r bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 flex flex-col p-2 space-y-4 overflow-y-auto select-none">
      <div>
        <h3 className="hidden md:block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider px-2 mb-2">CAD Toolkits</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
          {tools.map((tool) => {
            const IconComponent = tool.icon;
            const isSelected = currentTool === tool.id;
            return (
              <button
                key={tool.id}
                onClick={() => onSelectTool(tool.id as ToolType)}
                className={`flex flex-col md:flex-row items-center md:space-x-3 p-2 rounded-lg transition-all text-center md:text-left ${
                  isSelected 
                    ? 'bg-blue-500 text-white shadow-md shadow-blue-500/20' 
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
                title={tool.label}
              >
                <IconComponent size={20} className="flex-shrink-0" />
                <span className="hidden md:inline text-xs font-medium">{tool.label.split(' ')[1] || tool.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
};
