/*
* virtual-dom hook for drawing the mute line to the canvas element.
*/

class MuteCanvasHook {
  constructor( duration, samplesPerPixel, muteStart ) {
    this.duration = duration;
    this.samplesPerPixel = samplesPerPixel;
    this.muteStart = muteStart
  }

  hook(canvas, prop, prev) {
    // node is up to date.
    if (prev !== undefined &&
      prev.duration === this.duration &&
      prev.samplesPerPixel === this.samplesPerPixel &&
      prev.muteStart === this.muteStart) {
      return;
    }

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height/2;

    ctx.strokeStyle = 'black';
    ctx.beginPath();

    ctx.moveTo(0, height);
    ctx.lineTo(width, height);

    ctx.stroke();
  }
}

export default MuteCanvasHook;
