import React, { useEffect } from 'react';
import { useCADEngine } from './hooks/useCADEngine';
import { TopToolbar } from './components/TopToolbar';
import { LeftPanel } from './components/LeftPanel';
import { RightPanel } from './components/RightPanel';
import { Canvas3D } from './components/Canvas3D';

export default function App() {
  const engine = useCADEngine();

  // Load a demo rectangle object on initial render
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

  const handleCanvasClick = () => {
    if (engine.currentTool === 'select' && engine.objects.length > 0) {
      engine.setSelectedId(engine.objects[0].id);
    }
  };

  const handleUpdateColor = (id: string, color: string) => {
    const updated = engine.objects.map(o => o.id === id ? { ...o, color } : o);
    engine.saveHistoryState(updated);
  };

  return (
    <div className={`h-screen w-screen flex flex-col overflow-hidden ${engine.isDarkMode ? 'dark' : ''}`}>
      <TopToolbar 
        viewMode={engine.viewMode} 
        onViewChange={engine.changeView} 
        isDarkMode={engine.isDarkMode} 
        onToggleTheme={() => engine.setIsDarkMode(!engine.isDarkMode)}
        onUndo={engine.undo}
        onRedo={engine.redo}
        onExportPNG={engine.exportAsPNG}
      />
      
      <div className="flex flex-1 w-full overflow-hidden relative">
        <LeftPanel currentTool={engine.currentTool} onSelectTool={engine.setCurrentTool} />
        
        <Canvas3D containerRef={engine.containerRef} onCanvasClick={handleCanvasClick} />
        
        <RightPanel 
          selectedObject={selectedObject} 
          onExtrude={engine.executeExtrude}
          onUpdateColor={handleUpdateColor}
        />
      </div>
    </div>
  );
}
