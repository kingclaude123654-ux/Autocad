import { useEffect } from 'react';
import { useCADEngine } from './hooks/useCADEngine';
import { TopToolbar } from './components/TopToolbar';
import { LeftPanel } from './components/LeftPanel';
import { RightPanel } from './components/RightPanel';
import { Canvas3D } from './components/Canvas3D';

export default function App() {
  const engine = useCADEngine();

  useEffect(() => {
    const demoObjects = [
      {
        id: 'demo-rect-1',
        type: 'rectangle' as const,
        points: [
          { x: -15, y: -15 },
          { x: 15, y: -15 },
          { x: 15, y: 15 },
          { x: -15, y: 15 }
        ],
        color: '#3b82f6',
        layer: '0',
        is3D: false,
        properties: { width: 30, height: 30 }
      }
    ];
    engine.saveHistoryState(demoObjects);
  }, []);

  const selectedObject = engine.objects.find(o => o.id === engine.selectedId) || null;

  const handleUpdateColor = (id: string, color: string) => {
    const updated = engine.objects.map(o => o.id === id ? { ...o, color } : o);
    engine.saveHistoryState(updated);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100vw', height: '100vh', overflow: 'hidden', backgroundColor: engine.isDarkMode ? '#0f172a' : '#f8fafc' }} className={engine.isDarkMode ? 'dark' : ''}>
      
      {/* SECTION 1: Top Controls (Completely isolated) */}
      <div style={{ width: '100%', zIndex: 100, background: engine.isDarkMode ? '#0f172a' : '#ffffff', position: 'relative' }}>
        <TopToolbar 
          viewMode={engine.viewMode} 
          onViewChange={engine.changeView} 
          isDarkMode={engine.isDarkMode} 
          onToggleTheme={() => engine.setIsDarkMode(!engine.isDarkMode)}
          onUndo={engine.undo}
          onRedo={engine.redo}
          onExportPNG={engine.exportAsPNG}
        />
        <LeftPanel currentTool={engine.currentTool} onSelectTool={engine.setCurrentTool} />
      </div>
      
      {/* SECTION 2: Interactive Lower Canvas Area */}
      <div style={{ display: 'flex', flex: 1, width: '100%', position: 'relative', overflow: 'hidden' }}>
        <div style={{ flex: 1, height: '100%', position: 'relative', zIndex: 10 }}>
          <Canvas3D containerRef={engine.containerRef} onCanvasClick={engine.handleWorkspaceTap} />
        </div>
        
        <div style={{ width: '110px', height: '100%', zIndex: 50, position: 'relative' }}>
          <RightPanel 
            selectedObject={selectedObject} 
            onExtrude={engine.executeExtrude}
            onUpdateColor={handleUpdateColor}
          />
        </div>
      </div>

    </div>
  );
}
