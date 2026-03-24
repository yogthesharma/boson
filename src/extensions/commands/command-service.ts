type CommandHandler = () => void | Promise<void>;

const handlers = new Map<string, CommandHandler>();

export function registerCommand(id: string, handler: CommandHandler): void {
  handlers.set(id, handler);
}

export function unregisterCommand(id: string): void {
  handlers.delete(id);
}

export async function executeCommand(id: string): Promise<void> {
  const handler = handlers.get(id);
  if (handler) {
    await handler();
  }
}
