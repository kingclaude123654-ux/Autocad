import { useCADEngine } from './hooks/useCADEngine';

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
    executeExtend,
    executeFillet,
    executeUnion,
    executeSubtract,
    executeCopy,
    executePaste,
    executeRotate,
    executeOffset,
    executePolarArray,
    executeScale,
    executeIncreaseWorkspace,
    executeExportPDF,
    undo,
    redo
  } = useCADEngine();

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      width: '100vw',
      height: '100vh',
      overflow: 'hidden',
      backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc',
      color: isDarkMode ? '#f1f5f9' : '#0f172a',
      fontFamily: 'sans-serif'
    }}>
      
      {/* HEADER PANEL: FILE ACTIONS & WORKSPACE DIMENSIONS */}
      <header style={{
        display: 'flex',
        flexDirection: 'column',
        padding: '8px 12px',
        backgroundColor: '#1e293b',
        borderBottom: '1px solid #334155',
        gap: '6px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#f8fafc' }}>MiniCAD Pro 3D Engine</div>
          <button onClick={executeExportPDF} style={{ padding: '4px 12px', fontSize: '11px', backgroundColor: '#ef4444', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>
            Convert to PDF
          </button>
        </div>
        
        {/* Row 1: App Management Vectors */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <button onClick={executeNewProject} style={{ padding: '5px 10px', fontSize: '12px', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer', color: '#0f172a' }}>📄 New</button>
          <button onClick={executeSaveProject} style={{ padding: '5px 10px', fontSize: '12px', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer', color: '#0f172a' }}>💾 Save As</button>
          <button onClick={executeLoadProject} style={{ padding: '5px 10px', fontSize: '12px', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer', color: '#0f172a' }}>📂 Open File</button>
          <button onClick={executeIncreaseWorkspace} style={{ padding: '5px 10px', fontSize: '12px', backgroundColor: '#e2e8f0', border: '1px solid #94a3b8', borderRadius: '4px', cursor: 'pointer', color: '#0f172a', fontWeight: 'bold' }}>➕ Expand Grid</button>
        </div>

        {/* Row 2: Smooth View Matrix Option Angles */}
        <div style={{ display: 'flex', gap: '4px' }}>
          {['top', 'front', 'side', 'isometric'].map((mode) => (
            <button
              key={mode}
              onClick={() => changeView(mode as any)}
              style={{
                padding: '4px 10px',
                fontSize: '12px',
                backgroundColor: viewMode === mode ? '#2563eb' : '#475569',
                color: '#ffffff',
                border: 'none',
                borderRadius: '4px',
                textTransform: 'capitalize',
                cursor: 'pointer',
                fontWeight: viewMode === mode ? 'bold' : 'normal'
              }}
            >
              {mode}
            </button>
          ))}
        </div>

        {/* Row 3: History Replay Traces */}
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <button onClick={undo} style={{ padding: '4px 8px', fontSize: '12px', backgroundColor: '#475569', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>↩️ Undo</button>
          <button onClick={redo} style={{ padding: '4px 8px', fontSize: '12px', backgroundColor: '#475569', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>↪️ Redo</button>
          <button onClick={() => setIsDarkMode(!isDarkMode)} style={{ padding: '4px 8px', fontSize: '12px', backgroundColor: '#475569', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', marginLeft: 'auto' }}>
            {isDarkMode ? '🌙 Dark Grid' : '☀️ Light Grid'}
          </button>
        </div>
      </header>

      {/* READOUT HUD CONSOLE BAR */}
      <div style={{
        backgroundColor: '#020617',
        color: '#fbbf24',
        padding: '6px 12px',
        fontSize: '12px',
        fontFamily: 'monospace',
        borderBottom: '1px solid #1e293b'
      }}>
        {hudFeedback}
      </div>

      {/* MAIN VIEWPORT MATRIX VIEW */}
      <div style={{ flex: 1, position: 'relative', backgroundColor: '#000000' }}>
        <div ref={containerRef} style={{ width: '100%', height: '100%', touchAction: 'none' }} />

        {/* BOTTOM QUICK ACTIONS FLOATING PANEL */}
        <div style={{
          position: 'absolute',
          bottom: '10px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '96%',
          backgroundColor: 'rgba(15, 23, 42, 0.96)',
          border: '1px solid #475569',
          borderRadius: '8px',
          padding: '8px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.6)',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          zIndex: 100
        }}>
          
          {/* GEOMETRIC PROFILE DRAW VECTOR PRIMITIVES */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '4px' }}>
            {['select', 'line', 'polyline', 'rectangle', 'circle'].map((tool) => (
              <button
                key={tool}
                onClick={() => setCurrentTool(tool)}
                style={{
                  padding: '8px 2px',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  borderRadius: '4px',
                  border: '1px solid #4f46e5',
                  cursor: 'pointer',
                  backgroundColor: currentTool === tool ? '#4f46e5' : '#1e293b',
                  color: '#ffffff'
                }}
              >
                {tool === 'select' ? '🎯 SELECT' : tool === 'polyline' ? '✏️ PLINE' : tool.toUpperCase()}
              </button>
            ))}
          </div>

          {/* ADVANCED VECTOR REPAIRS & BOOLEAN SOLID MODIFIERS */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '4px' }}>
            <button onClick={() => setCurrentTool('polygon')} style={{ padding: '6px 2px', fontSize: '10px', fontWeight: 'bold', borderRadius: '4px', backgroundColor: currentTool === 'polygon' ? '#f59e0b' : '#334155', color: '#fff', border: 'none' }}>🔺 TRI</button>
            <button onClick={executeTrim} style={{ padding: '6px 2px', fontSize: '10px', fontWeight: 'bold', borderRadius: '4px', backgroundColor: '#c2410c', color: '#fff', border: 'none' }}>✂️ TRIM</button>
            <button onClick={executeExtend} style={{ padding: '6px 2px', fontSize: '10px', fontWeight: 'bold', borderRadius: '4px', backgroundColor: '#047857', color: '#fff', border: 'none' }}>📏 EXTEND</button>
            <button onClick={executeFillet} style={{ padding: '6px 2px', fontSize: '10px', fontWeight: 'bold', borderRadius: '4px', backgroundColor: '#be185d', color: '#fff', border: 'none' }}>📐 FILLET</button>
            <button onClick={executeUnion} style={{ padding: '6px 2px', fontSize: '10px', fontWeight: 'bold', borderRadius: '4px', backgroundColor: '#0f766e', color: '#fff', border: 'none' }}>➕ ADDITION</button>
            <button onClick={executeSubtract} style={{ padding: '6px 2px', fontSize: '10px', fontWeight: 'bold', borderRadius: '4px', backgroundColor: '#b91c1c', color: '#fff', border: 'none' }}>➖ SUBTRACT</button>
          </div>

          {/* SPATIAL TRANSFORMS MATRIX OPERATIONS */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '4px' }}>
            <button onClick={() => setCurrentTool('move')} style={{ padding: '6px 2px', fontSize: '10px', fontWeight: 'bold', borderRadius: '4px', backgroundColor: currentTool === 'move' ? '#10b981' : '#475569', color: '#fff', border: 'none' }}>🗺️ MOVE</button>
            <button onClick={executeCopy} style={{ padding: '6px 2px', fontSize: '10px', fontWeight: 'bold', borderRadius: '4px', backgroundColor: '#475569', color: '#fff', border: 'none' }}>📋 COPY</button>
            <button onClick={executePaste} style={{ padding: '6px 2px', fontSize: '10px', fontWeight: 'bold', borderRadius: '4px', backgroundColor: '#0ea5e9', color: '#fff', border: 'none' }}>📥 PASTE</button>
            <button onClick={executeRotate} style={{ padding: '6px 2px', fontSize: '10px', fontWeight: 'bold', borderRadius: '4px', backgroundColor: '#6d28d9', color: '#fff', border: 'none' }}>🔄 ROTATE</button>
            <button onClick={executeOffset} style={{ padding: '6px 2px', fontSize: '10px', fontWeight: 'bold', borderRadius: '4px', backgroundColor: '#4338ca', color: '#fff', border: 'none' }}>⚎ OFFSET</button>
            <button onClick={executeScale} style={{ padding: '6px 2px', fontSize: '10px', fontWeight: 'bold', borderRadius: '4px', backgroundColor: '#0369a1', color: '#fff', border: 'none' }}>⚖️ SCALE</button>
          </div>

          {/* DOCK PANEL FOOTER TERMINATION BUTTONS */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '4px', borderTop: '1px solid #334155' }}>
            <button onClick={executePolarArray} style={{ padding: '5px 10px', fontSize: '10px', backgroundColor: '#701a75', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold' }}>🔆 POLAR ARRAY</button>
            <button onClick={executeExtrude} style={{ padding: '5px 12px', fontSize: '11px', fontWeight: 'bold', backgroundColor: '#a21caf', color: '#fff', border: 'none', borderRadius: '4px' }}>📦 EXTRUDE 3D</button>
            <button onClick={() => setCurrentTool('deselect')} style={{ padding: '5px 8px', fontSize: '11px', backgroundColor: '#64748b', color: '#fff', border: 'none', borderRadius: '4px' }}>Reset</button>
            <button onClick={executeErase} style={{ padding: '5px 14px', fontSize: '11px', fontWeight: 'bold', backgroundColor: '#e11d48', color: '#fff', border: 'none', borderRadius: '4px' }}>🗑️ ERASE</button>
          </div>

        </div>
      </div>
    </div>
  );
}
