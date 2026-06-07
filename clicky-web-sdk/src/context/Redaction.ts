import type { NormalizedClickyOptions } from "../core/types";

const defaultPrivateSelectors = [
  "input[type='password']",
  "input[type='hidden']",
  "[data-clicky-private]",
  "[data-private]",
  "[autocomplete='current-password']",
  "[autocomplete='new-password']",
  "[autocomplete='one-time-code']"
];

export class Redaction {
  private readonly privateSelectors: string[];
  private readonly ignoredSelectors: string[];

  constructor(private readonly options: NormalizedClickyOptions) {
    this.privateSelectors = [...defaultPrivateSelectors, ...options.privacy.privateSelectors];
    this.ignoredSelectors = ["[data-clicky-ignore]", ...options.privacy.ignoredSelectors];
  }

  shouldIgnoreElement(element: Element): boolean {
    return this.matchesAny(element, this.ignoredSelectors);
  }

  isPrivateElement(element: Element): boolean {
    return this.matchesAny(element, this.privateSelectors);
  }

  getSafeInputValue(element: Element): string {
    if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement)) {
      return "";
    }

    if (this.isPrivateElement(element)) {
      return "[redacted]";
    }

    if (!this.options.privacy.includeInputValues) {
      return "";
    }

    return element.value.slice(0, 500);
  }

  getSafeTextContent(element: Element): string {
    const clonedElement = element.cloneNode(true) as Element;
    const selectorsToRemove = [...this.ignoredSelectors, ...this.privateSelectors, "[aria-hidden='true']"];

    for (const selector of selectorsToRemove) {
      try {
        for (const matchingElement of Array.from(clonedElement.querySelectorAll(selector))) {
          matchingElement.remove();
        }
      } catch {
        // Invalid host-provided selectors are ignored during redaction.
      }
    }

    return (clonedElement.textContent ?? "").replace(/\s+/g, " ").trim();
  }

  private matchesAny(element: Element, selectors: string[]): boolean {
    return selectors.some((selector) => {
      try {
        return element.matches(selector) || !!element.closest(selector);
      } catch {
        return false;
      }
    });
  }
}
