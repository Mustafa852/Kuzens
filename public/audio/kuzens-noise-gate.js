class KuzensNoiseGateProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      {
        name: "threshold",
        defaultValue: 0.006,
        minValue: 0.0005,
        maxValue: 0.05,
        automationRate: "k-rate",
      },
      {
        name: "floor",
        defaultValue: 0.035,
        minValue: 0,
        maxValue: 0.4,
        automationRate: "k-rate",
      },
    ];
  }

  constructor() {
    super();
    this.envelope = 1;
    this.holdFrames = 0;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];
    if (!input?.length || !output?.length) return true;

    let energy = 0;
    let samples = 0;
    for (const channel of input) {
      for (let index = 0; index < channel.length; index += 1) {
        energy += channel[index] * channel[index];
        samples += 1;
      }
    }
    const rms = Math.sqrt(energy / Math.max(1, samples));
    const threshold = parameters.threshold[0];
    const floor = parameters.floor[0];
    if (rms >= threshold) this.holdFrames = 24;
    else if (this.holdFrames > 0) this.holdFrames -= 1;

    const target = rms >= threshold || this.holdFrames > 0 ? 1 : floor;
    const smoothing = target > this.envelope ? 0.72 : 0.035;
    this.envelope += (target - this.envelope) * smoothing;

    for (let channelIndex = 0; channelIndex < output.length; channelIndex += 1) {
      const source = input[Math.min(channelIndex, input.length - 1)];
      const targetChannel = output[channelIndex];
      if (!source) {
        targetChannel.fill(0);
        continue;
      }
      for (let index = 0; index < targetChannel.length; index += 1) {
        targetChannel[index] = source[index] * this.envelope;
      }
    }
    return true;
  }
}

registerProcessor("kuzens-noise-gate", KuzensNoiseGateProcessor);
