export interface TTSProvider {
  readonly id: string;
  speak(text: string): Promise<void>;
}
