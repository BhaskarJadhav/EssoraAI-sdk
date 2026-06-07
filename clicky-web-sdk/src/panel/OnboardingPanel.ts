export type OnboardingCheckName = "microphone" | "worker" | "ai" | "tts";
export type OnboardingCheckState = "pending" | "checking" | "pass" | "fail";

export type OnboardingPanelHandlers = {
  onRunChecks(): void;
  onDismiss(): void;
};

const checkLabels: Record<OnboardingCheckName, string> = {
  microphone: "Microphone permission",
  worker: "Worker health",
  ai: "AI response",
  tts: "Voice playback"
};

export class OnboardingPanel {
  readonly element: HTMLElement;
  private readonly statusElements = new Map<OnboardingCheckName, HTMLElement>();

  constructor(private readonly handlers: OnboardingPanelHandlers) {
    this.element = document.createElement("div");
    this.element.className = "clicky-onboarding";
    const titleElement = document.createElement("strong");
    titleElement.textContent = "Essora setup";
    const copyElement = document.createElement("p");
    copyElement.textContent = "Run a quick proof-of-life check before testing guidance.";
    const listElement = document.createElement("div");
    listElement.className = "clicky-onboarding-checks";

    for (const checkName of Object.keys(checkLabels) as OnboardingCheckName[]) {
      const rowElement = document.createElement("div");
      rowElement.className = "clicky-onboarding-check";
      const labelElement = document.createElement("span");
      labelElement.textContent = checkLabels[checkName];
      const statusElement = document.createElement("span");
      statusElement.textContent = "pending";
      statusElement.dataset.state = "pending";
      this.statusElements.set(checkName, statusElement);
      rowElement.append(labelElement, statusElement);
      listElement.append(rowElement);
    }

    const actionsElement = document.createElement("div");
    actionsElement.className = "clicky-onboarding-actions";
    const runButton = document.createElement("button");
    runButton.className = "clicky-button";
    runButton.type = "button";
    runButton.textContent = "Run checks";
    runButton.addEventListener("click", () => this.handlers.onRunChecks());
    const dismissButton = document.createElement("button");
    dismissButton.className = "clicky-button";
    dismissButton.type = "button";
    dismissButton.textContent = "Dismiss";
    dismissButton.addEventListener("click", () => this.handlers.onDismiss());
    actionsElement.append(runButton, dismissButton);
    this.element.append(titleElement, copyElement, listElement, actionsElement);
  }

  show(): void {
    this.element.classList.add("is-visible");
  }

  hide(): void {
    this.element.classList.remove("is-visible");
  }

  setCheckState(checkName: OnboardingCheckName, state: OnboardingCheckState, reason?: string): void {
    const statusElement = this.statusElements.get(checkName);
    if (!statusElement) {
      return;
    }
    statusElement.dataset.state = state;
    statusElement.textContent = reason ? `${state}: ${reason}` : state;
  }
}
