export function floatToPcm16(float32Samples: Float32Array): Int16Array {
  const pcm16Samples = new Int16Array(float32Samples.length);

  for (let sampleIndex = 0; sampleIndex < float32Samples.length; sampleIndex += 1) {
    const sample = Math.max(-1, Math.min(1, float32Samples[sampleIndex] ?? 0));
    pcm16Samples[sampleIndex] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }

  return pcm16Samples;
}
