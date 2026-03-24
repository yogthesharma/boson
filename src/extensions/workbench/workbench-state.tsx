import {
  createContext,
  useContext,
  useMemo,
  useReducer,
  type Dispatch,
  type ReactNode,
} from "react";
import type { WorkbenchAction, WorkbenchState } from "./types";

const DEFAULT_ACTIVITY = "workbench.view.explorer";

const initialState: WorkbenchState = {
  primarySidebarVisible: true,
  auxiliaryBarVisible: true,
  panelVisible: false,
  activeActivityId: DEFAULT_ACTIVITY,
};

function workbenchReducer(state: WorkbenchState, action: WorkbenchAction): WorkbenchState {
  switch (action.type) {
    case "togglePrimarySidebar":
      return { ...state, primarySidebarVisible: !state.primarySidebarVisible };
    case "toggleAuxiliaryBar":
      return { ...state, auxiliaryBarVisible: !state.auxiliaryBarVisible };
    case "togglePanel":
      return { ...state, panelVisible: !state.panelVisible };
    case "setActiveActivity":
      return { ...state, activeActivityId: action.id };
    default:
      return state;
  }
}

type WorkbenchContextValue = {
  state: WorkbenchState;
  dispatch: Dispatch<WorkbenchAction>;
};

const WorkbenchStateContext = createContext<WorkbenchContextValue | null>(null);

export function WorkbenchStateProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(workbenchReducer, initialState);
  const value = useMemo(() => ({ state, dispatch }), [state]);
  return (
    <WorkbenchStateContext.Provider value={value}>{children}</WorkbenchStateContext.Provider>
  );
}

export function useWorkbenchState(): WorkbenchContextValue {
  const ctx = useContext(WorkbenchStateContext);
  if (!ctx) {
    throw new Error("useWorkbenchState must be used within WorkbenchStateProvider");
  }
  return ctx;
}
