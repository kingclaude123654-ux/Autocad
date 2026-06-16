// Example of how you call these features in your UI panel components:
const { 
  executeNewProject, 
  executeSaveProject, 
  executeLoadProject, 
  executeErase, 
  undo, 
  redo 
} = useCADEngine();

// Inside your layout JSX return tree:
<button onClick={executeNewProject}>New File</button>
<button onClick={executeSaveProject}>Save As</button>
<button onClick={executeLoadProject}>Open File</button>
<button onClick={executeErase}>Delete Selected</button>
<button onClick={undo}>Undo</button>
<button onClick={redo}>Redo</button>
