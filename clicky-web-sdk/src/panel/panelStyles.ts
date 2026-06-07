import type { NormalizedClickyOptions } from "../core/types";
import { createDesignSystemCss } from "../shared/DesignSystem";

export function createPanelStyles(options: NormalizedClickyOptions): string {
  return `
    ${createDesignSystemCss(options)}

    .clicky-panel-root {
      position: fixed;
      right: 20px;
      bottom: 20px;
      z-index: calc(var(--clicky-z-index) + 1);
      color: var(--clicky-text);
    }

    .clicky-launcher {
      width: 46px;
      height: 46px;
      border: 1px solid var(--clicky-border);
      border-radius: 50%;
      background: var(--clicky-accent);
      color: white;
      box-shadow: var(--clicky-shadow);
      font-weight: 800;
    }

    .clicky-panel {
      display: none;
      width: min(380px, calc(100vw - 40px));
      margin-bottom: 12px;
      border: 1px solid var(--clicky-border);
      border-radius: var(--clicky-radius);
      background: var(--clicky-panel-bg);
      box-shadow: var(--clicky-shadow);
      overflow: hidden;
    }

    .clicky-panel.is-open {
      display: block;
    }

    .clicky-panel-header,
    .clicky-panel-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 12px;
      border-bottom: 1px solid var(--clicky-border);
    }

    .clicky-panel-footer {
      flex-direction: column;
      align-items: stretch;
      border-top: 1px solid var(--clicky-border);
      border-bottom: 0;
    }

    .clicky-title {
      font-weight: 700;
      font-size: 14px;
    }

    .clicky-state {
      color: var(--clicky-muted);
      font-size: 12px;
    }

    .clicky-icon-button {
      border: 1px solid var(--clicky-border);
      border-radius: 6px;
      padding: 5px 7px;
      background: rgba(255, 255, 255, 0.06);
      color: var(--clicky-text);
      font-size: 11px;
    }

    .clicky-settings {
      display: none;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      padding: 10px 12px;
      border-bottom: 1px solid var(--clicky-border);
      background: rgba(255, 255, 255, 0.035);
    }

    .clicky-settings.is-visible {
      display: grid;
    }

    .clicky-settings-field {
      display: grid;
      gap: 4px;
      min-width: 0;
      color: var(--clicky-muted);
      font-size: 11px;
    }

    .clicky-settings-field select {
      min-width: 0;
      border: 1px solid var(--clicky-border);
      border-radius: 6px;
      padding: 6px;
      background: rgba(16, 21, 31, 0.96);
      color: var(--clicky-text);
      font-size: 12px;
    }

    .clicky-thread {
      max-height: 260px;
      overflow: auto;
      padding: 12px;
      font-size: 13px;
      line-height: 1.4;
    }

    .clicky-screenshot-preview {
      display: none;
      padding: 8px 12px;
      border-bottom: 1px solid var(--clicky-border);
      color: var(--clicky-muted);
      background: rgba(255, 255, 255, 0.035);
      font-size: 12px;
    }

    .clicky-screenshot-preview.is-visible {
      display: block;
    }

    .clicky-onboarding {
      display: none;
      padding: 12px;
      border-bottom: 1px solid var(--clicky-border);
      background: rgba(255, 255, 255, 0.04);
      font-size: 12px;
    }

    .clicky-onboarding.is-visible {
      display: grid;
      gap: 8px;
    }

    .clicky-onboarding p {
      margin: 0;
      color: var(--clicky-muted);
    }

    .clicky-onboarding-checks {
      display: grid;
      gap: 6px;
    }

    .clicky-onboarding-check,
    .clicky-onboarding-actions {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }

    .clicky-onboarding-check span:last-child {
      color: var(--clicky-muted);
      text-align: right;
    }

    .clicky-onboarding-check [data-state="pass"] {
      color: #73e2a7;
    }

    .clicky-onboarding-check [data-state="fail"] {
      color: #ffb4a8;
    }

    .clicky-message {
      margin: 0 0 10px;
      white-space: pre-wrap;
    }

    .clicky-message-user {
      color: rgba(248, 251, 255, 0.78);
    }

    .clicky-message-assistant {
      color: var(--clicky-text);
    }

    .clicky-input-row {
      display: grid;
      grid-template-columns: 1fr auto auto;
      gap: 8px;
      width: 100%;
    }

    .clicky-input {
      min-width: 0;
      border: 1px solid var(--clicky-border);
      border-radius: var(--clicky-radius);
      padding: 9px 10px;
      background: rgba(255, 255, 255, 0.08);
      color: var(--clicky-text);
    }

    .clicky-button {
      border: 1px solid var(--clicky-border);
      border-radius: var(--clicky-radius);
      padding: 9px 10px;
      background: rgba(255, 255, 255, 0.08);
      color: var(--clicky-text);
    }

    .clicky-button:hover,
    .clicky-launcher:hover {
      filter: brightness(1.08);
    }

    .clicky-mic.is-listening {
      background: var(--clicky-accent);
    }

    .clicky-mic {
      min-width: 64px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 7px;
    }

    .clicky-waveform {
      width: 20px;
      height: 22px;
      display: none;
      align-items: center;
      justify-content: center;
      gap: 2px;
    }

    .clicky-mic.is-listening .clicky-waveform {
      display: inline-flex;
    }

    .clicky-waveform span {
      width: 2px;
      height: 5px;
      border-radius: 999px;
      background: currentColor;
      transition: height 90ms linear;
    }

    .clicky-mic-help {
      display: none;
      width: 100%;
      color: var(--clicky-muted);
      font-size: 12px;
      line-height: 1.35;
    }

    .clicky-mic-help.is-visible {
      display: block;
    }

    .clicky-confirm {
      display: none;
      gap: 8px;
      align-items: center;
      padding: 10px 12px;
      border-top: 1px solid var(--clicky-border);
      background: rgba(255, 255, 255, 0.05);
      font-size: 12px;
    }

    .clicky-confirm.is-visible {
      display: flex;
    }
  `;
}
