import { SpeechUploadClient } from "../SpeechUploadClient";

export class GoogleSpeechProvider {
  readonly id = "google-stt";

  constructor(private readonly speechUploadClient: SpeechUploadClient) {}

  async transcribeWavBase64(audioBase64: string, sampleRateHertz: number): Promise<string> {
    const result = await this.speechUploadClient.transcribeWavBase64(audioBase64, sampleRateHertz);
    return result.transcript;
  }
}
