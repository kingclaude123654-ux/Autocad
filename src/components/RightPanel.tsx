import React, { useState } from 'react';
import { Sliders, Settings2, Code, ShieldCheck } from 'lucide-react';
import { CADObject } from '../types/cad';

interface RightPanelProps {
  selectedObject: CADObject | null;
  onExtrude: (id: string, depth: number) => void;
  onUpdateColor: (id: string, color: string) => void;
}

export const RightPanel: React.FC<RightPanelProps> = ({ selectedObject, onExtrude, onUpdateColor }) => {
  const [extrudeInput, setExtrudeInput] = useState<string>('10');

  return (
    <aside className="w-64 border-l bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 flex flex-col p-4 space-y-6 overflow-y-auto z-10">
      <div className="flex items-center space-x-2 border-b border-slate-100 dark:border-slate-800 pb-3">
        <Sliders size={18} className="text-blue-500" />
        <h3 className="font-semibold text-sm tracking-wide">Inspector Matrix</h3>
      </div>

      {!selectedObject ? (
        <div className="flex flex-col items-center justify-center h-48 text-center text-slate-400 dark:text-slate-500 px-2 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
          <Settings2 size={24} className="mb-2 opacity-60 animate-pulse" />
          <p className="text-xs">Tap or click any working item to parse properties geometry metadata</p>
        </div>
      ) : (
        <div className="space-y-5 text-sm">
          <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
            <div className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Entity Description</div>
            <div className="flex justify-between py-1"><span className="text-slate-500">ID Block</span><span className="font-mono text-xs max-w-[120px] truncate">{selectedObject.id}</span></div>
            <div className="flex justify-between py-1"><span className="text-slate-500">Primitive</span><span className="capitalize font-medium text-blue-500">{selectedObject.type}</span></div>
            <div className="flex justify-between py-1"><span className="text-slate-500">Dimensions</span><span className="font-medium">{selectedObject.is3D ? '3D Matrix Space' : '2D Local Plane'}</span></div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Layer Color Scheme</label>
            <div className="flex items-center space-x-2">
              <input 
                type="color" 
                value={selectedObject.color || '#3b82f6'} 
                onChange={(e) => onUpdateColor(selectedObject.id, e.target.value)}
                className="w-8 h-8 rounded border-0 cursor-pointer bg-transparent"
              />
              <span className="font-mono text-xs uppercase">{selectedObject.color || '#3b82f6'}</span>
            </div>
          </div>

          {!selectedObject.is3D && (
            <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
              <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">3D Linear Extrusion</label>
              <div className="flex space-x-2">
                <input
                  type="number"
                  value={extrudeInput}
                  onChange={(e) => setExtrudeInput(e.target.value)}
                  placeholder="Height"
                  className="w-full px-3 py-1.5 rounded-lg border bg-transparent border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm"
                />
                <button
                  onClick={() => onExtrude(selectedObject.id, parseFloat(extrudeInput) || 10)}
                  className="px-4 py-1.5 bg-blue-500 hover:bg-blue-600 text-white font-medium text-xs rounded-lg shadow-sm transition-colors duration-150"
                >
                  Apply
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="mt-auto bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/50 p-3 rounded-xl flex items-start space-x-3">
        <ShieldCheck className="text-blue-500 flex-shrink-0 mt-0.5" size={16} />
        <div className="text-[11px] leading-relaxed text-blue-700 dark:text-blue-400">
          <strong>Mobile Optimized:</strong> Use a single finger drag to paint shapes, and two fingers to zoom or pan.
        </div>
      </div>
    </aside>
  );
};
