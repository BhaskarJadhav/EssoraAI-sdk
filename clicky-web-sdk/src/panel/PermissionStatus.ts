export function createPermissionStatus(): HTMLElement {
  const element = document.createElement("div");
  element.className = "clicky-state";
  element.textContent = "Ready";
  return element;
}
