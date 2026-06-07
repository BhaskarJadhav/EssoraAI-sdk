import type { NormalizedClickyOptions } from "../core/types";
import { createDesignSystemCss } from "../shared/DesignSystem";

export function createOverlayStyles(options: NormalizedClickyOptions): string {
  return `
    ${createDesignSystemCss(options)}

    .clicky-overlay {
      position: fixed;
      inset: 0;
      z-index: var(--clicky-z-index);
      pointer-events: none;
      overflow: hidden;
    }

    .clicky-cursor {
      position: absolute;
      width: 18px;
      height: 18px;
      transform: translate3d(-100px, -100px, 0) rotate(45deg);
      border-radius: 5px 5px 5px 1px;
      background: var(--clicky-accent);
      box-shadow: 0 0 0 5px color-mix(in srgb, var(--clicky-accent) 18%, transparent),
        0 8px 24px color-mix(in srgb, var(--clicky-accent) 44%, transparent);
      opacity: 0;
      transition: opacity 300ms ease;
      transform-origin: 50% 50%;
      will-change: transform, opacity;
    }

    .clicky-cursor.is-visible {
      opacity: 1;
    }

    .clicky-response-bubble {
      position: absolute;
      max-width: min(360px, calc(100vw - 32px));
      transform: translate3d(-100px, -100px, 0);
      padding: 10px 12px;
      border: 1px solid var(--clicky-border);
      border-radius: var(--clicky-radius);
      background: rgba(16, 21, 31, 0.94);
      color: var(--clicky-text);
      box-shadow: var(--clicky-shadow);
      opacity: 0;
      transition: opacity 180ms ease;
      line-height: 1.35;
      font-size: 13px;
    }

    .clicky-response-bubble.is-visible {
      opacity: 1;
    }

    .clicky-element-highlight,
    .clicky-element-pulse {
      position: absolute;
      top: 0;
      left: 0;
      width: 0;
      height: 0;
      opacity: 0;
      pointer-events: none;
      box-sizing: border-box;
      will-change: transform, width, height, opacity;
    }

    .clicky-element-highlight {
      border: 2px solid var(--clicky-accent);
      background: color-mix(in srgb, var(--clicky-accent) 7%, transparent);
      box-shadow:
        0 0 0 4px color-mix(in srgb, var(--clicky-accent) 16%, transparent),
        0 10px 34px color-mix(in srgb, var(--clicky-accent) 30%, transparent),
        inset 0 0 0 1px rgba(255, 255, 255, 0.46);
      transition: opacity 120ms ease;
    }

    .clicky-element-pulse {
      border: 1px solid color-mix(in srgb, var(--clicky-accent) 70%, transparent);
      animation: clicky-target-pulse 1100ms ease-out infinite;
    }

    .clicky-element-highlight.is-visible,
    .clicky-element-pulse.is-visible {
      opacity: 1;
    }

    .clicky-element-highlight.is-lost {
      border-style: dashed;
      opacity: 0.72;
      background: color-mix(in srgb, var(--clicky-accent) 4%, transparent);
      box-shadow:
        0 0 0 3px color-mix(in srgb, var(--clicky-accent) 10%, transparent),
        0 8px 24px color-mix(in srgb, var(--clicky-accent) 18%, transparent);
    }

    @keyframes clicky-target-pulse {
      0% {
        opacity: 0.55;
        box-shadow: 0 0 0 0 color-mix(in srgb, var(--clicky-accent) 26%, transparent);
      }
      100% {
        opacity: 0;
        box-shadow: 0 0 0 12px color-mix(in srgb, var(--clicky-accent) 0%, transparent);
      }
    }
  `;
}
