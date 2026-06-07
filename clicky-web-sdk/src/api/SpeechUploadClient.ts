import type { NormalizedClickyOptions } from "../core/types";
import { WorkerProxy } from "./WorkerProxy";

type DeepgramUploadResponse = {
  success?: boolean;
  provider?: string;
  transcript?: string;
  result?: {
    results?: {
      channels?: Array<{
        alternatives?: Array<{
          transcript?: string;
        }>;
      }>;
    };
  };
};

export class SpeechUploadClient {
  constructor(
    private readonly workerProxy: WorkerProxy,
    private readonly options: NormalizedClickyOptions
  ) {}

  async transcribeWavBase64(audioBase64: string, sampleRateHertz = 16000): Promise<{
    transcript: string;
    provider?: string;
  }> {
    const response = await this.workerProxy.postJson<DeepgramUploadResponse>(this.options.apiRoutes.sttUpload, {
      audioBase64,
      contentType: "audio/wav",
      sampleRateHertz,
      languageCode: "en-US"
    });

    return {
      provider: response.provider,
      transcript:
      response.transcript?.trim() ??
      response.result?.results?.channels?.[0]?.alternatives?.[0]?.transcript?.trim() ?? ""
    };
  }
}
