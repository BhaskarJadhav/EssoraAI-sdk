import { floatToPcm16 } from "./PcmEncoder";
import { Logger } from "../utils/logger";

export type AudioFrameHandler = (pcm16Frame: Int16Array) => void;
export type AudioLevelHandler = (level: number) => void;

export class MicCapture {
  private stream?: MediaStream;
  private audioContext?: AudioContext;
  private processor?: ScriptProcessorNode;
  private source?: MediaStreamAudioSourceNode;
  private audioFrameHandler?: AudioFrameHandler;
  private audioLevelHandler?: AudioLevelHandler;
  private readonly logger = new Logger("ClickyMic", "info");

  onAudioFrame(handler: AudioFrameHandler): void {
    this.audioFrameHandler = handler;
  }

  onAudioLevel(handler: AudioLevelHandler): void {
    this.audioLevelHandler = handler;
  }

  async start(): Promise<number> {
    this.logger.info("mic.permission.requested");
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });
    this.logger.info("mic.permission.granted");
    this.logger.info("mic.device.active", {
      label: this.stream.getAudioTracks()[0]?.label ?? "unknown"
    });

    const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
    this.audioContext = new AudioContextConstructor({ sampleRate: 16000 });
    this.source = this.audioContext.createMediaStreamSource(this.stream);

    // ScriptProcessor remains the broadest baseline. The separate worklet file is
    // provided for browsers/hosts that want to swap in AudioWorklet later.
    this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
    this.processor.onaudioprocess = (event) => {
      const channelData = event.inputBuffer.getChannelData(0);
      this.audioLevelHandler?.(this.calculateLevel(channelData));
      this.audioFrameHandler?.(floatToPcm16(channelData));
    };

    this.source.connect(this.processor);
    this.processor.connect(this.audioContext.destination);
    this.logger.info("mic.capture.started", { sampleRate: this.audioContext.sampleRate });
    return this.audioContext.sampleRate;
  }

  stop(): void {
    this.logger.info("mic.capture.stopping");
    this.processor?.disconnect();
    this.source?.disconnect();

    for (const track of this.stream?.getTracks() ?? []) {
      track.stop();
    }

    if (this.audioContext && this.audioContext.state !== "closed") {
      void this.audioContext.close();
    }

    this.processor = undefined;
    this.source = undefined;
    this.stream = undefined;
    this.audioContext = undefined;
    this.logger.info("mic.capture.stopped");
  }

  private calculateLevel(samples: Float32Array): number {
    let total = 0;
    for (const sample of samples) {
      total += sample * sample;
    }
    return Math.min(1, Math.sqrt(total / samples.length) * 5);
  }
}
