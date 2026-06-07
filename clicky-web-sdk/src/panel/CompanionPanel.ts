import { availableModels, availableTtsVoices } from "../core/Config";
import type { ClickyRuntimeSettings, ClickyState, NormalizedClickyOptions } from "../core/types";
import { createMicButton } from "./MicButton";
import { OnboardingPanel, type OnboardingCheckName, type OnboardingCheckState } from "./OnboardingPanel";
import { createPermissionStatus } from "./PermissionStatus";

export type CompanionPanelHandlers = {
  onSendText(text: string): void;
  onStartTalk(): void;
  onStopTalk(): void;
  onConfirmAction(): void;
  onRejectAction(): void;
  onUpdateSettings(settings: ClickyRuntimeSettings): void;
  onRunOnboardingChecks(): void;
  onDismissOnboarding(): void;
  onCaptureScreenshot(): void;
};

export class CompanionPanel {
  readonly element: HTMLElement;
  readonly micButton: HTMLButtonElement;
  readonly onboardingPanel: OnboardingPanel;
  private readonly stateElement: HTMLElement;
  private readonly threadElement: HTMLElement;
  private readonly inputElement: HTMLInputElement;
  private readonly confirmElement: HTMLElement;
  private readonly micHelpElement: HTMLElement;
  private readonly settingsElement: HTMLElement;
  private readonly screenshotPreviewElement: HTMLElement;

  constructor(
    private readonly options: NormalizedClickyOptions,
    private readonly handlers: CompanionPanelHandlers
  ) {
    this.element = document.createElement("section");
    this.element.className = "clicky-panel";

    const headerElement = document.createElement("header");
    headerElement.className = "clicky-panel-header";
    const titleElement = document.createElement("div");
    titleElement.className = "clicky-title";
    titleElement.textContent = "Clicky";
    this.stateElement = createPermissionStatus();
    const settingsToggleButton = document.createElement("button");
    settingsToggleButton.className = "clicky-icon-button";
    settingsToggleButton.type = "button";
    settingsToggleButton.title = "Settings";
    settingsToggleButton.textContent = "Settings";
    const screenshotButton = document.createElement("button");
    screenshotButton.className = "clicky-icon-button";
    screenshotButton.type = "button";
    screenshotButton.title = "Attach screenshot to next request";
    screenshotButton.textContent = "Shot";
    screenshotButton.hidden = this.options.screenshotMode === "off";
    screenshotButton.addEventListener("click", () => this.handlers.onCaptureScreenshot());
    headerElement.append(titleElement, screenshotButton, settingsToggleButton, this.stateElement);

    this.threadElement = document.createElement("div");
    this.threadElement.className = "clicky-thread";
    this.threadElement.innerHTML = `<p class="clicky-message clicky-message-assistant">Ask about this page, or hold ctrl + option while the page is focused.</p>`;

    this.confirmElement = this.createConfirmElement();
    this.micHelpElement = document.createElement("div");
    this.micHelpElement.className = "clicky-mic-help";
    this.settingsElement = this.createSettingsElement();
    this.onboardingPanel = new OnboardingPanel({
      onRunChecks: () => this.handlers.onRunOnboardingChecks(),
      onDismiss: () => this.handlers.onDismissOnboarding()
    });
    this.screenshotPreviewElement = document.createElement("div");
    this.screenshotPreviewElement.className = "clicky-screenshot-preview";
    settingsToggleButton.addEventListener("click", () => this.settingsElement.classList.toggle("is-visible"));

    const footerElement = document.createElement("footer");
    footerElement.className = "clicky-panel-footer";
    const inputRow = document.createElement("form");
    inputRow.className = "clicky-input-row";
    this.inputElement = document.createElement("input");
    this.inputElement.className = "clicky-input";
    this.inputElement.placeholder = "Ask Clicky";
    this.micButton = createMicButton();
    const sendButton = document.createElement("button");
    sendButton.className = "clicky-button";
    sendButton.type = "submit";
    sendButton.textContent = "Send";
    inputRow.append(this.inputElement, this.micButton, sendButton);
    footerElement.append(this.micHelpElement, inputRow);

    inputRow.addEventListener("submit", (event) => {
      event.preventDefault();
      const text = this.inputElement.value.trim();
      if (!text) {
        return;
      }
      this.inputElement.value = "";
      this.handlers.onSendText(text);
    });

    this.micButton.addEventListener("pointerdown", () => this.handlers.onStartTalk());
    this.micButton.addEventListener("pointerup", () => this.handlers.onStopTalk());
    this.micButton.addEventListener("pointercancel", () => this.handlers.onStopTalk());

    this.element.append(
      headerElement,
      this.settingsElement,
      this.onboardingPanel.element,
      this.screenshotPreviewElement,
      this.threadElement,
      this.confirmElement,
      footerElement
    );
  }

  setOpen(isOpen: boolean): void {
    this.element.classList.toggle("is-open", isOpen);
  }

  setState(state: ClickyState): void {
    this.stateElement.textContent = state;
    this.micButton.classList.toggle("is-listening", state === "listening");
    if (state !== "listening") {
      this.setMicLevel(0);
      this.setMicHelp("");
    }
  }

  setMicLevel(level: number): void {
    const bars = Array.from(this.micButton.querySelectorAll<HTMLElement>(".clicky-waveform span"));
    const barProfile = [0.45, 0.75, 1, 0.75, 0.45];
    for (const [barIndex, barElement] of bars.entries()) {
      const height = 4 + Math.round(Math.max(0.08, level) * 18 * (barProfile[barIndex] ?? 1));
      barElement.style.height = `${height}px`;
    }
  }

  setMicHelp(message: string): void {
    this.micHelpElement.textContent = message;
    this.micHelpElement.classList.toggle("is-visible", !!message);
  }

  showPermissionHelp(errorMessage: string): void {
    const browserName = this.detectBrowserName();
    const instruction =
      browserName === "Chrome"
        ? "click the site icon in the address bar, allow microphone, then reload."
        : "allow microphone for this site in your browser permissions, then reload.";
    this.setMicHelp(`${errorMessage} ${instruction}`);
  }

  setSettings(settings: Required<ClickyRuntimeSettings>): void {
    this.setSelectValue("model", settings.model);
    this.setSelectValue("voiceProvider", settings.voiceProvider);
    this.setSelectValue("ttsProvider", settings.ttsProvider);
    this.setSelectValue("ttsVoice", settings.ttsVoice);
  }

  setOnboardingCheckState(checkName: OnboardingCheckName, state: OnboardingCheckState, reason?: string): void {
    this.onboardingPanel.setCheckState(checkName, state, reason);
  }

  showScreenshotPreview(width: number, height: number): void {
    this.screenshotPreviewElement.textContent = `screenshot attached to next request (${width}x${height})`;
    this.screenshotPreviewElement.classList.add("is-visible");
  }

  clearScreenshotPreview(): void {
    this.screenshotPreviewElement.textContent = "";
    this.screenshotPreviewElement.classList.remove("is-visible");
  }

  appendMessage(role: "user" | "assistant", text: string): void {
    const messageElement = document.createElement("p");
    messageElement.className = `clicky-message clicky-message-${role}`;
    messageElement.textContent = `${role === "user" ? "You" : "Clicky"}: ${text}`;
    this.threadElement.appendChild(messageElement);
    this.threadElement.scrollTop = this.threadElement.scrollHeight;
  }

  updateStreamingAssistantMessage(text: string): void {
    let messageElement = this.threadElement.querySelector<HTMLElement>("[data-clicky-streaming-message='true']");
    if (!messageElement) {
      messageElement = document.createElement("p");
      messageElement.dataset.clickyStreamingMessage = "true";
      messageElement.className = "clicky-message clicky-message-assistant";
      this.threadElement.appendChild(messageElement);
    }
    messageElement.textContent = `Clicky: ${text}`;
    this.threadElement.scrollTop = this.threadElement.scrollHeight;
  }

  finishStreamingAssistantMessage(text: string): void {
    const messageElement = this.threadElement.querySelector<HTMLElement>("[data-clicky-streaming-message='true']");
    if (messageElement) {
      delete messageElement.dataset.clickyStreamingMessage;
      messageElement.textContent = `Clicky: ${text}`;
    } else {
      this.appendMessage("assistant", text);
    }
  }

  showActionConfirmation(actionName: string): void {
    this.confirmElement.querySelector("[data-clicky-confirm-text]")!.textContent = `Run action: ${actionName}?`;
    this.confirmElement.classList.add("is-visible");
  }

  hideActionConfirmation(): void {
    this.confirmElement.classList.remove("is-visible");
  }

  private createConfirmElement(): HTMLElement {
    const confirmElement = document.createElement("div");
    confirmElement.className = "clicky-confirm";
    const textElement = document.createElement("span");
    textElement.dataset.clickyConfirmText = "true";
    const confirmButton = document.createElement("button");
    confirmButton.className = "clicky-button";
    confirmButton.type = "button";
    confirmButton.textContent = "Run";
    const rejectButton = document.createElement("button");
    rejectButton.className = "clicky-button";
    rejectButton.type = "button";
    rejectButton.textContent = "Cancel";
    confirmButton.addEventListener("click", () => this.handlers.onConfirmAction());
    rejectButton.addEventListener("click", () => this.handlers.onRejectAction());
    confirmElement.append(textElement, confirmButton, rejectButton);
    return confirmElement;
  }

  private createSettingsElement(): HTMLElement {
    const settingsElement = document.createElement("div");
    settingsElement.className = "clicky-settings";
    settingsElement.append(
      this.createSelectField("Model", "model", availableModels, this.options.model),
      this.createSelectField(
        "Voice input",
        "voiceProvider",
        [
          { id: "google", label: "Google" },
          { id: "deepgram", label: "Deepgram" },
          { id: "assemblyai", label: "AssemblyAI" }
        ],
        this.options.voiceProvider
      ),
      this.createSelectField(
        "Voice output",
        "ttsProvider",
        [
          { id: "google", label: "Google" },
          { id: "elevenlabs", label: "ElevenLabs" }
        ],
        this.options.ttsProvider
      ),
      this.createSelectField("Voice", "ttsVoice", availableTtsVoices, this.options.ttsVoice)
    );
    return settingsElement;
  }

  private createSelectField(
    label: string,
    settingName: keyof Required<ClickyRuntimeSettings>,
    options: Array<{ id: string; label: string }>,
    selectedValue: string
  ): HTMLElement {
    const fieldElement = document.createElement("label");
    fieldElement.className = "clicky-settings-field";
    const labelElement = document.createElement("span");
    labelElement.textContent = label;
    const selectElement = document.createElement("select");
    selectElement.dataset.clickySetting = settingName;
    for (const option of options) {
      const optionElement = document.createElement("option");
      optionElement.value = option.id;
      optionElement.textContent = option.label;
      optionElement.selected = option.id === selectedValue;
      selectElement.append(optionElement);
    }
    selectElement.addEventListener("change", () => {
      this.handlers.onUpdateSettings({ [settingName]: selectElement.value });
    });
    fieldElement.append(labelElement, selectElement);
    return fieldElement;
  }

  private setSelectValue(settingName: keyof Required<ClickyRuntimeSettings>, value: string): void {
    const selectElement = this.settingsElement.querySelector<HTMLSelectElement>(`[data-clicky-setting="${settingName}"]`);
    if (selectElement) {
      selectElement.value = value;
    }
  }

  private detectBrowserName(): string {
    const userAgent = navigator.userAgent;
    if (userAgent.includes("Firefox")) {
      return "Firefox";
    }
    if (userAgent.includes("Safari") && !userAgent.includes("Chrome")) {
      return "Safari";
    }
    return "Chrome";
  }
}
