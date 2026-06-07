declare const AudioWorkletProcessor: {
  new (): AudioWorkletProcessor;
};

interface AudioWorkletProcessor {
  readonly port: MessagePort;
  process(inputs: Float32Array[][], outputs: Float32Array[][], parameters: Record<string, Float32Array>): boolean;
}

declare function registerProcessor(name: string, processorCtor: typeof AudioWorkletProcessor): void;

interface Window {
  webkitAudioContext?: typeof AudioContext;
}
