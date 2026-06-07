import type { NormalizedClickyOptions } from "../../core/types";

export class ProviderManager {
  private readonly activeProviders: Record<string, string>;

  constructor(options: NormalizedClickyOptions) {
    this.activeProviders = {
      chat: options.chatProvider,
      "stt-primary": options.voiceProvider === "google" ? "google-stt-upload" : options.voiceProvider,
      "stt-realtime": "deepgram-proxy",
      tts: options.ttsProvider === "google" ? "google-tts-zephyr" : options.ttsProvider
    };
  }

  setActiveProvider(capability: string, provider: string): void {
    this.activeProviders[capability] = provider;
  }

  getActiveProviders(): Record<string, string> {
    return { ...this.activeProviders };
  }
}
