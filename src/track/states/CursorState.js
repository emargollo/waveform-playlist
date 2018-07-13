import { pixelsToSeconds } from '../../utils/conversions';

export default class {
  constructor(track) {
    this.track = track;
  }

  setup(samplesPerPixel, sampleRate) {
    this.samplesPerPixel = samplesPerPixel;
    this.sampleRate = sampleRate;
  }

  click(e) {
    e.preventDefault();

    const startX = e.offsetX + e.srcElement.offsetLeft;
    const startTime = pixelsToSeconds(startX, this.samplesPerPixel, this.sampleRate);

    this.track.ee.emit('select', startTime, startTime, this.track);
  }

  static getClass() {
    return '.state-cursor';
  }

  static getEvents() {
    return ['click'];
  }
}
