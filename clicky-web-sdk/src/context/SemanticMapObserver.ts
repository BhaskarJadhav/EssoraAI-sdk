import { debounce } from "../utils/time";

export type SemanticMapObserverHandler = () => void;

export class SemanticMapObserver {
  private mutationObserver?: MutationObserver;
  private cleanupCallbacks: Array<() => void> = [];

  constructor(private readonly onChanged: SemanticMapObserverHandler) {}

  start(): void {
    if (this.mutationObserver) {
      return;
    }

    const debouncedChangeHandler = debounce(() => this.onChanged(), 120);
    this.mutationObserver = new MutationObserver(() => debouncedChangeHandler());
    this.mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["aria-label", "role", "disabled", "hidden", "style", "class", "data-clicky-label"]
    });

    const scrollHandler = () => debouncedChangeHandler();
    const resizeHandler = () => debouncedChangeHandler();
    const routeHandler = () => debouncedChangeHandler();
    window.addEventListener("scroll", scrollHandler, true);
    window.addEventListener("resize", resizeHandler);
    window.addEventListener("popstate", routeHandler);
    this.cleanupCallbacks = [
      () => window.removeEventListener("scroll", scrollHandler, true),
      () => window.removeEventListener("resize", resizeHandler),
      () => window.removeEventListener("popstate", routeHandler)
    ];
  }

  stop(): void {
    this.mutationObserver?.disconnect();
    this.mutationObserver = undefined;
    for (const cleanupCallback of this.cleanupCallbacks.splice(0)) {
      cleanupCallback();
    }
  }
}
