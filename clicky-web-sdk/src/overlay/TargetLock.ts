import { ElementRegistry } from "../context/ElementRegistry";

export type TargetLockCallbacks = {
  onBoundsChanged(rect: DOMRect): void;
  onTargetLost(reason: string): void;
};

export class TargetLock {
  private targetElement?: Element;
  private targetElementId?: string;
  private resizeObserver?: ResizeObserver;
  private intersectionObserver?: IntersectionObserver;
  private mutationObserver?: MutationObserver;
  private cleanupCallbacks: Array<() => void> = [];
  private routeRecoveryTimeoutId?: number;
  private activeLockIntervalId?: number;
  private originalPushState?: History["pushState"];
  private originalReplaceState?: History["replaceState"];
  private hasReportedTargetLost = false;

  constructor(
    private readonly elementRegistry: ElementRegistry,
    private readonly callbacks: TargetLockCallbacks
  ) {}

  lock(targetElement: Element, targetElementId?: string): void {
    this.unlock();
    this.hasReportedTargetLost = false;
    this.targetElement = targetElement;
    this.targetElementId = targetElementId;
    this.installResizeObserver(targetElement);
    this.installIntersectionObserver(targetElement);
    this.installMutationObserver();
    this.installScrollListeners(targetElement);
    this.installRouteListeners();
    this.installActiveLockSampler();
    this.emitCurrentBounds();
  }

  unlock(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = undefined;
    this.intersectionObserver?.disconnect();
    this.intersectionObserver = undefined;
    this.mutationObserver?.disconnect();
    this.mutationObserver = undefined;
    for (const cleanupCallback of this.cleanupCallbacks.splice(0)) {
      cleanupCallback();
    }
    window.clearTimeout(this.routeRecoveryTimeoutId);
    this.routeRecoveryTimeoutId = undefined;
    window.clearInterval(this.activeLockIntervalId);
    this.activeLockIntervalId = undefined;
    this.restoreHistoryMethods();
    this.targetElement = undefined;
    this.targetElementId = undefined;
    this.hasReportedTargetLost = false;
  }

  isLocked(): boolean {
    return !!this.targetElement?.isConnected;
  }

  currentRect(): DOMRect | undefined {
    if (!this.targetElement?.isConnected) {
      return undefined;
    }

    return this.targetElement.getBoundingClientRect();
  }

  private installResizeObserver(targetElement: Element): void {
    if (!("ResizeObserver" in window)) {
      return;
    }

    this.resizeObserver = new ResizeObserver(() => this.emitCurrentBounds());
    this.resizeObserver.observe(targetElement);
    this.resizeObserver.observe(document.documentElement);
  }

  private installIntersectionObserver(targetElement: Element): void {
    if (!("IntersectionObserver" in window)) {
      return;
    }

    this.intersectionObserver = new IntersectionObserver((entries) => {
      const targetEntry = entries[0];
      if (!targetEntry?.isIntersecting) {
        this.reportTargetLost("target outside viewport");
      }
    });
    this.intersectionObserver.observe(targetElement);
  }

  private installMutationObserver(): void {
    if (!("MutationObserver" in window)) {
      return;
    }

    this.mutationObserver = new MutationObserver(() => {
      if (!this.targetElement?.isConnected) {
        this.mutationObserver?.disconnect();
        this.mutationObserver = undefined;
        this.reportTargetLost("target disconnected");
      }
    });
    this.mutationObserver.observe(document.body, { childList: true, subtree: true });
  }

  private installScrollListeners(targetElement: Element): void {
    const scrollHandler = () => this.emitCurrentBounds();
    window.addEventListener("scroll", scrollHandler, { capture: true, passive: true });
    this.cleanupCallbacks.push(() => window.removeEventListener("scroll", scrollHandler, { capture: true }));

    for (const scrollableAncestor of this.findScrollableAncestors(targetElement)) {
      scrollableAncestor.addEventListener("scroll", scrollHandler, { passive: true });
      this.cleanupCallbacks.push(() => scrollableAncestor.removeEventListener("scroll", scrollHandler));
    }

    const resizeHandler = () => {
      this.emitCurrentBounds();
      window.requestAnimationFrame(() => this.emitCurrentBounds());
      window.setTimeout(() => this.emitCurrentBounds(), 80);
    };
    window.addEventListener("resize", resizeHandler);
    this.cleanupCallbacks.push(() => window.removeEventListener("resize", resizeHandler));
    window.visualViewport?.addEventListener("resize", resizeHandler);
    this.cleanupCallbacks.push(() => window.visualViewport?.removeEventListener("resize", resizeHandler));
  }

  private installRouteListeners(): void {
    const routeHandler = () => this.recoverAfterRouteChange();
    window.addEventListener("popstate", routeHandler);
    this.cleanupCallbacks.push(() => window.removeEventListener("popstate", routeHandler));

    this.originalPushState = history.pushState;
    this.originalReplaceState = history.replaceState;

    history.pushState = ((...args: Parameters<History["pushState"]>) => {
      this.originalPushState?.apply(history, args);
      routeHandler();
    }) as History["pushState"];

    history.replaceState = ((...args: Parameters<History["replaceState"]>) => {
      this.originalReplaceState?.apply(history, args);
      routeHandler();
    }) as History["replaceState"];
  }

  private installActiveLockSampler(): void {
    this.activeLockIntervalId = window.setInterval(() => this.emitCurrentBounds(), 100);
  }

  private restoreHistoryMethods(): void {
    if (this.originalPushState) {
      history.pushState = this.originalPushState;
      this.originalPushState = undefined;
    }
    if (this.originalReplaceState) {
      history.replaceState = this.originalReplaceState;
      this.originalReplaceState = undefined;
    }
  }

  private recoverAfterRouteChange(): void {
    if (!this.targetElementId) {
      this.reportTargetLost("route changed");
      return;
    }

    const recoveryStartedAt = performance.now();
    const tryRecoverTarget = () => {
      const recoveredElement = this.elementRegistry.getElementById(this.targetElementId!);
      if (recoveredElement?.isConnected) {
        this.lock(recoveredElement, this.targetElementId);
        return;
      }

      if (performance.now() - recoveryStartedAt >= 2000) {
        this.reportTargetLost("target missing after route change");
        return;
      }

      this.routeRecoveryTimeoutId = window.setTimeout(tryRecoverTarget, 100);
    };

    tryRecoverTarget();
  }

  private emitCurrentBounds(): void {
    const rect = this.currentRect();
    if (!rect) {
      this.reportTargetLost("target disconnected");
      return;
    }

    this.callbacks.onBoundsChanged(rect);
  }

  private reportTargetLost(reason: string): void {
    if (this.hasReportedTargetLost) {
      return;
    }
    this.hasReportedTargetLost = true;
    this.callbacks.onTargetLost(reason);
  }

  private findScrollableAncestors(targetElement: Element): Element[] {
    const scrollableAncestors: Element[] = [];
    let currentElement = targetElement.parentElement;

    while (currentElement && currentElement !== document.body) {
      const computedStyle = window.getComputedStyle(currentElement);
      const overflowValue = `${computedStyle.overflow} ${computedStyle.overflowX} ${computedStyle.overflowY}`;
      if (/(auto|scroll|overlay)/.test(overflowValue)) {
        scrollableAncestors.push(currentElement);
      }
      currentElement = currentElement.parentElement;
    }

    return scrollableAncestors;
  }
}
