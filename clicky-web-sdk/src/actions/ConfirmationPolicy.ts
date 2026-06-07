import type { ClickyActionDefinition, ClickyActionMode } from "../core/types";

export class ConfirmationPolicy {
  constructor(private readonly actionMode: ClickyActionMode) {}

  isActionAllowed(): boolean {
    return this.actionMode !== "disabled";
  }

  requiresConfirmation(actionDefinition: ClickyActionDefinition): boolean {
    if (this.actionMode === "confirm-before-execute") {
      return actionDefinition.requiresConfirmation ?? true;
    }

    if (this.actionMode === "execute-registered-actions") {
      return actionDefinition.requiresConfirmation ?? false;
    }

    return true;
  }
}
