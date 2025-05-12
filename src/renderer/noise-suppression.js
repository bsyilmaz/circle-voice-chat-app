class NoiseSuppressionProcessor {
  constructor() {
    this.initialized = false;
    this.context = null;
    this.sourceNode = null;
    this.filterNode = null;
    this.compressorNode = null;
    this.gainNode = null;
    this.destinationNode = null;
    this.sampleRate = 48000; 
    this.enabled = true;
  }
  async initialize(inputStream) {
    if (this.initialized) {
      return this.outputStream;
    }
    try {
      console.log('Using Web Audio API for noise suppression');
      this.context = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: this.sampleRate
      });
      this.sourceNode = this.context.createMediaStreamSource(inputStream);
      this.destinationNode = this.context.createMediaStreamDestination();
      this.filterNode = this.context.createBiquadFilter();
      this.filterNode.type = 'lowpass';
      this.filterNode.frequency.value = 8000;
      this.filterNode.Q.value = 0.5;
      this.compressorNode = this.context.createDynamicsCompressor();
      this.compressorNode.threshold.value = -50;
      this.compressorNode.knee.value = 40;
      this.compressorNode.ratio.value = 12;
      this.compressorNode.attack.value = 0;
      this.compressorNode.release.value = 0.25;
      this.gainNode = this.context.createGain();
      this.gainNode.gain.value = 1.0;
      this.sourceNode.connect(this.filterNode);
      this.filterNode.connect(this.compressorNode);
      this.compressorNode.connect(this.gainNode);
      this.gainNode.connect(this.destinationNode);
      this.outputStream = this.destinationNode.stream;
      this.initialized = true;
      return this.outputStream;
    } catch (error) {
      console.error('Failed to initialize noise suppression:', error);
      return inputStream;
    }
  }
  setEnabled(enabled) {
    this.enabled = enabled;
    if (this.initialized) {
      if (enabled) {
        this.sourceNode.disconnect();
        this.sourceNode.connect(this.filterNode);
        this.filterNode.connect(this.compressorNode);
        this.compressorNode.connect(this.gainNode);
        this.gainNode.connect(this.destinationNode);
      } else {
        this.sourceNode.disconnect();
        this.sourceNode.connect(this.destinationNode);
      }
    }
  }
  dispose() {
    if (this.initialized) {
      this.sourceNode.disconnect();
      this.filterNode.disconnect();
      this.compressorNode.disconnect();
      this.gainNode.disconnect();
      if (this.context && this.context.state !== 'closed') {
        this.context.close();
      }
      this.initialized = false;
    }
  }
}
module.exports = NoiseSuppressionProcessor; 