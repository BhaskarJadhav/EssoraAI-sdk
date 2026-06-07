import type { ClickyCapturedContext, ClickyCapturedElement, ClickyPointCommand } from "./types";

const ignoredSearchTerms = new Set([
  "a",
  "an",
  "and",
  "are",
  "can",
  "click",
  "find",
  "for",
  "go",
  "help",
  "how",
  "i",
  "in",
  "is",
  "it",
  "me",
  "of",
  "on",
  "open",
  "please",
  "show",
  "the",
  "this",
  "to",
  "where"
]);

export class LocalGuidanceEngine {
  createPointCommand(userText: string, capturedContext: ClickyCapturedContext): ClickyPointCommand {
    const bestElement = this.findBestElement(userText, capturedContext.elements);
    if (!bestElement) {
      return { type: "none" };
    }

    const label = bestElement.label || bestElement.text || bestElement.tagName;
    return {
      type: "element",
      elementId: bestElement.id,
      label: this.truncateLabel(label)
    };
  }

  createFallbackResponse(userText: string, capturedContext: ClickyCapturedContext, originalError: Error): string {
    const bestElement = this.findBestElement(userText, capturedContext.elements);

    if (!bestElement) {
      return `I cannot reach the AI backend right now: ${originalError.message}. I can see this page locally, but I could not find a precise target for that request. [POINT:none] [ACTION:none]`;
    }

    const label = bestElement.label || bestElement.text || bestElement.tagName;
    return `I cannot reach the AI backend right now, but I can still inspect this page locally. The ${label} target is here. [POINT:${bestElement.id}:${this.truncateLabel(label)}] [ACTION:none]`;
  }

  private findBestElement(userText: string, elements: ClickyCapturedElement[]): ClickyCapturedElement | undefined {
    const searchTerms = this.extractSearchTerms(userText);
    if (searchTerms.length === 0) {
      return elements.find((element) => element.isInteractive) ?? elements[0];
    }

    let bestElement: ClickyCapturedElement | undefined;
    let bestScore = 0;

    for (const element of elements) {
      const searchableText = `${element.label} ${element.text} ${element.role ?? ""} ${element.tagName}`.toLowerCase();
      let score = 0;

      for (const searchTerm of searchTerms) {
        if (searchableText.includes(searchTerm)) {
          score += element.isInteractive ? 3 : 2;
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestElement = element;
      }
    }

    return bestElement;
  }

  private extractSearchTerms(userText: string): string[] {
    return userText
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .map((term) => term.trim())
      .filter((term) => term.length > 2 && !ignoredSearchTerms.has(term));
  }

  private truncateLabel(label: string): string {
    return label.split(/\s+/).slice(0, 3).join(" ");
  }
}
