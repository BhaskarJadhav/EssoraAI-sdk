import { EventBus } from "../core/EventBus";
import type { NormalizedClickyOptions } from "../core/types";
import { createShadowRootMount, type ShadowRootMount } from "../shared/ShadowDom";
import { CompanionPanel, type CompanionPanelHandlers } from "./CompanionPanel";
import { createLauncherButton } from "./LauncherButton";
import { createPanelStyles } from "./panelStyles";

export class PanelRoot {
  private readonly mount: ShadowRootMount;
  private readonly rootElement: HTMLElement;
  private readonly launcherButton: HTMLButtonElement;
  readonly companionPanel: CompanionPanel;
  private isOpen = false;

  constructor(
    options: NormalizedClickyOptions,
    eventBus: EventBus,
    handlers: CompanionPanelHandlers
  ) {
    this.mount = createShadowRootMount(options.mountElement, "clicky-panel-host");
    const styleElement = document.createElement("style");
    styleElement.textContent = createPanelStyles(options);
    this.rootElement = document.createElement("div");
    this.rootElement.className = "clicky-panel-root";
    this.launcherButton = createLauncherButton();
    this.companionPanel = new CompanionPanel(options, handlers);
    this.rootElement.append(this.companionPanel.element, this.launcherButton);
    this.mount.shadowRoot.append(styleElement, this.rootElement);

    this.launcherButton.addEventListener("click", () => {
      this.setOpen(!this.isOpen);
    });

    eventBus.on("state:changed", ({ nextState }) => this.companionPanel.setState(nextState));
    eventBus.on("mic:level", ({ level }) => this.companionPanel.setMicLevel(level));
    eventBus.on("mic:silent", () => this.companionPanel.setMicHelp("we can't hear you yet - check your mic input."));
    eventBus.on("assistant:token", ({ fullText }) => this.companionPanel.updateStreamingAssistantMessage(fullText));
    eventBus.on("assistant:done", ({ spokenText }) => this.companionPanel.finishStreamingAssistantMessage(spokenText));
    eventBus.on("action:proposed", ({ action }) => this.companionPanel.showActionConfirmation(action.definition.name));
    eventBus.on("action:executed", ({ result }) => {
      this.companionPanel.hideActionConfirmation();
      this.companionPanel.appendMessage("assistant", result.message ?? (result.ok ? "Done." : "Action failed."));
    });
    eventBus.on("action:failed", ({ error }) => {
      this.companionPanel.hideActionConfirmation();
      this.companionPanel.appendMessage("assistant", error.message);
    });
    eventBus.on("error", ({ error }) => {
      if (/microphone|permission|notallowed/i.test(error.message)) {
        this.companionPanel.showPermissionHelp(error.message);
      }
    });
  }

  open(): void {
    this.setOpen(true);
  }

  close(): void {
    this.setOpen(false);
  }

  destroy(): void {
    this.mount.hostElement.remove();
  }

  private setOpen(isOpen: boolean): void {
    this.isOpen = isOpen;
    this.companionPanel.setOpen(isOpen);
  }
}
