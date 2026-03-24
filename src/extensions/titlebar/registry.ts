import type { TitlebarContribution } from "./types";

let contributions: TitlebarContribution[] = [];
const listeners = new Set<() => void>();

function sortContributions(list: TitlebarContribution[]): TitlebarContribution[] {
  return [...list].sort((a, b) => a.order - b.order);
}

export function subscribeTitlebarContributions(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getTitlebarContributions(): TitlebarContribution[] {
  return contributions;
}

export function registerTitlebarContribution(
  contribution: TitlebarContribution,
): void {
  contributions = sortContributions([...contributions, contribution]);
  listeners.forEach((l) => l());
}

export function unregisterTitlebarContribution(id: string): void {
  contributions = contributions.filter((c) => c.id !== id);
  listeners.forEach((l) => l());
}
