export function removeElement(element: Element | undefined): void {
  if (element?.parentNode) {
    element.parentNode.removeChild(element);
  }
}

export function isVisibleElement(element: Element): boolean {
  if (!(element instanceof HTMLElement)) {
    return false;
  }

  const style = window.getComputedStyle(element);
  if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) {
    return false;
  }

  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

export function getElementText(element: Element): string {
  return (element.textContent ?? "").replace(/\s+/g, " ").trim();
}
