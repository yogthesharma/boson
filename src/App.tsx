import "./App.css";
import { Titlebar } from "./components/titlebar";
import { WorkbenchLayout } from "./extensions/workbench/workbench-layout";

function App() {
  return (
    <div className="bg-background text-foreground flex h-full min-h-0 flex-col overflow-hidden">
      <Titlebar />
      <WorkbenchLayout />
    </div>
  );
}

export default App;
