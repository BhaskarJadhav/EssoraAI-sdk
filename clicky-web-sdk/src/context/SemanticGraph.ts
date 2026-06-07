import type { ClickySemanticNode, NormalizedClickyOptions } from "../core/types";
import { isVisibleElement } from "../utils/dom";
import { ElementRegistry } from "./ElementRegistry";
import { Redaction } from "./Redaction";

const interactableSelector = [
  "a[href]",
  "button",
  "input",
  "textarea",
  "select",
  "summary",
  "[role='button']",
  "[role='link']",
  "[role='textbox']",
  "[role='checkbox']",
  "[role='radio']",
  "[role='switch']",
  "[role='menuitem']",
  "[role='tab']",
  "[tabindex]"
].join(",");

export class SemanticGraph {
  private readonly redaction: Redaction;

  constructor(
    private readonly options: NormalizedClickyOptions,
    private readonly elementRegistry: ElementRegistry
  ) {
    this.redaction = new Redaction(options);
  }

  build(): ClickySemanticNode[] {
    const candidateElements = Array.from(document.body.querySelectorAll("*"));
    const semanticNodes: ClickySemanticNode[] = [];
    const stableIdCounts = new Map<string, number>();

    for (const candidateElement of candidateElements) {
      if (this.redaction.shouldIgnoreElement(candidateElement) || !isVisibleElement(candidateElement)) {
        continue;
      }

      const semanticNode = this.createSemanticNode(candidateElement, stableIdCounts);
      if (!semanticNode.name && !semanticNode.interactable) {
        continue;
      }
      if (!this.isWithinContextWindow(semanticNode.bounds)) {
        continue;
      }

      this.elementRegistry.registerElement(candidateElement, semanticNode.stableId);
      semanticNodes.push(semanticNode);
    }

    return this.prioritizeNodes(semanticNodes);
  }

  private createSemanticNode(element: Element, stableIdCounts: Map<string, number>): ClickySemanticNode {
    const role = this.inferRole(element);
    const name = this.createAccessibleName(element);
    const region = this.findRegionName(element);
    const stableIdBase = this.createStableIdBase(role, name, region, element.tagName.toLowerCase());
    const duplicateCount = stableIdCounts.get(stableIdBase) ?? 0;
    stableIdCounts.set(stableIdBase, duplicateCount + 1);
    const stableId = duplicateCount === 0 ? stableIdBase : `${stableIdBase}-${duplicateCount + 1}`;
    const rect = element.getBoundingClientRect();
    const isHidden = element.hasAttribute("hidden") || element.getAttribute("aria-hidden") === "true";

    return {
      stableId,
      role,
      name,
      state: {
        disabled: this.isDisabled(element),
        hidden: isHidden,
        checked: this.getAriaOrNativeBoolean(element, "checked"),
        expanded: element.getAttribute("aria-expanded") === "true",
        selected: this.getAriaOrNativeBoolean(element, "selected"),
        required: this.getAriaOrNativeBoolean(element, "required")
      },
      region,
      formGroup: this.findFormGroupName(element),
      bounds: {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        visible: !isHidden && this.isRectInViewport(rect)
      },
      tagName: element.tagName.toLowerCase(),
      interactable: this.isInteractable(element)
    };
  }

  private createAccessibleName(element: Element): string {
    const ariaLabel = element.getAttribute("aria-label")?.trim();
    if (ariaLabel) {
      return ariaLabel;
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
      const explicitLabel = this.findExplicitLabel(element);
      if (explicitLabel) {
        return explicitLabel;
      }
      if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
        return element.placeholder || element.name || element.type;
      }
      return element.name || "select";
    }

    return this.redaction.getSafeTextContent(element).slice(0, 120);
  }

  private inferRole(element: Element): string {
    const explicitRole = element.getAttribute("role");
    if (explicitRole) {
      return explicitRole;
    }

    const tagName = element.tagName.toLowerCase();
    if (tagName === "a") {
      return "link";
    }
    if (tagName === "button" || tagName === "summary") {
      return "button";
    }
    if (tagName === "textarea") {
      return "textbox";
    }
    if (tagName === "select") {
      return "combobox";
    }
    if (tagName === "input") {
      return this.inferInputRole(element as HTMLInputElement);
    }
    if (/^h[1-6]$/.test(tagName)) {
      return "heading";
    }
    if (["main", "nav", "aside", "header", "footer", "section", "article", "form"].includes(tagName)) {
      return tagName;
    }

    return tagName;
  }

  private inferInputRole(inputElement: HTMLInputElement): string {
    if (["checkbox", "radio", "range", "button", "submit", "reset"].includes(inputElement.type)) {
      return inputElement.type === "submit" || inputElement.type === "reset" ? "button" : inputElement.type;
    }
    return "textbox";
  }

  private findRegionName(element: Element): string {
    const regionElement = element.closest(
      "main, nav, aside, header, footer, section, article, form, [role='main'], [role='navigation'], [role='region'], [role='dialog']"
    );
    if (!regionElement) {
      return document.title || "page";
    }

    const labelledRegion = regionElement.getAttribute("aria-label")?.trim();
    if (labelledRegion) {
      return labelledRegion;
    }

    const headingElement = regionElement.querySelector("h1, h2, h3, h4, h5, h6");
    return headingElement?.textContent?.replace(/\s+/g, " ").trim().slice(0, 120) || regionElement.tagName.toLowerCase();
  }

  private findFormGroupName(element: Element): string | null {
    const fieldsetElement = element.closest("fieldset");
    const legendText = fieldsetElement?.querySelector("legend")?.textContent?.replace(/\s+/g, " ").trim();
    if (legendText) {
      return legendText;
    }

    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) {
      return this.findExplicitLabel(element);
    }

    return null;
  }

  private findExplicitLabel(element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement): string | null {
    if (!element.id) {
      return element.closest("label")?.textContent?.replace(/\s+/g, " ").trim() || null;
    }

    const escapedElementId = typeof CSS !== "undefined" && CSS.escape ? CSS.escape(element.id) : element.id.replace(/["\\]/g, "\\$&");
    return document.querySelector(`label[for="${escapedElementId}"]`)?.textContent?.replace(/\s+/g, " ").trim() || null;
  }

  private isInteractable(element: Element): boolean {
    if (!(element instanceof HTMLElement)) {
      return false;
    }
    return element.matches(interactableSelector) && !this.isDisabled(element);
  }

  private isDisabled(element: Element): boolean {
    return (
      element.hasAttribute("disabled") ||
      element.getAttribute("aria-disabled") === "true" ||
      !!element.closest("[disabled], [aria-disabled='true']")
    );
  }

  private getAriaOrNativeBoolean(element: Element, name: "checked" | "selected" | "required"): boolean {
    const ariaValue = element.getAttribute(`aria-${name}`);
    if (ariaValue) {
      return ariaValue === "true";
    }
    return name in element && Boolean((element as unknown as Record<string, unknown>)[name]);
  }

  private createStableIdBase(role: string, name: string, region: string, tagName: string): string {
    const source = `${role}|${name}|${region}|${tagName}`.toLowerCase();
    return `essora-${this.slugify(role)}-${this.slugify(name || tagName)}-${this.hashString(source)}`;
  }

  private slugify(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 36) || "node";
  }

  private hashString(value: string): string {
    let hash = 0;
    for (let index = 0; index < value.length; index += 1) {
      hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
    }
    return hash.toString(36);
  }

  private isWithinContextWindow(bounds: ClickySemanticNode["bounds"]): boolean {
    const viewportHeight = Math.max(window.innerHeight, 1);
    return bounds.y > -viewportHeight * 2 && bounds.y < viewportHeight * 3;
  }

  private isRectInViewport(rect: DOMRect): boolean {
    return rect.bottom >= 0 && rect.right >= 0 && rect.top <= window.innerHeight && rect.left <= window.innerWidth;
  }

  private prioritizeNodes(nodes: ClickySemanticNode[]): ClickySemanticNode[] {
    return nodes
      .sort((leftNode, rightNode) => {
        if (leftNode.interactable !== rightNode.interactable) {
          return leftNode.interactable ? -1 : 1;
        }
        return this.distanceFromViewportCenter(leftNode) - this.distanceFromViewportCenter(rightNode);
      })
      .slice(0, 120);
  }

  private distanceFromViewportCenter(node: ClickySemanticNode): number {
    const nodeCenterX = node.bounds.x + node.bounds.width / 2;
    const nodeCenterY = node.bounds.y + node.bounds.height / 2;
    return Math.hypot(nodeCenterX - window.innerWidth / 2, nodeCenterY - window.innerHeight / 2);
  }
}
