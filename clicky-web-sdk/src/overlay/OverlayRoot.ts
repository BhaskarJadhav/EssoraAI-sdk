import type { NormalizedClickyOptions } from "../core/types";
import { ElementRegistry } from "../context/ElementRegistry";
import { createShadowRootMount, type ShadowRootMount } from "../shared/ShadowDom";
import { CursorOverlay } from "./CursorOverlay";
import { createOverlayStyles } from "./overlayStyles";

export class OverlayRoot {
  private readonly mount: ShadowRootMount;
  readonly cursorOverlay: CursorOverlay;

  constructor(
    options: NormalizedClickyOptions,
    elementRegistry: ElementRegistry,
    onTargetLost?: (reason: string) => void
  ) {
    this.mount = createShadowRootMount(options.mountElement, "clicky-overlay-host");
    const styleElement = document.createElement("style");
    styleElement.textContent = createOverlayStyles(options);
    const overlayElement = document.createElement("div");
    overlayElement.className = "clicky-overlay";
    this.mount.shadowRoot.append(styleElement, overlayElement);
    this.cursorOverlay = new CursorOverlay(overlayElement, elementRegistry, onTargetLost);
  }

  destroy(): void {
    this.cursorOverlay.destroy();
    this.mount.hostElement.remove();
  }
}
