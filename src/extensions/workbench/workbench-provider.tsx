import { useEffect, type ReactNode } from "react";
import { registerCommand, unregisterCommand } from "@/extensions/commands/command-service";
import { registerBuiltinWorkbenchContributions } from "./builtin";
import { WorkbenchStateProvider, useWorkbenchState } from "./workbench-state";

function WorkbenchCommandBindings({ children }: { children: ReactNode }) {
  const { state, dispatch } = useWorkbenchState();

  useEffect(() => {
    registerBuiltinWorkbenchContributions();
  }, []);

  useEffect(() => {
    registerCommand("boson.layout.toggleLeft", () => {
      dispatch({ type: "togglePrimarySidebar" });
    });
    registerCommand("boson.layout.toggleRight", () => {
      dispatch({ type: "toggleAuxiliaryBar" });
    });
    registerCommand("boson.layout.toggleBottom", () => {
      dispatch({ type: "togglePanel" });
    });
    registerCommand("boson.auxiliary.open", () => {
      if (!state.auxiliaryBarVisible) {
        dispatch({ type: "toggleAuxiliaryBar" });
      }
    });
    registerCommand("boson.auxiliary.close", () => {
      if (state.auxiliaryBarVisible) {
        dispatch({ type: "toggleAuxiliaryBar" });
      }
    });
    return () => {
      unregisterCommand("boson.layout.toggleLeft");
      unregisterCommand("boson.layout.toggleRight");
      unregisterCommand("boson.layout.toggleBottom");
      unregisterCommand("boson.auxiliary.open");
      unregisterCommand("boson.auxiliary.close");
    };
  }, [dispatch, state.auxiliaryBarVisible]);

  return children;
}

export function WorkbenchProvider({ children }: { children: ReactNode }) {
  return (
    <WorkbenchStateProvider>
      <WorkbenchCommandBindings>{children}</WorkbenchCommandBindings>
    </WorkbenchStateProvider>
  );
}
