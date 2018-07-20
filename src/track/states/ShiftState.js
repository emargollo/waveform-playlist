import { pixelsToSeconds } from '../../utils/conversions';

export default class {
  constructor(track) {
    this.track = track;
    this.active = false;
  }

  setup(samplesPerPixel, sampleRate) {
    this.samplesPerPixel = samplesPerPixel;
    this.sampleRate = sampleRate;

    this.track.ee.on("accShift", () => {
      this.prevX = this.lastX;
    })
  }

  emitShift(x) {
    const deltaX = x - this.prevX;
    const deltaTime = pixelsToSeconds(deltaX, this.samplesPerPixel, this.sampleRate);
    this.lastX = this.prevX;
    this.prevX = x;

    this.track.ee.emit('shift', deltaTime, this.track);
  }

  complete(x) {
    this.emitShift(x);
    this.active = false;
  }

  mousedown(e) {
    e.preventDefault();
    e.stopPropagation()

    this.active = true;
    this.el = e.target;
    this.prevX = e.screenX;
  }

  mousemove(e) {
    if (this.active) {
      e.preventDefault();
      this.emitShift(e.screenX);
    }
  }

  mouseup(e) {
    if (this.active) {
      e.preventDefault();
      this.complete(e.screenX);
    }
  }

  mouseleave(e) {
    if (this.active) {
      e.preventDefault();
      this.complete(e.screenX);
    }
  }

  static getClass() {
    return '.state-shift';
  }

  static getEvents() {
    return ['mousedown'];
  }
}
