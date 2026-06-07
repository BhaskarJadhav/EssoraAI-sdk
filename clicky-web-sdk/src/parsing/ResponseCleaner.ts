import { parseActionTag } from "./ActionTagParser";
import { parsePointTag } from "./PointTagParser";

export function cleanAssistantResponse(responseText: string) {
  const actionResult = parseActionTag(responseText);
  const pointResult = parsePointTag(actionResult.cleanedText);

  return {
    visibleText: pointResult.spokenText,
    spokenText: pointResult.spokenText,
    pointCommand: pointResult.pointCommand,
    proposedAction: actionResult.proposedAction
  };
}
