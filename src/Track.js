import _assign from 'lodash.assign';
import _forOwn from 'lodash.forown';

import uuid from 'uuid';
import h from 'virtual-dom/h';

import extractPeaks from 'webaudio-peaks';
import { FADEIN, FADEOUT } from 'fade-maker';

import { secondsToPixels, secondsToSamples } from './utils/conversions';
import stateClasses from './track/states';

import CanvasHook from './render/CanvasHook';
import FadeCanvasHook from './render/FadeCanvasHook';
import MuteCanvasHook from './render/MuteCanvasHook';
import VolumeSliderHook from './render/VolumeSliderHook';

import audioBufferSlice from 'audiobuffer-slice';

const MAX_CANVAS_WIDTH = 1000000;

export default class {

  constructor() {
    this.name = 'Untitled';
    this.customClass = undefined;
    this.waveOutlineColor = undefined;
    this.gain = 1;
    this.fades = {};
    this.mutes = [];
    this.peakData = {
      type: 'WebAudio',
      mono: false,
    };

    this.cueIn = 0;
    this.cueOut = 0;
    this.duration = 0;
    this.startTime = 0;
    this.endTime = 0;
  }

  setEventEmitter(ee) {
    this.ee = ee;
  }

  setComposedTrack(composedTrack) {
    this.composedTrack = composedTrack;
  }

  getComposedTrack() {
    return this.composedTrack;
  }
  setName(name) {
    this.name = name;
  }

  setCustomClass(className) {
    this.customClass = className;
  }

  setWaveOutlineColor(color) {
    this.waveOutlineColor = color;
  }

  setCues(cueIn, cueOut) {
    if (cueOut < cueIn) {
      throw new Error('cue out cannot be less than cue in');
    }

    this.cueIn = cueIn;
    this.cueOut = cueOut;
    this.duration = this.cueOut - this.cueIn;
    this.endTime = this.startTime + this.duration;
  }

  isComposed() {
    return false;
  }

  slice(start, end) {
    const self = this;
    const trackStart = this.getStartTime();
    const trackEnd = this.buffer.duration + trackStart;
    const offset = this.cueIn - trackStart;

    start < trackStart? start = trackStart : start = start;
    end > trackEnd? end = trackEnd : end = end;

    audioBufferSlice(this.buffer, (offset+start)*1000, (end+offset)*1000, function(error, slicedAudioBuffer) {
      if(error) {
        return console.error(error);
      }
      self.buffer = slicedAudioBuffer;
      self.playout.setBuffer(slicedAudioBuffer);
      if (start > trackStart) {
        self.setStartTime(start);
        self.duration = self.buffer.duration;
        self.endTime = self.startTime + self.duration;

        var startOffset = trackStart - start;

        var mutesToRemove = [];

        for(var i = 0; i < self.mutes.length; i++) {
          self.mutes[i].start += startOffset;
          self.mutes[i].end += startOffset;

          if(self.mutes[i].end > self.duration) {
            if(self.mutes[i].start < self.duration) {
              self.mutes[i].end = self.duration;
            } else {
              mutesToRemove.push(i);
            }
          }
        }

        for(var i = mutesToRemove.length -1; i >= 0; i--) {
          self.mutes.splice(mutesToRemove[i], 1);
        }
      }
    })
  }

  copySelection(start, end) {
    const self = this;
    const trackStart = this.getStartTime();
    const trackEnd = this.buffer.duration + trackStart;
    const offset = this.cueIn - trackStart;

    start < trackStart? start = trackStart : start = start;
    end > trackEnd? end = trackEnd : end = end;

    var data = {};
    var func = audioBufferSlice(this.buffer, (offset+start)*1000, (end+offset)*1000, function(error, slicedAudioBuffer) {

      if(error) {
        return console.error(error);
      }
      data.buffer = slicedAudioBuffer;
      data.mutes = JSON.parse(JSON.stringify(self.mutes));
      data.name = self.name + uuid.v4();
      data.duration = (end - start);

      if (start > trackStart) {

        var startOffset = trackStart - start;

        var mutesToRemove = [];

        for(var i = 0; i < data.mutes.length; i++) {
          data.mutes[i].start += startOffset;
          data.mutes[i].end += startOffset;

          if(data.mutes[i].end > self.duration) {
            if(data.mutes[i].start < self.duration) {
              data.mutes[i].end = self.duration;
            } else {
              mutesToRemove.push(i);
            }
          }
        }

        for(var i = mutesToRemove.length -1; i >= 0; i--) {
          data.mutes.splice(mutesToRemove[i], 1);
        }
      }

    })

    return data;
  }

  deleteSelection(start, end, startoffset) {
    const self = this;
    const trackStart = this.getStartTime();
    const trackEnd = this.buffer.duration + trackStart;
    const offset = this.cueIn - trackStart;

    console.log(end);

    start < trackStart? start = trackStart : start = start;
    end > trackEnd? end = trackEnd : end = end;

    var startBuffer;
    var endBuffer;
    var removed = start - end;


    audioBufferSlice(this.buffer, (end+offset)*1000, (trackEnd+offset)*1000, function(error, slicedAudioBuffer) {
      if(error) {
        return console.error(error);
      }

      var mutes = [];

      var estart = end;
      var eend = trackEnd;

      var startOffset = estart - start;

      for(var i = 0; i < self.mutes.length; i++) {
        if(self.mutes[i].end > startOffset) {
          mutes.push({
            start: self.mutes[i].start - estart + trackStart,
            end: self.mutes[i].end - estart + trackStart,
          });
        }
      }

      var trackData = {
        buffer: slicedAudioBuffer,
        start: start + (startoffset || 0),
        name: self.name + uuid.v4(),
        mutes: mutes
      }

      self.ee.emit("addtrack", trackData);
    });

    if(this.getStartTime() == start) {
      this.composedTrack.tracks.forEach((track) => {
        if(track.getStartTime() > end) {
          this.ee.emit('shift', removed, track, true);
        }
      })
      this.composedTrack.tracks.splice(this.composedTrack.tracks.indexOf(this), 1);
      return
    }

    audioBufferSlice(this.buffer, 0, (offset+start)*1000, function(error, slicedAudioBuffer) {
      if(error) {
        return console.error(error);
      }

      self.buffer = slicedAudioBuffer;
      self.duration = self.buffer.duration;
      self.endTime = self.startTime + self.duration;
      self.playout.setBuffer(slicedAudioBuffer);

      var mutesToRemove = [];

      for(var i = 0; i < self.mutes.length; i++) {
        self.mutes[i].start;
        self.mutes[i].end;

        if(self.mutes[i].end > self.duration) {
          if(self.mutes[i].start < self.duration) {
            self.mutes[i].end = self.duration;
          } else {
            mutesToRemove.push(i);
          }
        }
      }

      for(var i = mutesToRemove.length -1; i >= 0; i--) {
        self.mutes.splice(mutesToRemove[i], 1);
      }
    });

    this.composedTrack.tracks.forEach((track) => {
      if(track.getStartTime() > end) {
        this.ee.emit('shift', removed, track, true);
      }
    })
  }

  /*
  *   start, end in seconds relative to the entire playlist.
  */
  trim(start, end) {
    const trackStart = this.getStartTime();
    const trackEnd = this.getEndTime();
    const offset = this.cueIn - trackStart;

    if ((trackStart <= start && trackEnd >= start) ||
      (trackStart <= end && trackEnd >= end)) {
      const cueIn = (start < trackStart) ? trackStart : start;
      const cueOut = (end > trackEnd) ? trackEnd : end;

      this.setCues(cueIn + offset, cueOut + offset);
      if (start > trackStart) {
        this.setStartTime(start);
      }
    }
  }

  silence(start, end) {

    const trackStart = this.getStartTime();
    const offset = this.cueIn - trackStart;

    start += offset;
    end += offset;

    var mutesToRemove = [];

    for(var i = 0; i < this.mutes.length; i++) {
      var remove = false;
      if(start > this.mutes[i].start && start < this.mutes[i].end) {
        start = this.mutes[i].start;
        remove = true;
      }
      if(end > this.mutes[i].start && end < this.mutes[i].end) {
        end = this.mutes[i].end;
        remove = true;
      }
      if(start < this.mutes[i].start && end > this.mutes[i].end) {
        remove = true;
      }
      if(remove == true) {
        mutesToRemove.push(i);
      }
    }

    for(var i = mutesToRemove.length -1; i >= 0; i--) {
      this.mutes.splice(mutesToRemove[i], 1);
    }

    this.mutes.push({
      start: start,
      end: end
    })

  }

  setStartTime(start) {
    this.startTime = start;
    this.endTime = start + this.duration;
  }

  setPlayout(playout) {
    this.playout = playout;
  }

  setOfflinePlayout(playout) {
    this.offlinePlayout = playout;
  }

  setEnabledStates(enabledStates = {}) {
    const defaultStatesEnabled = {
      cursor: true,
      fadein: true,
      fadeout: true,
      select: true,
      shift: true,
    };

    this.enabledStates = _assign({}, defaultStatesEnabled, enabledStates);
  }

  setFadeIn(duration, shape = 'logarithmic') {
    if (duration > this.duration) {
      throw new Error('Invalid Fade In');
    }

    const fade = {
      shape,
      start: 0,
      end: duration,
    };

    if (this.fadeIn) {
      this.removeFade(this.fadeIn);
      this.fadeIn = undefined;
    }

    this.fadeIn = this.saveFade(FADEIN, fade.shape, fade.start, fade.end);
  }

  setFadeOut(duration, shape = 'logarithmic') {
    if (duration > this.duration) {
      throw new Error('Invalid Fade Out');
    }

    const fade = {
      shape,
      start: this.duration - duration,
      end: this.duration,
    };

    if (this.fadeOut) {
      this.removeFade(this.fadeOut);
      this.fadeOut = undefined;
    }

    this.fadeOut = this.saveFade(FADEOUT, fade.shape, fade.start, fade.end);
  }

  saveFade(type, shape, start, end) {
    const id = uuid.v4();

    this.fades[id] = {
      type,
      shape,
      start,
      end,
    };

    return id;
  }

  removeFade(id) {
    delete this.fades[id];
  }

  setBuffer(buffer) {
    this.buffer = buffer;
  }

  setPeakData(data) {
    this.peakData = data;
  }

  calculatePeaks(samplesPerPixel, sampleRate) {
    const cueIn = secondsToSamples(this.cueIn, sampleRate);
    const cueOut = secondsToSamples(this.cueOut, sampleRate);

    this.setPeaks(extractPeaks(this.buffer, samplesPerPixel, this.peakData.mono, cueIn, cueOut));
  }

  setPeaks(peaks) {
    this.peaks = peaks;
  }

  setState(state) {
    this.state = state;

    if (this.state && this.enabledStates[this.state]) {
      const StateClass = stateClasses[this.state];
      this.stateObj = new StateClass(this);
    } else {
      this.stateObj = undefined;
    }
  }

  setMutes(mutes) {
    this.mutes = mutes;
  }

  getStartTime() {
    return this.startTime;
  }

  getEndTime() {
    return this.endTime;
  }

  getDuration() {
    return this.duration;
  }

  getPeaks() {
    return this.peaks;
  }

  isPlaying() {
    return this.playout.isPlaying();
  }

  setShouldPlay(bool) {
    this.playout.setShouldPlay(bool);
  }

  setGainLevel(level) {
    this.gain = level;
    this.playout.setVolumeGainLevel(level);
  }

  setMasterGainLevel(level) {
    this.playout.setMasterGainLevel(level);
  }

  /*
    startTime, endTime in seconds (float).
    segment is for a highlighted section in the UI.

    returns a Promise that will resolve when the AudioBufferSource
    is either stopped or plays out naturally.
  */
  schedulePlay(now, startTime, endTime, config) {
    let start;
    let duration;
    let when = now;
    let segment = (endTime) ? (endTime - startTime) : undefined;

    const defaultOptions = {
      shouldPlay: true,
      masterGain: 1,
      isOffline: false,
    };

    const options = _assign({}, defaultOptions, config);
    const playoutSystem = options.isOffline ? this.offlinePlayout : this.playout;

    // 1) track has no content to play.
    // 2) track does not play in this selection.
    if ((this.endTime <= startTime) || (segment && (startTime + segment) < this.startTime)) {
      // return a resolved promise since this track is technically "stopped".
      return Promise.resolve();
    }

    // track should have something to play if it gets here.

    // the track starts in the future or on the cursor position
    if (this.startTime >= startTime) {
      start = 0;
      // schedule additional delay for this audio node.
      when += (this.startTime - startTime);

      if (endTime) {
        segment -= (this.startTime - startTime);
        duration = Math.min(segment, this.duration);
      } else {
        duration = this.duration;
      }
    } else {
      start = startTime - this.startTime;

      if (endTime) {
        duration = Math.min(segment, this.duration - start);
      } else {
        duration = this.duration - start;
      }
    }

    start += this.cueIn;
    const relPos = startTime - this.startTime;
    const sourcePromise = playoutSystem.setUpSource();

    // param relPos: cursor position in seconds relative to this track.
    // can be negative if the cursor is placed before the start of this track etc.
    _forOwn(this.fades, (fade) => {
      let fadeStart;
      let fadeDuration;

      // only apply fade if it's ahead of the cursor.
      if (relPos < fade.end) {
        if (relPos <= fade.start) {
          fadeStart = now + (fade.start - relPos);
          fadeDuration = fade.end - fade.start;
        } else if (relPos > fade.start && relPos < fade.end) {
          fadeStart = now - (relPos - fade.start);
          fadeDuration = fade.end - fade.start;
        }

        switch (fade.type) {
          case FADEIN: {
            playoutSystem.applyFadeIn(fadeStart, fadeDuration, fade.shape);
            break;
          }
          case FADEOUT: {
            playoutSystem.applyFadeOut(fadeStart, fadeDuration, fade.shape);
            break;
          }
          default: {
            throw new Error('Invalid fade type saved on track.');
          }
        }
      }
    });

    playoutSystem.setVolumeGainLevel(this.gain);
    playoutSystem.setShouldPlay(options.shouldPlay);
    playoutSystem.setMasterGainLevel(options.masterGain);
    playoutSystem.setVolumeGainMutes(this.mutes, when - start);
    playoutSystem.play(when, start, duration);

    return sourcePromise;
  }

  scheduleStop(when = 0) {
    this.playout.stop(when);
  }

  renderOverlay(data, start, width) {
    const channelPixels = secondsToPixels(data.playlistLength, data.resolution, data.sampleRate);

    const config = {
      attributes: {
        style: `position: absolute; top: 0; right: 0; bottom: 0; left: ${start}px; width: ${width}px; z-index: 9;`,
      },
    };

    let overlayClass = '';

    if (this.stateObj) {
      this.stateObj.setup(data.resolution, data.sampleRate);
      const StateClass = stateClasses[this.state];
      const events = StateClass.getEvents();

      events.forEach((event) => {
        config[`on${event}`] = this.stateObj[event].bind(this.stateObj);
      });

      overlayClass = StateClass.getClass();
    }
    // use this overlay for track event cursor position calculations.
    return h(`div.playlist-overlay${overlayClass}`, config);
  }

  render(data) {
    const width = this.peaks.length;
    const playbackX = secondsToPixels(data.playbackSeconds, data.resolution, data.sampleRate);
    const startX = secondsToPixels(this.startTime, data.resolution, data.sampleRate);
    const endX = secondsToPixels(this.endTime, data.resolution, data.sampleRate);
    let progressWidth = 0;

    if (playbackX > 0 && playbackX > startX) {
      if (playbackX < endX) {
        progressWidth = playbackX - startX;
      } else {
        progressWidth = width;
      }
    }

    const waveformChildren = [];

    const channels = Object.keys(this.peaks.data).map((channelNum) => {
      const channelChildren = [
        h('div.channel-progress', {
          attributes: {
            style: `position: absolute; width: ${progressWidth}px; height: ${data.height}px; z-index: 2;`,
          },
        }),
      ];
      let offset = 0;
      let totalWidth = width;
      const peaks = this.peaks.data[channelNum];

      while (totalWidth > 0) {
        const currentWidth = Math.min(totalWidth, MAX_CANVAS_WIDTH);
        const canvasColor = this.waveOutlineColor
          ? this.waveOutlineColor
          : data.colors.waveOutlineColor;

        channelChildren.push(h('canvas', {
          attributes: {
            width: currentWidth,
            height: data.height,
            style: 'float: left; position: relative; margin: 0; padding: 0; z-index: 3;',
          },
          hook: new CanvasHook(peaks, offset, this.peaks.bits, canvasColor),
        }));

        totalWidth -= currentWidth;
        offset += MAX_CANVAS_WIDTH;
      }
      for(var i = 0; i < this.mutes.length; i++) {
        const mute = this.mutes[i];

        const relStart = this.cueIn > mute.start? this.cueIn : mute.start;
        const relEnd = this.cueOut < mute.end? this.cueOut : mute.end;

        const muteStart = secondsToPixels(
          relStart - this.cueIn,
          data.resolution,
          data.sampleRate
        );
        const muteWidth = secondsToPixels(
          relEnd - relStart,
          data.resolution,
          data.sampleRate
        );

        if(muteWidth < 0) continue;

        channelChildren.push(h(`div.wp-mute`,
          {
            attributes: {
              style: `position: absolute; height: ${data.height}px; width: ${muteWidth}px; top: 0; left: ${muteStart}px; z-index: 4;`,
            },
          }, [
            h('canvas',
              {
                attributes: {
                  width: muteWidth,
                  height: data.height
                },
                hook: new MuteCanvasHook(
                  relEnd - relStart,
                  data.resolution,
                  muteStart
                ),
              },
            ),
          ]
        ));
      }

      // if there are fades, display them.
      if (this.fadeIn) {
        const fadeIn = this.fades[this.fadeIn];
        const fadeWidth = secondsToPixels(
          fadeIn.end - fadeIn.start,
          data.resolution,
          data.sampleRate,
        );

        channelChildren.push(h('div.wp-fade.wp-fadein',
          {
            attributes: {
              style: `position: absolute; height: ${data.height}px; width: ${fadeWidth}px; top: 0; left: 0; z-index: 4;`,
            },
          }, [
            h('canvas',
              {
                attributes: {
                  width: fadeWidth,
                  height: data.height,
                },
                hook: new FadeCanvasHook(
                  fadeIn.type,
                  fadeIn.shape,
                  fadeIn.end - fadeIn.start,
                  data.resolution,
                ),
              },
            ),
          ],
        ));
      }

      if (this.fadeOut) {
        const fadeOut = this.fades[this.fadeOut];
        const fadeWidth = secondsToPixels(
          fadeOut.end - fadeOut.start,
          data.resolution,
          data.sampleRate,
        );

        channelChildren.push(h('div.wp-fade.wp-fadeout',
          {
            attributes: {
              style: `position: absolute; height: ${data.height}px; width: ${fadeWidth}px; top: 0; right: 0; z-index: 4;`,
            },
          },
          [
            h('canvas', {
              attributes: {
                width: fadeWidth,
                height: data.height,
              },
              hook: new FadeCanvasHook(
                fadeOut.type,
                fadeOut.shape,
                fadeOut.end - fadeOut.start,
                data.resolution,
              ),
            }),
          ],
        ));
      }

      return h(`div.channel.channel-${channelNum}`,
        {
          attributes: {
            style: `height: ${data.height}px; width: ${width}px; top: ${channelNum * data.height}px; left: ${startX}px; position: absolute; margin: 0; padding: 0; z-index: 1;`,
          },
        },
        channelChildren,
      );
    });

    waveformChildren.push(channels);
    waveformChildren.push(this.renderOverlay(data, startX, width));


    return waveformChildren;
  }

  getTrackDetails() {
    const info = {
      src: this.src,
      start: this.startTime,
      end: this.endTime,
      name: this.name,
      customClass: this.customClass,
      cuein: this.cueIn,
      cueout: this.cueOut,
    };

    if (this.fadeIn) {
      const fadeIn = this.fades[this.fadeIn];

      info.fadeIn = {
        shape: fadeIn.shape,
        duration: fadeIn.end - fadeIn.start,
      };
    }

    if (this.fadeOut) {
      const fadeOut = this.fades[this.fadeOut];

      info.fadeOut = {
        shape: fadeOut.shape,
        duration: fadeOut.end - fadeOut.start,
      };
    }

    return info;
  }
}
