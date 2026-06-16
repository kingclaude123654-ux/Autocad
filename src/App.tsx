import { useCADEngine } from './hooks/useCADEngine';
import { LeftPanel } from './components/LeftPanel';
import { RightPanel } from './components/RightPanel';
import { Canvas3D } from './components/Canvas3D';

export default function App() {
  const engine = useCADEngine();
  const selectedObject = engine.objects.find(o => o.id === engine.selectedId) || null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100vw', height: '100vh', overflow: 'hidden', fontFamily: 'sans-serif', backgroundColor: '#0f172a' }}>
      
      {/* HUD Live Dimensions Bar */}
      <div style={{ backgroundColor: '#1e293b', color: '#38bdf8', padding: '10px', fontSize: '13px', fontWeight: 'bold', borderBottom: '2px solid #334155', display: 'flex', justifyContent: 'between', alignItems: 'center' }}>
        <span>📐 MINICAD ENGINE CONTROLLER</span>
        <span style={{ color: '#f43f5e' }}>{engine.hudFeedback}</span>
      </div>

      {/* Main Viewport Workspace Splitter */}
      <div style={{ display: 'flex', flex: 1, position: 'relative', overflow: 'hidden' }}>
        
        {/* Canvas Render Panel Container */}
        <div style={{ flex: 1, height: '100%', position: 'relative' }}>
          <Canvas3D containerRef={engine.containerRef} onCanvasClick={() => {}} />
        </div>

        {/* Floating Tool Controllers Stack */}
        <div style={{ position: 'absolute', top: '10px', left: '10px', zIndex: 100, width: '160px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ backgroundColor: 'rgba(30,41,59,0.95)', padding: '6px', borderRadius: '8px', border: '1px solid #475569' }}>
            <div style={{ color: '#94a3b8', fontSize: '10px', fontWeight: 'bold', marginBottom: '6px', textAlign: 'center' }}>VIEWS</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
              {['top', 'isometric', 'front', 'side'].map((v) => (
                <button key={v} onClick={() => engine.changeView(v as any)} style={{ padding: '6px 2px', fontSize: '11px', background: '#334155', color: '#fff', border: 'none', borderRadius: '4px', textTransform: 'uppercase', fontWeight: 'bold' }}>{v}</button>
              ))}
            </div>
          </div>
          
          <button onClick={engine.clearChain} style={{ padding: '8px', background: '#e11d48', color: '#fff', fontWeight: 'bold', fontSize: '11px', border: 'none', borderRadius: '6px', boxShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>🛑 RESET LINE CHAIN</button>
        </div>

        {/* Strict Isolated Right Inspector Sidebar */}
        <div style={{ width: '140px', backgroundColor: '#1e293b', borderLeft: '2px solid #334155', zIndex: 90, display: 'flex', flexDirection: 'column' }}>
          <RightPanel selectedObject={selectedObject} onExtrude={engine.executeExtrude} onUpdateColor={() => {}} />
        </div>

      </div>

      {/* Toolbox Panel Placed Safely at Base Boundary */}
      <div style={{ zIndex: 95 }}>
        <LeftPanel currentTool={engine.currentTool} onSelectTool={engine.setCurrentTool} onTrim={engine.executeTrim} onFillet={engine.executeFillet} onUnion={engine.executeUnion} />
      </div>

    </div>
  );
}
