import type { ClickyCapturedElement } from "../core/types";

export type AccessibilitySummary = {
  interactiveElementCount: number;
  landmarkLabels: string[];
};

export function createAccessibilitySummary(elements: ClickyCapturedElement[]): AccessibilitySummary {
  return {
    interactiveElementCount: elements.filter((element) => element.isInteractive).length,
    landmarkLabels: elements
      .filter((element) => ["navigation", "main", "search", "banner", "contentinfo"].includes(element.role ?? ""))
      .map((element) => element.label || element.text)
      .filter(Boolean)
      .slice(0, 20)
  };
}
