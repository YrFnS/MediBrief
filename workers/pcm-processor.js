
/**
 * PCM Processor for MediBrief Audio Streaming.
 * Processes raw float32 audio data and buffers it into 4096-sample chunks for the main thread.
 * 
 * Note: This file is loaded via AudioWorklet.addModule() to avoid inline script violations.
 */
class PCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bufferSize = 4096;
    this.buffer = new Float32Array(this.bufferSize);
    this.index = 0;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (input && input.length > 0) {
      const channelData = input[0];
      for (let i = 0; i < channelData.length; i++) {
        this.buffer[this.index++] = channelData[i];
        if (this.index >= this.bufferSize) {
          this.port.postMessage(this.buffer);
          this.index = 0;
        }
      }
    }
    return true;
  }
}

registerProcessor('pcm-processor', PCMProcessor);
