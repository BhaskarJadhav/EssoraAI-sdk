export function createLauncherButton(): HTMLButtonElement {
  const button = document.createElement("button");
  button.className = "clicky-launcher";
  button.type = "button";
  button.title = "Open Clicky";
  button.textContent = "C";
  return button;
}
