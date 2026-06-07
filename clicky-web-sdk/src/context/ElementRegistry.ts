import { createUuid } from "../utils/uuid";

export class ElementRegistry {
  private readonly elementById = new Map<string, Element>();
  private readonly idByElement = new WeakMap<Element, string>();

  registerElement(element: Element, preferredElementId?: string): string {
    const existingId = this.idByElement.get(element);
    if (existingId) {
      if (preferredElementId && preferredElementId !== existingId) {
        this.elementById.set(preferredElementId, element);
        return preferredElementId;
      }
      this.elementById.set(existingId, element);
      this.applyElementDebugId(element, existingId);
      return existingId;
    }

    const elementId = preferredElementId ?? createUuid("clicky-element");
    this.idByElement.set(element, elementId);
    this.elementById.set(elementId, element);
    this.applyElementDebugId(element, elementId);
    return elementId;
  }

  getElementById(elementId: string): Element | undefined {
    return this.elementById.get(elementId);
  }

  clear(): void {
    this.elementById.clear();
  }

  private applyElementDebugId(element: Element, elementId: string): void {
    if (element instanceof HTMLElement) {
      element.dataset.clickyId = elementId;
    }
  }
}
