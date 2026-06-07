import { ClickyClient } from "./core/ClickyClient";
import type { ClickyOptions } from "./core/types";

export { ClickyClient };
export type {
  ClickyActionContext,
  ClickyActionDefinition,
  ClickyActionMode,
  ClickyActionResult,
  ClickyApiRoutes,
  ClickyCapturedContext,
  ClickyCapturedElement,
  ClickyClientPublic,
  ClickyContextMode,
  ClickyDiagnostics,
  ClickyEnvironment,
  ClickyEventHandler,
  ClickyEventMap,
  ClickyEventName,
  ClickyGuideStep,
  ClickyHotkey,
  ClickyOptions,
  ClickyPointCommand,
  ClickyRealtimeMode,
  ClickySemanticProvider,
  ClickyState,
  ClickyTaskOptions,
  ClickyThemeOptions
} from "./core/types";

export const ClickySDK = {
  init(options: ClickyOptions): ClickyClient {
    return new ClickyClient(options);
  }
};

export function init(options: ClickyOptions): ClickyClient {
  return ClickySDK.init(options);
}

declare global {
  interface Window {
    ClickySDK?: typeof ClickySDK;
    webkitAudioContext?: typeof AudioContext;
    SpeechRecognition?: new () => {
      continuous: boolean;
      interimResults: boolean;
      lang: string;
      start(): void;
      stop(): void;
      abort(): void;
      onresult: ((event: Event) => void) | null;
      onerror: ((event: Event) => void) | null;
      onend: (() => void) | null;
    };
    webkitSpeechRecognition?: Window["SpeechRecognition"];
  }
}

if (typeof window !== "undefined") {
  window.ClickySDK = ClickySDK;
}
