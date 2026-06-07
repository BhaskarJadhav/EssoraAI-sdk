export class ElementHighlighter {
  private readonly highlightElement: HTMLElement;
  private readonly pulseElement: HTMLElement;

  constructor(private readonly rootElement: HTMLElement) {
    this.highlightElement = document.createElement("div");
    this.highlightElement.className = "clicky-element-highlight";
    this.pulseElement = document.createElement("div");
    this.pulseElement.className = "clicky-element-pulse";
    this.rootElement.append(this.highlightElement, this.pulseElement);
  }

  show(rect: DOMRect): void {
    this.applyRect(this.highlightElement, rect, 0);
    this.applyRect(this.pulseElement, rect, 6);
    this.highlightElement.classList.remove("is-lost");
    this.pulseElement.classList.remove("is-lost");
    this.highlightElement.classList.add("is-visible");
    this.pulseElement.classList.add("is-visible");
  }

  markTargetLost(): void {
    this.highlightElement.classList.add("is-lost", "is-visible");
    this.pulseElement.classList.remove("is-visible");
  }

  clear(): void {
    this.highlightElement.classList.remove("is-visible");
    this.pulseElement.classList.remove("is-visible");
    this.highlightElement.classList.remove("is-lost");
    this.pulseElement.classList.remove("is-lost");
  }

  destroy(): void {
    this.highlightElement.remove();
    this.pulseElement.remove();
  }

  private applyRect(element: HTMLElement, rect: DOMRect, outset: number): void {
    element.style.transform = `translate3d(${Math.round(rect.left - outset)}px, ${Math.round(rect.top - outset)}px, 0)`;
    element.style.width = `${Math.round(rect.width + outset * 2)}px`;
    element.style.height = `${Math.round(rect.height + outset * 2)}px`;
    element.style.borderRadius = `${Math.min(12, Math.max(6, Math.round(Math.min(rect.width, rect.height) / 8)))}px`;
  }
}
