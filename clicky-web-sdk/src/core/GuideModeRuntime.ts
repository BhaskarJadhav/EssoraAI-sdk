import { ClaudeClient } from "../api/ClaudeClient";
import { ElevenLabsClient } from "../api/ElevenLabsClient";
import { OverlayRoot } from "../overlay/OverlayRoot";
import { cleanAssistantResponse } from "../parsing/ResponseCleaner";
import { EventBus } from "./EventBus";
import { StateMachine } from "./StateMachine";
import type { ClickyCapturedContext, ClickyGuideStep } from "./types";

export type GuideModeRuntimeOptions = {
  claudeClient: ClaudeClient;
  elevenLabsClient: ElevenLabsClient;
  overlayRoot: OverlayRoot;
  stateMachine: StateMachine;
  eventBus: EventBus;
  captureContext(): Promise<ClickyCapturedContext>;
  appendAssistantMessage(text: string): void;
  shouldSpeak(): boolean;
};

export class GuideModeRuntime {
  private activeGoal?: string;
  private activeSteps: ClickyGuideStep[] = [];
  private cancelled = false;
  private stepCompletedResolver?: () => void;

  constructor(private readonly options: GuideModeRuntimeOptions) {}

  async start(goal: string): Promise<void> {
    this.cancel();
    this.cancelled = false;
    this.activeGoal = goal;
    this.options.stateMachine.setState("guide-planning");
    this.options.eventBus.emit("guide:started", { goal });

    const planningContext = await this.captureContext();
    this.activeSteps = await this.options.claudeClient.planGuide(goal, planningContext);
    this.options.eventBus.emit("guide:planned", { goal, steps: this.activeSteps });

    for (let stepIndex = 0; stepIndex < this.activeSteps.length; stepIndex += 1) {
      if (this.cancelled) {
        return;
      }

      const step = this.activeSteps[stepIndex];
      const didCompleteStep = await this.runStep(goal, step, stepIndex, this.activeSteps.length);
      if (!didCompleteStep) {
        this.options.stateMachine.setState("guide-blocked");
        this.options.eventBus.emit("guide:blocked", {
          goal,
          step,
          reason: "step timed out after recovery attempts"
        });
        return;
      }
    }

    this.options.stateMachine.setState("guide-completed");
    this.options.eventBus.emit("guide:completed", { goal, steps: this.activeSteps });
    this.options.appendAssistantMessage("done, the workflow is complete.");
    this.options.stateMachine.setState("idle");
    this.activeGoal = undefined;
    this.activeSteps = [];
  }

  stepCompleted(): void {
    this.stepCompletedResolver?.();
    this.stepCompletedResolver = undefined;
  }

  cancel(): void {
    this.cancelled = true;
    this.stepCompleted();
    this.activeGoal = undefined;
    this.activeSteps = [];
  }

  private async runStep(
    goal: string,
    step: ClickyGuideStep,
    stepIndex: number,
    totalSteps: number
  ): Promise<boolean> {
    for (let recoveryAttempt = 0; recoveryAttempt <= 2; recoveryAttempt += 1) {
      if (this.cancelled) {
        return false;
      }

      this.options.stateMachine.setState(recoveryAttempt === 0 ? "guide-step-active" : "guide-recovering");
      if (recoveryAttempt > 0) {
        this.options.eventBus.emit("guide:recovery", { step, attempt: recoveryAttempt });
      } else {
        this.options.eventBus.emit("guide:step-started", { step, stepIndex, totalSteps });
      }

      const context = await this.captureContext();
      const rawGuidance = await this.options.claudeClient.createGuideStepResponse({
        goal,
        step,
        stepIndex,
        totalSteps,
        capturedContext: context,
        isRecovery: recoveryAttempt > 0
      });
      const cleanedGuidance = cleanAssistantResponse(rawGuidance);
      this.options.appendAssistantMessage(cleanedGuidance.spokenText);
      this.options.overlayRoot.cursorOverlay.point(cleanedGuidance.pointCommand);

      if (this.options.shouldSpeak() && cleanedGuidance.spokenText) {
        await this.options.elevenLabsClient.speak(cleanedGuidance.spokenText);
      }

      this.options.stateMachine.setState("guide-step-watching");
      const completed = await this.waitForStepCompletion();
      if (completed) {
        this.options.eventBus.emit("guide:step-completed", { step });
        return true;
      }
    }

    return false;
  }

  private async captureContext(): Promise<ClickyCapturedContext> {
    return this.options.captureContext();
  }

  private async waitForStepCompletion(): Promise<boolean> {
    return new Promise((resolve) => {
      const timeoutId = window.setTimeout(() => {
        this.stepCompletedResolver = undefined;
        resolve(false);
      }, 15000);

      this.stepCompletedResolver = () => {
        window.clearTimeout(timeoutId);
        resolve(true);
      };
    });
  }
}
