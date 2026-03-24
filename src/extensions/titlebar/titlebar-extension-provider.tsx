import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import { registerBuiltinTitlebarContributions } from "./builtin";
import { registerCommand, unregisterCommand } from "@/extensions/commands/command-service";
import {
  registerTitlebarContribution,
  unregisterTitlebarContribution,
} from "./registry";

export type TitlebarExtensionApi = {
  registerCommand: typeof registerCommand;
  unregisterCommand: typeof unregisterCommand;
  registerTitlebarContribution: typeof registerTitlebarContribution;
  unregisterTitlebarContribution: typeof unregisterTitlebarContribution;
};

const TitlebarExtensionContext = createContext<TitlebarExtensionApi | null>(null);

export function TitlebarExtensionProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    registerBuiltinTitlebarContributions();
  }, []);

  const api = useMemo<TitlebarExtensionApi>(
    () => ({
      registerCommand,
      unregisterCommand,
      registerTitlebarContribution,
      unregisterTitlebarContribution,
    }),
    [],
  );

  return (
    <TitlebarExtensionContext.Provider value={api}>{children}</TitlebarExtensionContext.Provider>
  );
}

export function useTitlebarExtensions(): TitlebarExtensionApi {
  const ctx = useContext(TitlebarExtensionContext);
  if (!ctx) {
    throw new Error("useTitlebarExtensions must be used within TitlebarExtensionProvider");
  }
  return ctx;
}

export function useOptionalTitlebarExtensions(): TitlebarExtensionApi | null {
  return useContext(TitlebarExtensionContext);
}
