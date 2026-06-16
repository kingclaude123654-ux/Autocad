import React from 'react';
import { Undo2, Redo2, Download, Sun, Moon, Maximize2, Minimize2, Grid, Layers } from 'lucide-react';
import { ViewMode } from '../types/cad';

interface TopToolbarProps {
  viewMode: ViewMode;
  onViewChange: (mode: ViewMode) => void;
  isDarkMode: boolean;
  onToggleTheme: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onExportPNG: () => void;
}

export const TopToolbar: React.FC<TopToolbarProps> = ({
  viewMode,
  onViewChange,
  isDarkMode,
  onToggleTheme,
  onUndo,
  onRedo,
  onExportPNG
}) => {
  return (
    <header className="h-14 border-b bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 z-10 shadow-sm">
      <div className="flex items-center space-x-2">
        <Layers className="h-6 w-6 text-blue-500" />
        <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-blue-500 to-indigo-500 bg-clip-text text-transparent">MiniCAD Pro 3D</span>
      </div>

      <div className="flex items-center space-x-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
        {(['top', 'front', 'side', 'isometric'] as ViewMode[]).map((mode) => (
          <button
            key={mode}
            onClick={() => onViewChange(mode)}
            className={`px-3 py-1 capitalize text-xs font-medium rounded-md transition-all duration-150 ${
              viewMode === mode
                ? 'bg-white dark:bg-slate-700 shadow text-blue-600 dark:text-blue-400'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            {mode}
          </button>
        ))}
      </div>

      <div className="flex items-center space-x-2">
        <button onClick={onUndo} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400" title="Undo">
          <Undo2 size={18} />
        </button>
        <button onClick={onRedo} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400" title="Redo">
          <Redo2 size={18} />
        </button>
        <button onClick={onExportPNG} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400" title="Snapshot Layout">
          <Download size={18} />
        </button>
        <div className="h-5 w-[1px] bg-slate-200 dark:bg-slate-700 mx-1" />
        <button onClick={onToggleTheme} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400">
          {isDarkMode ? <Sun size={18} className="text-amber-400" /> : <Moon size={18} />}
        </button>
      </div>
    </header>
  );
};
