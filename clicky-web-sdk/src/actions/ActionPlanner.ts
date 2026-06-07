import { EventBus } from "../core/EventBus";
import type { ClickyCapturedContext, ClickyProposedAction, NormalizedClickyOptions } from "../core/types";
import { ElementRegistry } from "../context/ElementRegistry";
import { ActionExecutor } from "./ActionExecutor";
import { ActionRegistry } from "./ActionRegistry";
import { ConfirmationPolicy } from "./ConfirmationPolicy";

export class ActionPlanner {
  private readonly confirmationPolicy: ConfirmationPolicy;
  private readonly actionExecutor: ActionExecutor;
  private pendingAction?: {
    action: ClickyProposedAction;
    capturedContext: ClickyCapturedContext;
  };

  constructor(
    private readonly options: NormalizedClickyOptions,
    private readonly actionRegistry: ActionRegistry,
    private readonly elementRegistry: ElementRegistry,
    private readonly eventBus: EventBus
  ) {
    this.confirmationPolicy = new ConfirmationPolicy(options.actionMode);
    this.actionExecutor = new ActionExecutor(elementRegistry);
  }

  async handleProposedAction(
    proposedAction: { actionId: string; parameters: Record<string, unknown> } | undefined,
    capturedContext: ClickyCapturedContext
  ): Promise<void> {
    if (!proposedAction || proposedAction.actionId === "none") {
      return;
    }

    if (!this.confirmationPolicy.isActionAllowed()) {
      return;
    }

    const actionDefinition = this.actionRegistry.getAction(proposedAction.actionId);
    if (!actionDefinition) {
      this.eventBus.emit("action:failed", { error: new Error(`Unregistered action: ${proposedAction.actionId}`) });
      return;
    }

    try {
      const action = this.actionExecutor.createProposedAction(actionDefinition, proposedAction.parameters);
      this.eventBus.emit("action:proposed", { action });

      if (this.confirmationPolicy.requiresConfirmation(actionDefinition)) {
        this.pendingAction = { action, capturedContext };
        return;
      }

      await this.executeConfirmedAction(action, capturedContext);
    } catch (error) {
      this.eventBus.emit("action:failed", { error: error instanceof Error ? error : new Error(String(error)) });
    }
  }

  async confirmPendingAction(): Promise<void> {
    const pendingAction = this.pendingAction;
    if (!pendingAction) {
      return;
    }

    this.pendingAction = undefined;
    this.eventBus.emit("action:confirmed", { action: pendingAction.action });
    await this.executeConfirmedAction(pendingAction.action, pendingAction.capturedContext);
  }

  rejectPendingAction(): void {
    this.pendingAction = undefined;
  }

  hasPendingAction(): boolean {
    return !!this.pendingAction;
  }

  private async executeConfirmedAction(action: ClickyProposedAction, capturedContext: ClickyCapturedContext): Promise<void> {
    try {
      const result = await this.actionExecutor.executeAction(action, capturedContext);
      this.eventBus.emit("action:executed", { action, result });
    } catch (error) {
      this.eventBus.emit("action:failed", {
        action,
        error: error instanceof Error ? error : new Error(String(error))
      });
    }
  }
}
