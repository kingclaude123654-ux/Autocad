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

  // Explicit fallback trigger for a 2D/3D solid subtraction matrix operation
  const handleSubtract = () => {
    alert("Select two overlapping shapes on your grid workspace to compute a solid Subtraction path cut.");
  };

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
      
      {/* HEADER: APP TITLE & PERMANENT STORAGE FILE TOOLS */}
      <header style={{
        display: 'flex',
        flexDirection: 'column',
        padding: '8px 12px',
        backgroundColor: '#1e293b',
        borderBottom: '1px solid #334155',
        gap: '6px'
      }}>
        <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#f8fafc' }}>MiniCAD Pro 3D</div>
        
        {/* Row 1: File Actions (New, Save As, Open) */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <button onClick={executeNewProject} style={{ padding: '6px 10px', fontSize: '12px', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer', color: '#0f172a' }}>📄 New Project</button>
          <button onClick={executeSaveProject} style={{ padding: '6px 10px', fontSize: '12px', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer', color: '#0f172a' }}>💾 Save As</button>
          <button onClick={executeLoadProject} style={{ padding: '6px 10px', fontSize: '12px', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer', color: '#0f172a' }}>📂 Open Old File</button>
        </div>

        {/* Row 2: Camera View Layout Angle Switches */}
        <div style={{ display: 'flex', gap: '4px' }}>
          {(['top', 'front', 'side', 'isometric'] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => changeView(mode)}
              style={{
                padding: '4px 8px',
                fontSize: '12px',
                backgroundColor: viewMode === mode ? '#3b82f6' : '#475569',
                color: '#ffffff',
                border: 'none',
                borderRadius: '4px',
                textTransform: 'capitalize',
                cursor: 'pointer'
              }}
            >
              {mode}
            </button>
          ))}
        </div>

        {/* Row 3: History Time Travel Undo/Redo Controls */}
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <button onClick={undo} style={{ padding: '4px 8px', fontSize: '12px', backgroundColor: '#475569', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>🔄 Undo Step</button>
          <button onClick={redo} style={{ padding: '4px 8px', fontSize: '12px', backgroundColor: '#475569', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>🔄 Redo Step</button>
          <button onClick={() => setIsDarkMode(!isDarkMode)} style={{ padding: '4px 8px', fontSize: '12px', backgroundColor: '#475569', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', marginLeft: 'auto' }}>
            {isDarkMode ? '🌙 Dark Mode' : '☀️ Light Mode'}
          </button>
        </div>
      </header>

      {/* SYSTEM FEEDBACK RUNTIME HUD CONSOLE BAR */}
      <div style={{
        backgroundColor: '#020617',
        color: '#fbbf24',
        padding: '6px 12px',
        fontSize: '12px',
        fontFamily: 'monospace',
        borderBottom: '1px solid #1e293b'
      }}>
        Console: {hudFeedback}
      </div>

      {/* INTERACTIVE WORKSPACE VIEWPORT GRID LAYER */}
      <div style={{ flex: 1, position: 'relative', backgroundColor: '#000000' }}>
        <div ref={containerRef} style={{ width: '100%', height: '100%', touchAction: 'none' }} />

        {/* BOTTOM FLOATING CONTROLLER DOCK CONTAINING ALL ACTIVE CAD TOOLKITS */}
        <div style={{
          position: 'absolute',
          bottom: '12px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '94%',
          backgroundColor: 'rgba(30, 41, 59, 0.95)',
          border: '1px solid #475569',
          borderRadius: '8px',
          padding: '10px',
          boxShadow: '0 10px 25px -5px rgba(0,0,0,0.5)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          zIndex: 100
        }}>
          
          {/* PRIMITIVE SHAPE DRAFTING TOOLS CONTAINER ROW */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            gap: '6px'
          }}>
            {(['select', 'line', 'rectangle', 'circle', 'polygon'] as ToolType[]).map((tool) => (
              <button
                key={tool}
                onClick={() => setCurrentTool(tool)}
                style={{
                  padding: '10px 4px',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  borderRadius: '4px',
                  border: '1px solid #64748b',
                  cursor: 'pointer',
                  backgroundColor: currentTool === tool ? '#2563eb' : '#334155',
                  color: '#ffffff',
                  textTransform: 'uppercase'
                }}
              >
                {tool === 'select' ? '🎯 Select' : tool === 'polygon' ? '🔺 Tri' : tool.toUpperCase()}
              </button>
            ))}
          </div>

          {/* ADVANCED VECTOR OPERATIONS & SPATIAL COMMAND CONTROLS ROW */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(6, 1fr)',
            gap: '4px'
          }}>
            {/* Native Canvas Space Pan Engine Switch Toggle */}
            <button 
              onClick={() => setCurrentTool('pan' as any)} 
              style={{
                padding: '8px 2px',
                fontSize: '10px',
                fontWeight: 'bold',
                borderRadius: '4px',
                border: '1px solid #b45309',
                backgroundColor: (currentTool as string) === 'pan' ? '#d97706' : '#451a03',
                color: '#fff',
                cursor: 'pointer'
              }}
            >
              🖐️ PAN
            </button>
            
            {/* 3D Extrusion Solid Modeling Operator */}
            <button onClick={() => executeExtrude(null, 50)} style={{ padding: '8px 2px', fontSize: '10px', fontWeight: 'bold', borderRadius: '4px', border: '1px solid #701a75', backgroundColor: '#a21caf', color: '#fff', cursor: 'pointer' }}>
              📦 EXTRUDE
            </button>

            {/* Geometry Intersections Vector Modifiers */}
            <button onClick={executeTrim} style={{ padding: '8px 2px', fontSize: '10px', fontWeight: 'bold', borderRadius: '4px', border: '1px solid #7c2d12', backgroundColor: '#c2410c', color: '#fff', cursor: 'pointer' }}>
              ✂️ TRIM
            </button>
            <button onClick={executeFillet} style={{ padding: '8px 2px', fontSize: '10px', fontWeight: 'bold', borderRadius: '4px', border: '1px solid #9d174d', backgroundColor: '#be185d', color: '#fff', cursor: 'pointer' }}>
              📐 FILLET
            </button>
            
            {/* Solid Intersection Boolean Compilers */}
            <button onClick={executeUnion} style={{ padding: '8px 2px', fontSize: '10px', fontWeight: 'bold', borderRadius: '4px', border: '1px solid #115e59', backgroundColor: '#0f766e', color: '#fff', cursor: 'pointer' }}>
              ➕ UNION
            </button>
            <button onClick={handleSubtract} style={{ padding: '8px 2px', fontSize: '10px', fontWeight: 'bold', borderRadius: '4px', border: '1px solid #991b1b', backgroundColor: '#dc2626', color: '#fff', cursor: 'pointer' }}>
              ➖ SUBTRACT
            </button>
          </div>

          {/* DOCK FOOTER: DESELECT CONTEXT CLEARING & CANVASE ERASE COMMAND */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '4px', borderTop: '1px solid #334155' }}>
            <button 
              onClick={() => setCurrentTool('deselect' as any)} 
              style={{ padding: '6px 12px', fontSize: '11px', backgroundColor: '#64748b', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            >
              Reset Chain
            </button>
            <button 
              onClick={executeErase} 
              style={{ padding: '6px 16px', fontSize: '11px', fontWeight: 'bold', backgroundColor: '#e11d48', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            >
              🗑️ Erase Item
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
