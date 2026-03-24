import { AuxiliaryBar } from "./auxiliary-bar";
import { EditorArea } from "./editor-area";
import { PrimarySidebar } from "./primary-sidebar";
import { WorkbenchPanel } from "./panel";
import { WorkbenchStatusBar } from "./status-bar";
import { useWorkbenchState } from "./workbench-state";

export function WorkbenchLayout() {
  const { state } = useWorkbenchState();

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-row overflow-hidden">
        {state.primarySidebarVisible ? <PrimarySidebar /> : null}

        <div className="flex min-h-0 min-w-0 flex-1 flex-row overflow-hidden">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <EditorArea />
            {state.panelVisible ? <WorkbenchPanel /> : null}
          </div>
          {state.auxiliaryBarVisible ? <AuxiliaryBar /> : null}
        </div>
      </div>
      <WorkbenchStatusBar />
    </div>
  );
}
