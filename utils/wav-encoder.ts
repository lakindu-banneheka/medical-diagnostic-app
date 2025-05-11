/**
 * wavEncoder.ts
 *
 * Provides a utility to convert an audio Blob (e.g. WebM/Opus) into a WAV File.
 * Usage:
 *   import { blobToWavFile } from './wavEncoder';
 *   const wavFile = await blobToWavFile(audioBlob, 'output.wav');
 */

/**
 * Convert an audio Blob (WebM/Opus) into a WAV File.
 * @param sourceBlob The input audio Blob
 * @param filename Filename for the resulting WAV file
 * @returns Promise<File> resolving to the WAV File
 */
export async function blobToWavFile(sourceBlob: Blob, filename = "recording.wav"): Promise<File> {
  // Decode source Blob into AudioBuffer
  const arrayBuffer = await sourceBlob.arrayBuffer()
  const audioCtx = new AudioContext()
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer)

  // Encode AudioBuffer into WAV PCM Blob
  const wavBlob = encodeWav(audioBuffer)
  return new File([wavBlob], filename, { type: "audio/wav", lastModified: Date.now() })
}

/**
 * Internal: encode an AudioBuffer into a WAV-format Blob (PCM 16-bit).
 * @param buffer AudioBuffer to encode
 * @returns Blob containing WAV data
 */
function encodeWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels
  const sampleRate = buffer.sampleRate
  const bitsPerSample = 16
  const blockAlign = (numChannels * bitsPerSample) / 8
  const byteRate = sampleRate * blockAlign
  const dataSize = buffer.length * blockAlign
  const headerSize = 44
  const totalSize = headerSize + dataSize

  const bufferView = new DataView(new ArrayBuffer(totalSize))
  let offset = 0

  // RIFF chunk descriptor
  writeString(bufferView, offset, "RIFF")
  offset += 4
  bufferView.setUint32(offset, 36 + dataSize, true)
  offset += 4
  writeString(bufferView, offset, "WAVE")
  offset += 4

  // fmt sub-chunk
  writeString(bufferView, offset, "fmt ")
  offset += 4
  bufferView.setUint32(offset, 16, true)
  offset += 4 // Subchunk1Size
  bufferView.setUint16(offset, 1, true)
  offset += 2 // AudioFormat = PCM
  bufferView.setUint16(offset, numChannels, true)
  offset += 2 // NumChannels
  bufferView.setUint32(offset, sampleRate, true)
  offset += 4 // SampleRate
  bufferView.setUint32(offset, byteRate, true)
  offset += 4 // ByteRate
  bufferView.setUint16(offset, blockAlign, true)
  offset += 2 // BlockAlign
  bufferView.setUint16(offset, bitsPerSample, true)
  offset += 2 // BitsPerSample

  // data sub-chunk
  writeString(bufferView, offset, "data")
  offset += 4
  bufferView.setUint32(offset, dataSize, true)
  offset += 4

  // Interleave and write PCM samples
  const channels: Float32Array[] = []
  for (let ch = 0; ch < numChannels; ch++) {
    channels.push(buffer.getChannelData(ch))
  }
  for (let i = 0; i < buffer.length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      let sample = channels[ch][i]
      sample = Math.max(-1, Math.min(1, sample))
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff
      bufferView.setInt16(offset, intSample, true)
      offset += 2
    }
  }

  return new Blob([bufferView], { type: "audio/wav" })
}

/**
 * Helper to write ASCII strings into DataView
 */
function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i))
  }
}
