import { Logger } from "../utils/logger";

export class AudioPlayer {
  private audioContext?: AudioContext;
  private currentSource?: AudioBufferSourceNode;
  private readonly logger = new Logger("ClickyAudio", "info");

  async play(audioData: ArrayBuffer): Promise<void> {
    this.stop();
    const audioContext = this.getAudioContext();
    try {
      if (audioContext.state === "suspended") {
        this.logger.warn("audio.context.suspended");
        await audioContext.resume();
      }

      const decodedAudio = await audioContext.decodeAudioData(audioData.slice(0));
      const source = audioContext.createBufferSource();
      source.buffer = decodedAudio;
      source.connect(audioContext.destination);
      this.currentSource = source;
      this.logger.info("audio.playback.start", { durationSeconds: decodedAudio.duration });

      await new Promise<void>((resolve) => {
        source.onended = () => resolve();
        source.start();
      });
      this.logger.info("audio.playback.end");
    } catch (error) {
      this.logger.error("audio.playback.failed", { error: String(error) });
      throw error;
    }
  }

  stop(): void {
    if (this.currentSource) {
      try {
        this.currentSource.stop();
      } catch {
        // Stopping an already-ended source is harmless.
      }
      this.currentSource.disconnect();
      this.currentSource = undefined;
    }
  }

  async destroy(): Promise<void> {
    this.stop();
    if (this.audioContext && this.audioContext.state !== "closed") {
      await this.audioContext.close();
    }
  }

  private getAudioContext(): AudioContext {
    if (!this.audioContext) {
      const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
      this.audioContext = new AudioContextConstructor();
    }
    return this.audioContext;
  }
}
