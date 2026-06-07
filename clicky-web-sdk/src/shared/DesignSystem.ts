import type { NormalizedClickyOptions } from "../core/types";

export function createDesignSystemCss(options: NormalizedClickyOptions): string {
  return `
    :host {
      --clicky-accent: ${options.theme.accentColor};
      --clicky-panel-bg: ${options.theme.panelBackgroundColor};
      --clicky-text: ${options.theme.textColor};
      --clicky-muted: rgba(248, 251, 255, 0.66);
      --clicky-border: rgba(255, 255, 255, 0.12);
      --clicky-shadow: 0 20px 70px rgba(0, 0, 0, 0.36);
      --clicky-radius: 8px;
      --clicky-z-index: ${options.theme.zIndex};
      color: var(--clicky-text);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }

    button,
    input,
    textarea {
      font: inherit;
    }

    button {
      cursor: pointer;
    }
  `;
}
