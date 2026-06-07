import type { ClickyParsedPointResult, ClickyPointCommand } from "../core/types";

const pointTagPattern = /\[POINT:(none|(-?\d+)\s*,\s*(-?\d+)(?::([^\]]+))?|([^:\]]+)(?::([^\]]+))?)\]\s*$/;

export function parsePointTag(responseText: string): ClickyParsedPointResult {
  const match = responseText.match(pointTagPattern);
  if (!match) {
    return {
      spokenText: responseText.trim(),
      pointCommand: { type: "none" }
    };
  }

  const spokenText = responseText.slice(0, match.index).trim();
  const command = createPointCommand(match);

  return {
    spokenText,
    pointCommand: command
  };
}

function createPointCommand(match: RegExpMatchArray): ClickyPointCommand {
  if (match[1] === "none") {
    return { type: "none" };
  }

  const coordinateX = match[2];
  if (coordinateX) {
    return {
      type: "coordinate",
      x: Number(coordinateX),
      y: Number(match[3]),
      label: match[4]?.trim()
    };
  }

  const elementId = match[5];
  return {
    type: "element",
    elementId,
    label: match[6]?.trim()
  };
}
