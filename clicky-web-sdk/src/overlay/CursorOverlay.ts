import type { ClickyPointCommand } from "../core/types";
import { ElementRegistry } from "../context/ElementRegistry";
import { CursorAnimator } from "./CursorAnimator";
import { ElementHighlighter } from "./ElementHighlighter";
import { TargetLock } from "./TargetLock";

export class CursorOverlay {
  private readonly animator: CursorAnimator;
  private readonly highlighter: ElementHighlighter;
  private readonly targetLock: TargetLock;
  private lockedTargetLabel?: string;
  private hasStartedFlightToLockedTarget = false;

  constructor(
    private readonly rootElement: HTMLElement,
    private readonly elementRegistry: ElementRegistry,
    private readonly onTargetLost?: (reason: string) => void
  ) {
    const cursorElement = document.createElement("div");
    cursorElement.className = "clicky-cursor";
    const bubbleElement = document.createElement("div");
    bubbleElement.className = "clicky-response-bubble";
    this.rootElement.append(cursorElement, bubbleElement);
    this.animator = new CursorAnimator(cursorElement, bubbleElement);
    this.highlighter = new ElementHighlighter(rootElement);
    this.targetLock = new TargetLock(elementRegistry, {
      onBoundsChanged: (rect) => this.updateLockedTarget(rect),
      onTargetLost: (reason) => this.handleTargetLost(reason)
    });
  }

  point(command: ClickyPointCommand): boolean {
    this.targetLock.unlock();
    this.lockedTargetLabel = undefined;
    this.hasStartedFlightToLockedTarget = false;

    if (command.type === "none") {
      return false;
    }

    if (command.type === "coordinate") {
      this.highlighter.clear();
      this.animator.pointAt(command.x, command.y, command.label);
      return true;
    }

    const targetElement = this.elementRegistry.getElementById(command.elementId);
    if (!targetElement) {
      return false;
    }

    this.pointAtElement(targetElement, command.label, command.elementId);
    return true;
  }

  pointAtElement(targetElement: Element, label?: string, targetElementId?: string): void {
    this.lockedTargetLabel = label;
    this.hasStartedFlightToLockedTarget = false;
    this.targetLock.lock(targetElement, targetElementId);
  }

  scheduleHide(): void {
    this.animator.scheduleHide();
  }

  showTransient(): void {
    this.animator.showIdle();
  }

  destroy(): void {
    this.targetLock.unlock();
    this.highlighter.destroy();
  }

  private updateLockedTarget(rect: DOMRect): void {
    if (this.isRectOutsideViewport(rect)) {
      this.highlighter.clear();
      return;
    }

    this.highlighter.show(rect);
    const targetCenterX = rect.left + rect.width / 2;
    const targetCenterY = rect.top + rect.height / 2;

    if (!this.hasStartedFlightToLockedTarget) {
      this.hasStartedFlightToLockedTarget = true;
      this.animator.pointAt(targetCenterX, targetCenterY, this.lockedTargetLabel);
      return;
    }

    this.animator.updatePointingTarget(targetCenterX, targetCenterY, this.lockedTargetLabel);
  }

  private handleTargetLost(reason: string): void {
    this.highlighter.markTargetLost();
    this.onTargetLost?.(reason);
  }

  private isRectOutsideViewport(rect: DOMRect): boolean {
    return (
      rect.width <= 0 ||
      rect.height <= 0 ||
      rect.bottom < 0 ||
      rect.right < 0 ||
      rect.top > window.innerHeight ||
      rect.left > window.innerWidth
    );
  }
}
