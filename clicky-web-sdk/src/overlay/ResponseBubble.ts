export function createResponseBubble(): HTMLElement {
  const bubbleElement = document.createElement("div");
  bubbleElement.className = "clicky-response-bubble";
  return bubbleElement;
}
