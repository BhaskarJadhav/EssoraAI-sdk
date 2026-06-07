import type { ClickyActionDefinition } from "../core/types";

export class ActionRegistry {
  private readonly actionById = new Map<string, ClickyActionDefinition>();

  registerAction(actionDefinition: ClickyActionDefinition): void {
    if (!actionDefinition.id || !actionDefinition.name || !actionDefinition.execute) {
      throw new Error("Action definitions require id, name, and execute");
    }
    this.actionById.set(actionDefinition.id, actionDefinition);
  }

  unregisterAction(actionId: string): void {
    this.actionById.delete(actionId);
  }

  getAction(actionId: string): ClickyActionDefinition | undefined {
    return this.actionById.get(actionId);
  }

  listActions(): ClickyActionDefinition[] {
    return Array.from(this.actionById.values());
  }
}
