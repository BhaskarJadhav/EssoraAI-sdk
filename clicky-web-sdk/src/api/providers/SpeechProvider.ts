export type SpeechProviderTranscriptHandler = (text: string, isFinal: boolean) => void;

export interface SpeechProvider {
  readonly id: string;
  connect(sampleRate: number): Promise<void>;
  disconnect(): void;
  finishTurn(): Promise<void>;
  sendAudio(chunk: Int16Array): void;
  onTranscript(handler: SpeechProviderTranscriptHandler): void;
}
