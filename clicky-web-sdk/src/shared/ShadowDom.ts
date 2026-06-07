export type ShadowRootMount = {
  hostElement: HTMLElement;
  shadowRoot: ShadowRoot;
};

export function createShadowRootMount(mountElement: HTMLElement, hostClassName: string): ShadowRootMount {
  const hostElement = document.createElement("div");
  hostElement.className = hostClassName;
  mountElement.appendChild(hostElement);
  const shadowRoot = hostElement.attachShadow({ mode: "open" });

  return { hostElement, shadowRoot };
}
