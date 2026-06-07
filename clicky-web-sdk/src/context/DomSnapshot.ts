import type { ClickyCapturedElement, ClickyRect, NormalizedClickyOptions } from "../core/types";
import { isVisibleElement } from "../utils/dom";
import { ElementRegistry } from "./ElementRegistry";
import { Redaction } from "./Redaction";
import { createStableSelector } from "./selectors";

const contextSelector = [
  "a",
  "button",
  "input",
  "textarea",
  "select",
  "summary",
  "[role]",
  "[aria-label]",
  "[data-clicky-label]",
  "[data-clicky-context]",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "label",
  "th",
  "td"
].join(",");

export type DomSnapshotResult = {
  elements: ClickyCapturedElement[];
  pageText: string;
};

export class DomSnapshot {
  private readonly redaction: Redaction;

  constructor(
    private readonly options: NormalizedClickyOptions,
    private readonly elementRegistry: ElementRegistry
  ) {
    this.redaction = new Redaction(options);
  }

  capture(): DomSnapshotResult {
    this.elementRegistry.clear();

    const candidateElements = Array.from(document.body.querySelectorAll(contextSelector));
    const capturedElements: ClickyCapturedElement[] = [];
    const pageTextParts: string[] = [];

    for (const candidateElement of candidateElements) {
      if (capturedElements.length >= 220) {
        break;
      }

      if (this.redaction.shouldIgnoreElement(candidateElement) || !isVisibleElement(candidateElement)) {
        continue;
      }

      const label = this.createLabel(candidateElement);
      const text = this.createElementText(candidateElement);
      if (!label && !text) {
        continue;
      }

      const bounds = this.createBounds(candidateElement);
      const id = this.elementRegistry.registerElement(candidateElement);
      const capturedElement: ClickyCapturedElement = {
        id,
        tagName: candidateElement.tagName.toLowerCase(),
        role: candidateElement.getAttribute("role") ?? undefined,
        label,
        text,
        selector: createStableSelector(candidateElement),
        bounds,
        isInteractive: this.isInteractive(candidateElement)
      };

      capturedElements.push(capturedElement);
      pageTextParts.push([label, text].filter(Boolean).join(": "));
    }

    return {
      elements: capturedElements,
      pageText: pageTextParts.join("\n").slice(0, 12000)
    };
  }

  private createLabel(element: Element): string {
    const explicitClickyLabel = element.getAttribute("data-clicky-label");
    if (explicitClickyLabel) {
      return explicitClickyLabel.trim();
    }

    const ariaLabel = element.getAttribute("aria-label");
    if (ariaLabel) {
      return ariaLabel.trim();
    }

    const labelledBy = element.getAttribute("aria-labelledby");
    if (labelledBy) {
      const labelText = labelledBy
        .split(/\s+/)
        .map((id) => document.getElementById(id)?.textContent?.trim())
        .filter(Boolean)
        .join(" ");
      if (labelText) {
        return labelText;
      }
    }

    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) {
      const escapedElementId =
        element.id && typeof CSS !== "undefined" && CSS.escape ? CSS.escape(element.id) : element.id.replace(/["\\]/g, "\\$&");
      const labelElement = element.id ? document.querySelector(`label[for="${escapedElementId}"]`) : undefined;
      if (labelElement?.textContent) {
        return labelElement.textContent.trim();
      }
      if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
        return element.placeholder || element.name || (element instanceof HTMLInputElement ? element.type : "textarea");
      }
      return element.name || "select";
    }

    return "";
  }

  private createElementText(element: Element): string {
    if (this.redaction.isPrivateElement(element)) {
      return "[redacted]";
    }

    const inputValue = this.redaction.getSafeInputValue(element);
    const elementText = this.redaction.getSafeTextContent(element);
    const clickyContext = element.getAttribute("data-clicky-context") ?? "";

    return [clickyContext, elementText, inputValue].filter(Boolean).join(" ").slice(0, 600);
  }

  private createBounds(element: Element): ClickyRect {
    const rect = element.getBoundingClientRect();
    return {
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      width: Math.round(rect.width),
      height: Math.round(rect.height)
    };
  }

  private isInteractive(element: Element): boolean {
    const tagName = element.tagName.toLowerCase();
    return (
      ["a", "button", "input", "textarea", "select", "summary"].includes(tagName) ||
      ["button", "link", "textbox", "checkbox", "radio", "switch", "menuitem", "tab"].includes(element.getAttribute("role") ?? "")
    );
  }
}
