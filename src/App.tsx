import { useCADEngine } from './hooks/useCADEngine';

export default function App() {
  const {
    containerRef, currentTool, setCurrentTool, viewMode, changeView, isDarkMode, setIsDarkMode, hudFeedback, unit,
    snapToGrid, setSnapToGrid, orthoMode, setOrthoMode, getSelectedObject, updateSelectedObjectDimensions,
    executeNewProject, executeSaveProject, executeLoadProject, executeExtrude, executeErase, executeTrim, executeExtend,
    executeFillet, executeUnion, executeSubtract, executeCopy, executePaste, executeRotate, executeOffset, executePolarArray,
    executeScale, executeIncreaseWorkspace, executeExportPDF, undo, redo
  } = useCADEngine();

  const selectedTargetObj = getSelectedObject();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100vw', height: '100vh', overflow: 'hidden', backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc', color: isDarkMode ? '#f1f5f9' : '#0f172a', fontFamily: 'sans-serif' }}>
      
      {/* HEADER CONTROL CONSOLE GRID */}
      <header style={{ display: 'flex', flexDirection: 'column', padding: '8px 12px', backgroundColor: '#1e293b', borderBottom: '1px solid #334155', gap: '6px' }}>
        <div style={{ display: 'flex', justifyBetween: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#f8fafc' }}>MiniCAD Vector Layout [Engine Base: {unit.toUpperCase()}]</div>
          <button onClick={executeExportPDF} style={{ padding: '4px 10px', fontSize: '11px', backgroundColor: '#ef4444', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>
            Convert to PDF
          </button>
        </div>
        
        {/* ROW 1: CORE STORAGE PERSISTENCE VECTOR */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <button onClick={executeNewProject} style={{ padding: '4px 8px', fontSize: '11px', backgroundColor: '#f1f5f9', border: 'none', borderRadius: '4px', cursor: 'pointer', color: '#0f172a' }}>📄 New</button>
          <button onClick={executeSaveProject} style={{ padding: '4px 8px', fontSize: '11px', backgroundColor: '#f1f5f9', border: 'none', borderRadius: '4px', cursor: 'pointer', color: '#0f172a' }}>💾 Save</button>
          <button onClick={executeLoadProject} style={{ padding: '4px 8px', fontSize: '11px', backgroundColor: '#f1f5f9', border: 'none', borderRadius: '4px', cursor: 'pointer', color: '#0f172a' }}>📂 Open</button>
          <button onClick={executeIncreaseWorkspace} style={{ padding: '4px 8px', fontSize: '11px', backgroundColor: '#e2e8f0', border: 'none', borderRadius: '4px', cursor: 'pointer', color: '#0f172a', fontWeight: 'bold' }}>➕ Expand Grid</button>
          
          {/* LOCK CONTROLLERS: ORTHO & SNAP CONFIGURATIONS */}
          <button onClick={() => setSnapToGrid(!snapToGrid)} style={{ padding: '4px 8px', fontSize: '11px', backgroundColor: snapToGrid ? '#22c55e' : '#64748b', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold' }}>
            {snapToGrid ? '⚡ SNAP ON' : '⚡ SNAP OFF'}
          </button>
          <button onClick={() => setOrthoMode(!orthoMode)} style={{ padding: '4px 8px', fontSize: '11px', backgroundColor: orthoMode ? '#2563eb' : '#64748b', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold' }}>
            {orthoMode ? '📐 ORTHO ON' : '📐 ORTHO OFF'}
          </button>
        </div>

        {/* ROW 2: ZERO-LAG DIRECT MATRIX CAMERA FLIPS */}
        <div style={{ display: 'flex', gap: '4px' }}>
          {['top', 'front', 'side', 'isometric'].map((mode) => (
            <button key={mode} onClick={() => changeView(mode as any)} style={{ padding: '4px 10px', fontSize: '11px', backgroundColor: viewMode === mode ? '#2563eb' : '#475569', color: '#ffffff', border: 'none', borderRadius: '4px', textTransform: 'capitalize', cursor: 'pointer' }}>
              {mode} View
            </button>
          ))}
        </div>

        {/* ROW 3: TRACE CONTROLLERS */}
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <button onClick={undo} style={{ padding: '4px 8px', fontSize: '11px', backgroundColor: '#475569', color: '#fff', border: 'none', borderRadius: '4px' }}>↩️ Undo</button>
          <button onClick={redo} style={{ padding: '4px 8px', fontSize: '11px', backgroundColor: '#475569', color: '#fff', border: 'none', borderRadius: '4px' }}>↪️ Redo</button>
          <button onClick={() => setIsDarkMode(!isDarkMode)} style={{ padding: '4px 8px', fontSize: '11px', backgroundColor: '#475569', color: '#fff', border: 'none', borderRadius: '4px', marginLeft: 'auto' }}>
            {isDarkMode ? '🌙 Dark Grid' : '☀️ Light Grid'}
          </button>
        </div>
      </header>

      {/* DYNAMIC FIELD ADJUSTMENT PANEL */}
      {selectedTargetObj && (
        <div style={{ backgroundColor: '#1e1b4b', padding: '6px 12px', display: 'flex', gap: '12px', alignItems: 'center', borderBottom: '2px solid #4338ca', flexWrap: 'wrap' }}>
          <span style={{ color: '#67e8f9', fontSize: '12px', fontWeight: 'bold' }}>Modify Selected {selectedTargetObj.type.toUpperCase()}:</span>
          
          {selectedTargetObj.type === 'circle' && (
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <label style={{ fontSize: '11px', color: '#fff' }}>Radius ({unit}):</label>
              <input type="number" defaultValue={selectedTargetObj.properties?.radius || 0} onChange={(e) => updateSelectedObjectDimensions({ radius: parseFloat(e.target.value) || 0 })} style={{ width: '60px', padding: '2px', fontSize: '11px', borderRadius: '3px', border: 'none' }} />
            </div>
          )}

          {selectedTargetObj.type === 'rectangle' && (
            <div style={{ display: 'flex', gap: '10px' }}>
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                <label style={{ fontSize: '11px', color: '#fff' }}>Width:</label>
                <input type="number" defaultValue={selectedTargetObj.properties?.width || 0} onChange={(e) => updateSelectedObjectDimensions({ width: parseFloat(e.target.value) || 0 })} style={{ width: '55px', padding: '2px', fontSize: '11px', borderRadius: '3px' }} />
              </div>
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                <label style={{ fontSize: '11px', color: '#fff' }}>Height:</label>
                <input type="number" defaultValue={selectedTargetObj.properties?.height || 0} onChange={(e) => updateSelectedObjectDimensions({ height: parseFloat(e.target.value) || 0 })} style={{ width: '55px', padding: '2px', fontSize: '11px', borderRadius: '3px' }} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* READOUT CONSOLE LOG FEEDBAR */}
      <div style={{ backgroundColor: '#020617', color: '#fbbf24', padding: '4px 12px', fontSize: '11px', fontFamily: 'monospace' }}>
        {hudFeedback}
      </div>

      {/* CORE VIEWPORT CANVAS NODE */}
      <div style={{ flex: 1, position: 'relative', backgroundColor: '#000000' }}>
        <div ref={containerRef} style={{ width: '100%', height: '100%', touchAction: 'none' }} />

        {/* QUICK CONTROL DRAWER CONSOLE */}
        <div style={{ position: 'absolute', bottom: '8px', left: '50%', transform: 'translateX(-50%)', width: '96%', backgroundColor: 'rgba(15, 23, 42, 0.95)', border: '1px solid #475569', borderRadius: '8px', padding: '6px', display: 'flex', flexDirection: 'column', gap: '4px', zIndex: 100 }}>
          
          {/* PRIMITIVES DRAWER BLOCK */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '3px' }}>
            {['select', 'line', 'polyline', 'rectangle', 'circle'].map((tool) => (
              <button key={tool} onClick={() => setCurrentTool(tool)} style={{ padding: '6px 2px', fontSize: '11px', fontWeight: 'bold', borderRadius: '4px', border: '1px solid #4f46e5', backgroundColor: currentTool === tool ? '#4f46e5' : '#1e293b', color: '#ffffff' }}>
                {tool === 'select' ? '🎯 SELECT' : tool === 'polyline' ? '✏️ PLINE' : tool.toUpperCase()}
              </button>
            ))}
          </div>

          {/* ADVANCED REPAIRS & INTERSECTION BOOLEAN PACK */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '3px' }}>
            <button onClick={() => setCurrentTool('polygon')} style={{ padding: '5px 2px', fontSize: '10px', fontWeight: 'bold', borderRadius: '4px', backgroundColor: currentTool === 'polygon' ? '#f59e0b' : '#334155', color: '#fff', border: 'none' }}>🔺 TRI</button>
            <button onClick={executeTrim} style={{ padding: '5px 2px', fontSize: '10px', fontWeight: 'bold', borderRadius: '4px', backgroundColor: '#c2410c', color: '#fff', border: 'none' }}>✂️ TRIM</button>
            <button onClick={executeExtend} style={{ padding: '5px 2px', fontSize: '10px', fontWeight: 'bold', borderRadius: '4px', backgroundColor: '#047857', color: '#fff', border: 'none' }}>📏 EXTEND</button>
            <button onClick={executeFillet} style={{ padding: '5px 2px', fontSize: '10px', fontWeight: 'bold', borderRadius: '4px', backgroundColor: '#be185d', color: '#fff', border: 'none' }}>📐 FILLET</button>
            <button onClick={executeUnion} style={{ padding: '5px 2px', fontSize: '10px', fontWeight: 'bold', borderRadius: '4px', backgroundColor: '#0f766e', color: '#fff', border: 'none' }}>➕ UNION</button>
            <button onClick={executeSubtract} style={{ padding: '5px 2px', fontSize: '10px', fontWeight: 'bold', borderRadius: '4px', backgroundColor: '#b91c1c', color: '#fff', border: 'none' }}>➖ SUB</button>
          </div>

          {/* SPATIAL TRANSLATION MATRIX ROW */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '3px' }}>
            <button onClick={() => setCurrentTool('move')} style={{ padding: '5px 2px', fontSize: '10px', fontWeight: 'bold', borderRadius: '4px', backgroundColor: currentTool === 'move' ? '#10b981' : '#475569', color: '#fff', border: 'none' }}>🗺️ MOVE</button>
            <button onClick={executeCopy} style={{ padding: '5px 2px', fontSize: '10px', fontWeight: 'bold', borderRadius: '4px', backgroundColor: '#475569', color: '#fff', border: 'none' }}>📋 COPY</button>
            <button onClick={executePaste} style={{ padding: '5px 2px', fontSize: '10px', fontWeight: 'bold', borderRadius: '4px', backgroundColor: '#0ea5e9', color: '#fff', border: 'none' }}>📥 PASTE</button>
            <button onClick={executeRotate} style={{ padding: '5px 2px', fontSize: '10px', fontWeight: 'bold', borderRadius: '4px', backgroundColor: '#6d28d9', color: '#fff', border: 'none' }}>🔄 ROTATE</button>
            <button onClick={executeOffset} style={{ padding: '5px 2px', fontSize: '10px', fontWeight: 'bold', borderRadius: '4px', backgroundColor: '#4338ca', color: '#fff', border: 'none' }}>⚎ OFFSET</button>
            <button onClick={executeScale} style={{ padding: '5px 2px', fontSize: '10px', fontWeight: 'bold', borderRadius: '4px', backgroundColor: '#0369a1', color: '#fff', border: 'none' }}>⚖️ SCALE</button>
          </div>

          {/* DOCK FOOTER SUB-ACTIONS FOOTPRINT */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '4px', borderTop: '1px solid #334155' }}>
            <button onClick={executePolarArray} style={{ padding: '4px 8px', fontSize: '10px', backgroundColor: '#701a75', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold' }}>🔆 POLAR ARRAY</button>
            <button onClick={executeExtrude} style={{ padding: '4px 10px', fontSize: '11px', fontWeight: 'bold', backgroundColor: '#a21caf', color: '#fff', border: 'none', borderRadius: '4px' }}>📦 EXTRUDE 3D</button>
            <button onClick={() => setCurrentTool('deselect')} style={{ padding: '4px 8px', fontSize: '11px', backgroundColor: '#64748b', color: '#fff', border: 'none', borderRadius: '4px' }}>Reset</button>
            <button onClick={executeErase} style={{ padding: '4px 12px', fontSize: '11px', fontWeight: 'bold', backgroundColor: '#e11d48', color: '#fff', border: 'none', borderRadius: '4px' }}>🗑️ ERASE</button>
          </div>

        </div>
      </div>
    </div>
  );
}
