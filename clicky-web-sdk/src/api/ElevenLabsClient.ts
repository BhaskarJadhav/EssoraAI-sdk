import { EventBus } from "../core/EventBus";
import type { NormalizedClickyOptions } from "../core/types";
import { WorkerProxy } from "./WorkerProxy";
import { AudioPlayer } from "../audio/AudioPlayer";
import { Logger } from "../utils/logger";

export class ElevenLabsClient {
  private readonly logger = new Logger("ClickyTTS", "info");

  constructor(
    private readonly workerProxy: WorkerProxy,
    private readonly audioPlayer: AudioPlayer,
    private readonly eventBus: EventBus,
    private readonly options: NormalizedClickyOptions
  ) {}

  async speak(text: string): Promise<void> {
    const cleanedText = text.trim();
    if (!cleanedText) {
      return;
    }

    this.eventBus.emit("tts:start", undefined);
    this.logger.info("tts.request.start", { length: cleanedText.length });
    try {
      const audioBuffer = await this.workerProxy.postBinary(this.options.apiRoutes.tts, {
        text: cleanedText,
        googleLanguageCode: "en-US",
        googleVoiceName: this.options.ttsVoice,
        googleSpeakingRate: 0.96,
        googlePitch: 0,
        googleVolumeGainDb: 0,
        googleEffectsProfileId: "headphone-class-device",
        modelId: "eleven_flash_v2_5"
      });
      this.logger.info("tts.response.received", { bytes: audioBuffer.byteLength });
      await this.audioPlayer.play(audioBuffer);
    } finally {
      this.eventBus.emit("tts:end", undefined);
      this.logger.info("tts.request.end");
    }
  }
}
