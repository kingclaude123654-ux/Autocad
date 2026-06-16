import React from 'react';
import { useCADEngine } from './hooks/useCADEngine';
import { ToolType, ViewMode } from './types/cad';

export default function App() {
  const {
    containerRef,
    currentTool,
    setCurrentTool,
    viewMode,
    changeView,
    isDarkMode,
    setIsDarkMode,
    hudFeedback,
    executeNewProject,
    executeSaveProject,
    executeLoadProject,
    executeExtrude,
    executeErase,
    executeTrim,
    executeFillet,
    executeUnion,
    undo,
    redo
  } = useCADEngine();

  return (
    <div className={`flex flex-col h-screen w-screen overflow-hidden ${isDarkMode ? 'bg-slate-900 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      
      {/* HEADER / FILE CONTROL PANEL */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-slate-700 bg-slate-800 shadow-md z-10">
        <div className="flex items-center space-x-2">
          <span className="font-bold text-lg tracking-wide text-indigo-400">MiniCAD Pro 3D</span>
        </div>
        
        {/* File persistence actions */}
        <div className="flex items-center space-x-2">
          <button onClick={executeNewProject} className="px-3 py-1 bg-sky-600 hover:bg-sky-500 rounded text-xs font-semibold shadow transition-all">
            📄 New Project
          </button>
          <button onClick={executeSaveProject} className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 rounded text-xs font-semibold shadow transition-all">
            💾 Save As
          </button>
          <button onClick={executeLoadProject} className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 rounded text-xs font-semibold shadow transition-all">
            📂 Open Old File
          </button>
        </div>

        {/* View mode toggle matrix */}
        <div className="flex bg-slate-700 rounded p-1 space-x-1 text-xs">
          {(['top', 'front', 'side', 'isometric'] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => changeView(mode)}
              className={`px-2 py-1 rounded transition-all capitalize ${viewMode === mode ? 'bg-indigo-500 text-white font-bold shadow' : 'hover:bg-slate-600 text-slate-300'}`}
            >
              {mode}
            </button>
          ))}
        </div>
      </header>

      {/* QUICK COMMAND ACTION & HISTORY CONTROL LAYER */}
      <section className="flex items-center justify-between px-4 py-2 bg-slate-800/90 border-b border-slate-700/50 z-10 text-xs">
        <div className="flex items-center space-x-4">
          <button onClick={undo} className="px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-slate-200 transition-all font-medium">
            ↩️ Undo Step
          </button>
          <button onClick={redo} className="px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-slate-200 transition-all font-medium">
            ↪️ Redo Step
          </button>
        </div>

        {/* Real-time Engineering HUD console output feedback */}
        <div className="font-mono text-amber-400 bg-slate-950 px-3 py-1 rounded border border-slate-800 shadow-inner max-w-md truncate">
          {hudFeedback}
        </div>

        <div>
          <button 
            onClick={() => setIsDarkMode(!isDarkMode)} 
            className="px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-slate-300"
          >
            {isDarkMode ? '☀️ Light' : '🌙 Dark'}
          </button>
        </div>
      </section>

      {/* MAIN ENGINE DRAWING MATRIX CONTAINER GRID */}
      <main className="flex-1 relative w-full h-full bg-slate-950">
        {/* ThreeJS WebGL view viewport viewport container */}
        <div ref={containerRef} className="absolute inset-0 w-full h-full touch-none cursor-crosshair" />

        {/* CAD PRIMITIVE FLUTTER TOOLKITS FLOOR OVERLAY */}
        <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 bg-slate-900/95 border border-slate-700 rounded-xl p-3 shadow-2xl flex flex-col space-y-3 z-10 max-w-2xl w-11/12 backdrop-blur-md">
          <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
            <span className="text-xs font-bold text-slate-400 tracking-wider uppercase">Active CAD Engine Toolkits</span>
            <span className="text-[10px] bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded-full border border-indigo-500/30 font-mono">
              Mode: {currentTool.toUpperCase()}
            </span>
          </div>

          {/* Core Shape Drawing Tools row */}
          <div className="grid grid-cols-5 gap-2">
            {(['select', 'line', 'rectangle', 'circle', 'polygon'] as ToolType[]).map((tool) => (
              <button
                key={tool}
                onClick={() => setCurrentTool(tool)}
                className={`py-2 rounded-lg font-medium text-xs shadow-md border transition-all ${
                  currentTool === tool
                    ? 'bg-indigo-600 text-white border-indigo-400 font-bold scale-[1.02]'
                    : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700 hover:text-white'
                }`}
              >
                {tool === 'select' ? '🎯 Select Profile' : tool === 'polygon' ? '🔺 Triangle' : `✏️ ${tool.toUpperCase()}`}
              </button>
            ))}
          </div>

          {/* ADVANCED MULTI-LAYER GEOMETRIC ACTION MUTATIONS */}
          <div className="grid grid-cols-5 gap-2 pt-1 border-t border-slate-800/50 text-xs">
            <button onClick={() => setCurrentTool('pan' as any)} className={`py-1.5 rounded bg-slate-800 border border-slate-700 font-medium ${currentTool as any === 'pan' ? 'bg-amber-600 text-white border-amber-400 font-bold' : 'hover:bg-slate-700'}`}>
              🖐️ Pan Grid
            </button>
            <button onClick={() => executeExtrude(null, 50)} className="py-1.5 rounded bg-fuchsia-900/80 hover:bg-fuchsia-800 text-fuchsia-100 border border-fuchsia-700 font-medium transition-all shadow-sm">
              📦 Extrude 3D
            </button>
            <button onClick={executeTrim} className="py-1.5 rounded bg-orange-950/80 hover:bg-orange-900 text-orange-200 border border-orange-800 font-medium transition-all shadow-sm">
              ✂️ Trim Segment
            </button>
            <button onClick={executeFillet} className="py-1.5 rounded bg-pink-950/80 hover:bg-pink-900 text-pink-200 border border-pink-800 font-medium transition-all shadow-sm">
              📐 Apply Fillet
            </button>
            <button onClick={executeUnion} className="py-1.5 rounded bg-teal-950/80 hover:bg-teal-900 text-teal-200 border border-teal-800 font-medium transition-all shadow-sm">
              🔲 Solid Union
            </button>
          </div>

          {/* IMMEDIATE CONTEXT SELECTION ACTIONS BLOCK */}
          <div className="flex justify-end pt-1">
            <button onClick={executeErase} className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded text-xs transition-all shadow-md">
              🗑️ Erase Component
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
