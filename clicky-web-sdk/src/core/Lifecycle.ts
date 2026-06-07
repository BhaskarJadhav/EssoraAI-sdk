export class Lifecycle {
  private readonly cleanupCallbacks: Array<() => void | Promise<void>> = [];
  private hasDestroyed = false;

  add(cleanupCallback: () => void | Promise<void>): void {
    if (this.hasDestroyed) {
      void cleanupCallback();
      return;
    }
    this.cleanupCallbacks.push(cleanupCallback);
  }

  async destroy(): Promise<void> {
    if (this.hasDestroyed) {
      return;
    }
    this.hasDestroyed = true;

    const callbacks = this.cleanupCallbacks.splice(0).reverse();
    for (const cleanupCallback of callbacks) {
      await cleanupCallback();
    }
  }
}
