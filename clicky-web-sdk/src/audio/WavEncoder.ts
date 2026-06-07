export function encodePcm16FramesToWavBase64(pcm16Frames: Int16Array[], sampleRate: number): string {
  const totalSamples = pcm16Frames.reduce((total, frame) => total + frame.length, 0);
  const wavBuffer = new ArrayBuffer(44 + totalSamples * 2);
  const view = new DataView(wavBuffer);
  let offset = 0;

  writeAscii(view, offset, "RIFF");
  offset += 4;
  view.setUint32(offset, 36 + totalSamples * 2, true);
  offset += 4;
  writeAscii(view, offset, "WAVE");
  offset += 4;
  writeAscii(view, offset, "fmt ");
  offset += 4;
  view.setUint32(offset, 16, true);
  offset += 4;
  view.setUint16(offset, 1, true);
  offset += 2;
  view.setUint16(offset, 1, true);
  offset += 2;
  view.setUint32(offset, sampleRate, true);
  offset += 4;
  view.setUint32(offset, sampleRate * 2, true);
  offset += 4;
  view.setUint16(offset, 2, true);
  offset += 2;
  view.setUint16(offset, 16, true);
  offset += 2;
  writeAscii(view, offset, "data");
  offset += 4;
  view.setUint32(offset, totalSamples * 2, true);
  offset += 4;

  for (const frame of pcm16Frames) {
    for (const sample of frame) {
      view.setInt16(offset, sample, true);
      offset += 2;
    }
  }

  return arrayBufferToBase64(wavBuffer);
}

function writeAscii(view: DataView, offset: number, value: string): void {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";

  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }

  return btoa(binary);
}
