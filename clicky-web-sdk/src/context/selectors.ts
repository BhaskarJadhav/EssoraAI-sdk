const selectorEscape = (value: string): string => {
  if (typeof CSS !== "undefined" && CSS.escape) {
    return CSS.escape(value);
  }
  return value.replace(/["\\]/g, "\\$&");
};

export function createStableSelector(element: Element): string {
  if (element.id) {
    return `#${selectorEscape(element.id)}`;
  }

  const clickyLabel = element.getAttribute("data-clicky-label");
  if (clickyLabel) {
    return `[data-clicky-label="${selectorEscape(clickyLabel)}"]`;
  }

  const path: string[] = [];
  let currentElement: Element | null = element;

  while (currentElement && currentElement !== document.body && path.length < 5) {
    const tagName = currentElement.tagName.toLowerCase();
    const parentElement: Element | null = currentElement.parentElement;
    if (!parentElement) {
      path.unshift(tagName);
      break;
    }

    const sameTagSiblings: Element[] = Array.from(parentElement.children).filter(
      (siblingElement): siblingElement is Element => siblingElement.tagName === currentElement?.tagName
    );
    const siblingIndex = sameTagSiblings.indexOf(currentElement) + 1;
    path.unshift(sameTagSiblings.length > 1 ? `${tagName}:nth-of-type(${siblingIndex})` : tagName);
    currentElement = parentElement;
  }

  return path.join(" > ");
}
