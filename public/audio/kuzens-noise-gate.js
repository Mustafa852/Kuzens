class KuzensNoiseGateProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      {
        name: "threshold",
        defaultValue: 0.006,
        minValue: 0.0005,
        maxValue: 0.08,
        automationRate: "k-rate",
      },
      {
        name: "floor",
        defaultValue: 0.006,
        minValue: 0,
        maxValue: 0.25,
        automationRate: "k-rate",
      },
      {
        name: "adaptive",
        defaultValue: 1,
        minValue: 0,
        maxValue: 1,
        automationRate: "k-rate",
      },
      {
        name: "noiseMultiplier",
        defaultValue: 2.6,
        minValue: 1.2,
        maxValue: 5,
        automationRate: "k-rate",
      },
    ];
  }

  constructor() {
    super();
    this.envelope = 0;
    this.noiseFloor = 0.0025;
    this.holdFrames = 0;
    this.speechFrames = 0;
    this.warmupFrames = 160;
    this.isOpen = false;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];
    if (!input?.length || !output?.length) return true;

    let sum = 0;
    let count = 0;
    for (const channel of input) {
      for (let index = 0; index < channel.length; index += 1) {
        sum += channel[index] * channel[index];
        count += 1;
      }
    }

    const rms = Math.sqrt(sum / Math.max(1, count));
    const baseThreshold = parameters.threshold[0];
    const adaptive = parameters.adaptive[0] >= 0.5;
    const noiseMultiplier = parameters.noiseMultiplier[0];

    if (this.warmupFrames > 0) {
      const warmupRate = this.warmupFrames > 90 ? 0.08 : 0.025;
      this.noiseFloor += (Math.min(rms, 0.05) - this.noiseFloor) * warmupRate;
      this.warmupFrames -= 1;
    } else if (!this.isOpen) {
      const ceiling = Math.max(baseThreshold * 2.5, this.noiseFloor * 1.8);
      const candidate = Math.min(rms, ceiling);
      const learnRate = candidate > this.noiseFloor ? 0.004 : 0.018;
      this.noiseFloor += (candidate - this.noiseFloor) * learnRate;
    }

    const openThreshold = adaptive
      ? Math.max(baseThreshold, this.noiseFloor * noiseMultiplier)
      : baseThreshold;
    const closeThreshold = openThreshold * 0.62;

    if (rms >= openThreshold) {
      this.speechFrames += 1;
      if (this.speechFrames >= 3) {
        this.isOpen = true;
        this.holdFrames = 52;
      }
    } else {
      this.speechFrames = 0;
      if (this.isOpen && rms < closeThreshold) {
        if (this.holdFrames > 0) this.holdFrames -= 1;
        else this.isOpen = false;
      }
    }

    const target = this.isOpen && this.warmupFrames === 0 ? 1 : parameters.floor[0];
    const smoothing = target > this.envelope ? 0.58 : 0.016;
    this.envelope += (target - this.envelope) * smoothing;

    for (let channelIndex = 0; channelIndex < output.length; channelIndex += 1) {
      const source = input[channelIndex] || input[0];
      const targetChannel = output[channelIndex];
      for (let sampleIndex = 0; sampleIndex < targetChannel.length; sampleIndex += 1) {
        targetChannel[sampleIndex] = (source?.[sampleIndex] || 0) * this.envelope;
      }
    }

    return true;
  }
}

registerProcessor("kuzens-noise-gate", KuzensNoiseGateProcessor);
