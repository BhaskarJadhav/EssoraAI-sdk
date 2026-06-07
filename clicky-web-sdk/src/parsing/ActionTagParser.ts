import type { ClickyParsedActionResult } from "../core/types";

const actionTagPattern = /\[ACTION:(none|([^:\]]+):(.+))\]\s*$/s;

export function parseActionTag(responseText: string): ClickyParsedActionResult {
  const match = responseText.match(actionTagPattern);
  if (!match) {
    return { cleanedText: responseText.trim() };
  }

  const cleanedText = responseText.slice(0, match.index).trim();
  if (match[1] === "none") {
    return { cleanedText };
  }

  const actionId = match[2];
  const payloadText = match[3];
  if (!actionId || !payloadText) {
    return { cleanedText };
  }

  try {
    const parameters = JSON.parse(payloadText) as Record<string, unknown>;
    return {
      cleanedText,
      proposedAction: {
        actionId,
        parameters
      }
    };
  } catch {
    return { cleanedText };
  }
}
