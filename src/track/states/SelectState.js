import { pixelsToSeconds, secondsToPixels } from '../../utils/conversions';

export default class {
  constructor(track) {
    this.track = track;
    this.active = false;
  }

  setup(samplesPerPixel, sampleRate) {
    this.samplesPerPixel = samplesPerPixel;
    this.sampleRate = sampleRate;
  }

  emitSelection(x) {
    const minX = Math.min(x, this.startX);
    const maxX = Math.max(x, this.startX);
    const startTime = Math.max(pixelsToSeconds(minX, this.samplesPerPixel, this.sampleRate), this.track.getStartTime());
    const endTime = Math.min(pixelsToSeconds(maxX, this.samplesPerPixel, this.sampleRate), this.track.getEndTime());

    this.track.ee.emit('select', startTime, endTime, this.track);
  }

  complete(x) {
    this.emitSelection(x);
    this.active = false;
  }

  click(e) {
    e.stopPropagation()

  }

  mousedown(e) {
    e.preventDefault();
    this.active = true;
    e.stopPropagation()

    this.startX = e.offsetX + e.srcElement.offsetLeft;
    const startTime = pixelsToSeconds(this.startX, this.samplesPerPixel, this.sampleRate);

    this.track.ee.emit('select', startTime, startTime, this.track);
  }

  mousemove(e) {
    if(e.srcElement.className == "playlist-overlay state-select" && !this.active && this.track.composedTrack.isActive) {
      this.active = true;
      this.track.composedTrack.isActive = false;
      this.startX = e.offsetX + e.srcElement.offsetLeft;
      var startTime = pixelsToSeconds(this.startX, this.samplesPerPixel, this.sampleRate);

      if(this.track.getStartTime() - startTime < startTime - this.track.getEndTime()) {
        console.log("START");
        startTime = this.track.getEndTime();
      } else {
        console.log("END");
        startTime = this.track.getStartTime();
      }

      this.startX = secondsToPixels(startTime, this.samplesPerPixel, this.sampleRate)
      this.track.ee.emit('select', startTime, startTime, this.track);
    }
    if (this.active) {
      e.preventDefault();
      this.emitSelection(e.offsetX + e.srcElement.offsetLeft);
    }
  }

  mouseup(e) {
    if (this.active) {
      e.stopPropagation()
      e.preventDefault();
      this.complete(e.offsetX + e.srcElement.offsetLeft);
    }
  }

  mouseleave(e) {
    if (this.active) {
      e.stopPropagation()
      e.preventDefault();
      this.complete(e.offsetX + e.srcElement.offsetLeft);
    }
  }

  static getClass() {
    return '.state-select';
  }

  static getEvents() {
    return ['mousedown', 'mouseleave', 'mousemove', 'click'];
  }
}
