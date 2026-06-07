import { EventBus } from "./EventBus";
import type { ClickyState } from "./types";

const allowedTransitions: Record<ClickyState, ClickyState[]> = {
  idle: ["listening", "capturing-context", "responding", "guide-planning", "error"],
  listening: ["transcribing", "idle", "error"],
  transcribing: ["capturing-context", "idle", "error"],
  "capturing-context": ["responding", "idle", "error"],
  responding: ["speaking", "awaiting-action-confirmation", "executing-action", "idle", "error"],
  speaking: ["awaiting-action-confirmation", "executing-action", "idle", "error"],
  "awaiting-action-confirmation": ["executing-action", "idle", "error"],
  "executing-action": ["idle", "responding", "error"],
  "guide-planning": ["guide-step-active", "guide-blocked", "idle", "error"],
  "guide-step-active": ["guide-step-watching", "guide-recovering", "guide-completed", "guide-blocked", "idle", "error"],
  "guide-step-watching": ["guide-step-active", "guide-recovering", "guide-completed", "guide-blocked", "idle", "error"],
  "guide-recovering": ["guide-step-active", "guide-step-watching", "guide-blocked", "idle", "error"],
  "guide-completed": ["idle"],
  "guide-blocked": ["idle", "guide-recovering", "error"],
  error: ["idle"]
};

export class StateMachine {
  private currentState: ClickyState = "idle";

  constructor(private readonly eventBus: EventBus) {}

  getState(): ClickyState {
    return this.currentState;
  }

  canTransition(fromState: ClickyState, nextState: ClickyState): boolean {
    return fromState === nextState || allowedTransitions[fromState].includes(nextState);
  }

  setState(nextState: ClickyState): void {
    const previousState = this.currentState;
    if (!this.canTransition(previousState, nextState)) {
      throw new Error(`Invalid Clicky state transition from ${previousState} to ${nextState}`);
    }

    if (previousState === nextState) {
      return;
    }

    this.currentState = nextState;
    this.eventBus.emit("state:changed", { previousState, nextState });
  }
}
