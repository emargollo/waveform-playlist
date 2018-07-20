
import _assign from 'lodash.assign';
import _forOwn from 'lodash.forown';

import uuid from 'uuid';
import h from 'virtual-dom/h';

import { secondsToPixels, secondsToSamples, pixelsToSeconds } from './utils/conversions';
import stateClasses from './track/states';

import CanvasHook from './render/CanvasHook';
import FadeCanvasHook from './render/FadeCanvasHook';
import MuteCanvasHook from './render/MuteCanvasHook';
import VolumeSliderHook from './render/VolumeSliderHook';

export default class {

  constructor() {
    this.name = 'Untitled';
    this.gain = 1;
    this.tracks = [];
  }

  addTrack(track) {
    this.tracks.push(track);
  }

  setEventEmitter(ee) {
    this.ee = ee;
  }

  setGainLevel(level) {
    this.tracks.forEach((track) => {
      track.setGainLevel(level);
    });
  }

  setMasterGainLevel(level) {
    this.tracks.forEach((track) => {
      track.setMasterGainLevel(level);
    });
  }

  schedulePlay(now, startTime, endTime, config) {
    var playoutPromises = [];
    this.tracks.forEach((track) => {
      playoutPromises.push(track.schedulePlay(now, startTime, endTime, config));
    });
    return playoutPromises;
  }

  scheduleStop() {
    this.tracks.forEach((track) => {
      track.scheduleStop();
    });
  }

  setOfflinePlayout(playout) {
    this.tracks.forEach((track) => {
      track.setOfflinePlayout(playout);
    });
  }

  setState(state) {
    this.state = state;

    this.tracks.forEach((track) => {
      track.setState(state);
    });
  }

  calculatePeaks(zoom, sampleRate) {
    this.tracks.forEach((track) => {
      track.calculatePeaks(zoom, sampleRate);
    });
  }

  setShouldPlay(shouldPlay) {
    this.tracks.forEach((track) => {
      track.setShouldPlay(shouldPlay);
    });
  }

  getEndTime() {
    var maxEnd = 0;
    this.tracks.forEach((track) => {
      if(maxEnd < track.getEndTime()) maxEnd = track.getEndTime();
    });
    return maxEnd;
  }

  isPlaying() {
    var isPlaying = false;
    this.tracks.forEach((track) => {
      if(track.isPlaying()) isPlaying = true;
    });
    return isPlaying;
  }

  getTrackDetails() {
    this.tracks.forEach((track) => {
      track.getTrackDetails();
    });
  }

  renderControls(data, numChan) {
    const muteClass = data.muted ? '.active' : '';
    const soloClass = data.soloed ? '.active' : '';

    return h('div.controls',
      {
        attributes: {
          style: `height: ${numChan * data.height}px; width: ${data.controls.width}px; position: absolute; left: 0; z-index: 10;`,
        },
      }, [
        h('header', [
          h('span', {
            attributes: {
              style: `width: 20px; float: left; cursor: pointer`
            },
            onclick: () => {
              this.ee.emit('close', this);
            }
          }, ['X']),
          h('div', {
            attributes: {
              style: `width: ${data.controls.width - 40}px; float: left;`
            }
          }, [this.name]),
        ]),
        h('div.btn-group', [
          h(`span.btn.btn-default.btn-xs.btn-mute${muteClass}`, {
            onclick: () => {
              this.ee.emit('mute', this);
            },
          }, ['Mute']),
          h(`span.btn.btn-default.btn-xs.btn-solo${soloClass}`, {
            onclick: () => {
              this.ee.emit('solo', this);
            },
          }, ['Solo']),
        ]),
        h('label', [
          h('input.volume-slider', {
            attributes: {
              type: 'range',
              min: 0,
              max: 100,
              value: 100,
            },
            hook: new VolumeSliderHook(this.gain),
            oninput: (e) => {
              this.ee.emit('volumechange', e.target.value, this);
            },
          }),
        ]),
      ],
    );
  }

  getComposedTrack() {
    return this;
  }

  isComposed() {
    return true;
  }

  render(data) {
    const playbackX = secondsToPixels(data.playbackSeconds, data.resolution, data.sampleRate);
    var numChan = 1;

    const waveformChildren = [
      h('div.cursor', {
        attributes: {
          style: `position: absolute; width: 1px; margin: 0; padding: 0; top: 0; left: ${playbackX}px; bottom: 0; z-index: 5;`,
        },
      }),
    ];

    this.tracks.forEach((track) => {
      var trackChildren = track.render(data);
      trackChildren.forEach((child) => {
        waveformChildren.push(child);
      });
      if(track.getPeaks().data.length > numChan) {
        numChan = track.getPeaks().data.length
      }
    });

    // draw cursor selection on active track.
    if (data.isActive === true) {
      const cStartX = secondsToPixels(data.timeSelection.start, data.resolution, data.sampleRate);
      const cEndX = secondsToPixels(data.timeSelection.end, data.resolution, data.sampleRate);
      const cWidth = (cEndX - cStartX) + 1;
      const cClassName = (cWidth > 1) ? '.segment' : '.point';

      waveformChildren.push(h(`div.selection${cClassName}`, {
        attributes: {
          style: `position: absolute; width: ${cWidth}px; bottom: 0; top: 0; left: ${cStartX}px; z-index: 4;`,
        },
      }));
    }

    const waveform = h('div.waveform',
      {
        attributes: {
          style: `height: ${numChan * data.height}px; width: ${secondsToPixels(data.duration, data.resolution, data.sampleRate)}px; position: relative; cursor: text;`,
        },
        onmousedown: e => {
          this.isActive = true;
        },
        onmouseup: e => {
          if(this.isActive) {
            this.isActive = false;
            const startX = e.offsetX;
            const startTime = pixelsToSeconds(startX, data.resolution, data.sampleRate);
            this.ee.emit('select', startTime, startTime, this);
          }
          this.tracks.forEach((track) => {
            try{
              track.stateObj.mouseup(e);
            } catch(er) {

            }
          })
        },
        onmousemove: e => {
          this.tracks.forEach((track) => {
            try{
              track.stateObj.mousemove(e);
            } catch(er) {

            }
          })
        },
        onmouseleave: e => {
          if(this.isActive) {
            this.isActive = false;
          }
          this.tracks.forEach((track) => {
            try{
              track.stateObj.mouseleave(e);
            } catch(er) {

            }
          })
        }
      },
      waveformChildren
    );

    const channelChildren = [];
    let channelMargin = 0;

    if (data.controls.show) {
      channelChildren.push(this.renderControls(data, numChan));
      channelMargin = data.controls.width;
    }

    channelChildren.push(waveform);

    const audibleClass = data.shouldPlay ? '' : '.silent';
    const customClass = (this.customClass === undefined) ? '' : `.${this.customClass}`;

    return h(`div.channel-wrapper${audibleClass}${customClass}`,
      {
        attributes: {
          style: `margin-left: ${channelMargin}px; height: ${data.height * numChan}px;`,
        },
      },
      channelChildren,
    );
  }

}
