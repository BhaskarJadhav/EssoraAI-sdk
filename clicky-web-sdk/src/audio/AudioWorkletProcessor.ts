import { floatToPcm16 } from "./PcmEncoder";

export class ClickyPcmAudioWorkletProcessor extends AudioWorkletProcessor {
  process(inputs: Float32Array[][]): boolean {
    const input = inputs[0]?.[0];
    if (input) {
      const pcm16Frame = floatToPcm16(input);
      this.port.postMessage(pcm16Frame, [pcm16Frame.buffer]);
    }
    return true;
  }
}

declare const registerProcessor: ((name: string, processorCtor: typeof AudioWorkletProcessor) => void) | undefined;

if (typeof registerProcessor !== "undefined") {
  registerProcessor("clicky-pcm-audio-worklet", ClickyPcmAudioWorkletProcessor);
}
