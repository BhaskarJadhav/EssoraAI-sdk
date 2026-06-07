export class CursorAnimator {
  private static readonly transientHideDelayMs = 850;
  private static readonly pointingBobDurationMs = 1200;
  private hideTimeoutId?: number;
  private flightAnimationFrameId?: number;
  private pointingBobAnimationFrameId?: number;
  private currentPosition?: { x: number; y: number };
  private pointingBasePosition?: { x: number; y: number };
  private isFlyingToTarget = false;
  private readonly prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  constructor(
    private readonly cursorElement: HTMLElement,
    private readonly bubbleElement: HTMLElement
  ) {}

  pointAt(x: number, y: number, label?: string): void {
    const targetPosition = this.clampPosition(x, y);
    window.clearTimeout(this.hideTimeoutId);
    this.stopPointingBob();

    if (this.prefersReducedMotion.matches || !this.currentPosition) {
      this.setCursorTransform(targetPosition.x, targetPosition.y, -35, 1);
      this.showBubble(targetPosition.x, targetPosition.y, label);
      this.startPointingMode(targetPosition, label);
      return;
    }

    this.animateBezierFlight(this.currentPosition, targetPosition, () => {
      this.startPointingMode(targetPosition, label);
    });
  }

  showAt(x: number, y: number, label?: string): void {
    const clampedPosition = this.clampPosition(x, y);
    this.stopFlight();
    this.stopPointingBob();
    this.setCursorTransform(clampedPosition.x, clampedPosition.y, -35, 1);
    this.showBubble(clampedPosition.x, clampedPosition.y, label);
  }

  showIdle(): void {
    const fallbackPosition = this.currentPosition ?? {
      x: Math.max(28, Math.min(window.innerWidth - 28, 46)),
      y: Math.max(28, Math.min(window.innerHeight - 28, window.innerHeight - 64))
    };
    this.stopFlight();
    this.stopPointingBob();
    this.setCursorTransform(fallbackPosition.x, fallbackPosition.y, -35, 1);
  }

  updatePointingTarget(x: number, y: number, label?: string): void {
    if (this.isFlyingToTarget) {
      return;
    }

    const clampedPosition = this.clampPosition(x, y);
    this.pointingBasePosition = clampedPosition;
    this.currentPosition = clampedPosition;
    this.showBubble(clampedPosition.x, clampedPosition.y, label);
  }

  isNavigating(): boolean {
    return this.isFlyingToTarget;
  }

  hide(): void {
    window.clearTimeout(this.hideTimeoutId);
    this.stopFlight();
    this.stopPointingBob();
    this.cursorElement.classList.remove("is-visible");
    this.bubbleElement.classList.remove("is-visible");
  }

  scheduleHide(): void {
    window.clearTimeout(this.hideTimeoutId);
    this.hideTimeoutId = window.setTimeout(() => this.hide(), CursorAnimator.transientHideDelayMs);
  }

  private animateBezierFlight(
    startPosition: { x: number; y: number },
    targetPosition: { x: number; y: number },
    onComplete: () => void
  ): void {
    this.stopFlight();
    this.isFlyingToTarget = true;

    const deltaX = targetPosition.x - startPosition.x;
    const deltaY = targetPosition.y - startPosition.y;
    const distance = Math.hypot(deltaX, deltaY);
    const durationMs = Math.min(Math.max((distance / 800) * 1000, 600), 1400);
    const midpoint = {
      x: (startPosition.x + targetPosition.x) / 2,
      y: (startPosition.y + targetPosition.y) / 2
    };
    const controlPoint = {
      x: midpoint.x,
      y: midpoint.y - Math.min(distance * 0.4, 120)
    };
    const animationStartedAt = performance.now();

    const animateFrame = (frameStartedAt: number) => {
      const linearProgress = Math.min((frameStartedAt - animationStartedAt) / durationMs, 1);
      const easedProgress = this.easeInOut(linearProgress);
      const oneMinusProgress = 1 - easedProgress;
      const x =
        oneMinusProgress * oneMinusProgress * startPosition.x +
        2 * oneMinusProgress * easedProgress * controlPoint.x +
        easedProgress * easedProgress * targetPosition.x;
      const y =
        oneMinusProgress * oneMinusProgress * startPosition.y +
        2 * oneMinusProgress * easedProgress * controlPoint.y +
        easedProgress * easedProgress * targetPosition.y;
      const tangentX =
        2 * oneMinusProgress * (controlPoint.x - startPosition.x) +
        2 * easedProgress * (targetPosition.x - controlPoint.x);
      const tangentY =
        2 * oneMinusProgress * (controlPoint.y - startPosition.y) +
        2 * easedProgress * (targetPosition.y - controlPoint.y);
      const rotationDegrees = (Math.atan2(tangentY, tangentX) * 180) / Math.PI + 90;
      const scale = 1 + Math.sin(linearProgress * Math.PI) * 0.4;

      this.setCursorTransform(x, y, rotationDegrees, scale);
      this.showBubble(x, y, this.bubbleElement.textContent || undefined);

      if (linearProgress < 1) {
        this.flightAnimationFrameId = window.requestAnimationFrame(animateFrame);
        return;
      }

      this.flightAnimationFrameId = undefined;
      this.isFlyingToTarget = false;
      this.setCursorTransform(targetPosition.x, targetPosition.y, -35, 1);
      onComplete();
    };

    this.flightAnimationFrameId = window.requestAnimationFrame(animateFrame);
  }

  private startPointingMode(position: { x: number; y: number }, label?: string): void {
    this.pointingBasePosition = position;
    this.currentPosition = position;
    this.showBubble(position.x, position.y, label);

    const pointingStartedAt = performance.now();
    const animatePointingBob = (frameStartedAt: number) => {
      if (!this.pointingBasePosition) {
        this.pointingBobAnimationFrameId = undefined;
        return;
      }

      const phase = ((frameStartedAt - pointingStartedAt) / CursorAnimator.pointingBobDurationMs) * Math.PI * 2;
      const bobOffsetY = Math.sin(phase) * 4;
      this.setCursorTransform(this.pointingBasePosition.x, this.pointingBasePosition.y + bobOffsetY, -35, 1);
      this.showBubble(this.pointingBasePosition.x, this.pointingBasePosition.y + bobOffsetY, label);
      this.pointingBobAnimationFrameId = window.requestAnimationFrame(animatePointingBob);
    };

    this.pointingBobAnimationFrameId = window.requestAnimationFrame(animatePointingBob);
  }

  private setCursorTransform(x: number, y: number, rotationDegrees: number, scale: number): void {
    this.currentPosition = { x, y };
    this.cursorElement.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(${rotationDegrees}deg) scale(${scale})`;
    this.cursorElement.classList.add("is-visible");
  }

  private showBubble(x: number, y: number, label?: string): void {
    if (!label) {
      return;
    }

    this.bubbleElement.textContent = label;
    this.bubbleElement.style.transform = `translate3d(${Math.min(x + 22, window.innerWidth - 380)}px, ${Math.min(
      y + 18,
      window.innerHeight - 80
    )}px, 0)`;
    this.bubbleElement.classList.add("is-visible");
  }

  private clampPosition(x: number, y: number): { x: number; y: number } {
    return {
      x: Math.max(16, Math.min(window.innerWidth - 16, x)),
      y: Math.max(16, Math.min(window.innerHeight - 16, y))
    };
  }

  private easeInOut(progress: number): number {
    return progress * progress * (3 - 2 * progress);
  }

  private stopFlight(): void {
    if (this.flightAnimationFrameId !== undefined) {
      window.cancelAnimationFrame(this.flightAnimationFrameId);
      this.flightAnimationFrameId = undefined;
    }
    this.isFlyingToTarget = false;
  }

  private stopPointingBob(): void {
    if (this.pointingBobAnimationFrameId !== undefined) {
      window.cancelAnimationFrame(this.pointingBobAnimationFrameId);
      this.pointingBobAnimationFrameId = undefined;
    }
    this.pointingBasePosition = undefined;
  }
}
