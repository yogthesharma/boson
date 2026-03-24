import { useEffect, type ReactNode } from "react";
import { registerCommand, unregisterCommand } from "@/extensions/commands/command-service";
import { registerBuiltinWorkbenchContributions } from "./builtin";
import { WorkbenchStateProvider, useWorkbenchState } from "./workbench-state";

function WorkbenchCommandBindings({ children }: { children: ReactNode }) {
  const { dispatch } = useWorkbenchState();

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
    return () => {
      unregisterCommand("boson.layout.toggleLeft");
      unregisterCommand("boson.layout.toggleRight");
      unregisterCommand("boson.layout.toggleBottom");
    };
  }, [dispatch]);

  return children;
}

export function WorkbenchProvider({ children }: { children: ReactNode }) {
  return (
    <WorkbenchStateProvider>
      <WorkbenchCommandBindings>{children}</WorkbenchCommandBindings>
    </WorkbenchStateProvider>
  );
}
