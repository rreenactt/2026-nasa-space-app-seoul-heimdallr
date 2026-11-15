"use client";

import "client-only";

import type { SoundEvent } from "@/app/_lib/sonata/mapping";

const ATTACK = 0.015;
const RELEASE = 0.12;
const MAX_VOICES = 24;

/**
 * Minimal Web Audio engine. The AudioContext is created only after a user gesture (start()).
 * All notes are scheduled on the audio clock; stop() cancels everything already scheduled.
 */
export class SonataAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private voices = new Set<OscillatorNode>();
  private scanStart = 0;
  volume = 0.5;

  get started() {
    return this.ctx !== null;
  }

  async start() {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") await this.ctx.resume();
  }

  setVolume(v: number) {
    this.volume = v;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.02);
  }

  /** Plays events relative to now (+ offset). Returns the audio-clock time at which the scan starts. */
  play(events: SoundEvent[], offset = 0.05): number {
    if (!this.ctx || !this.master) return 0;
    const t0 = this.ctx.currentTime + offset;
    this.scanStart = t0;
    for (const e of events.slice(0, MAX_VOICES)) this.note(e, t0);
    return t0;
  }

  /** Seconds since the last scan started (audio clock), for the playhead. */
  elapsed() {
    return this.ctx ? this.ctx.currentTime - this.scanStart : 0;
  }

  private note(e: SoundEvent, t0: number) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = e.wave;
    osc.frequency.value = e.frequency;
    const g = ctx.createGain();
    // Square waves sound much louder at the same gain; scale them down.
    const peak = e.wave === "square" ? e.gain * 0.35 : e.gain;
    const start = t0 + e.start;
    const end = start + e.duration;
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(peak, start + ATTACK);
    g.gain.setValueAtTime(peak, Math.max(start + ATTACK, end - RELEASE));
    g.gain.linearRampToValueAtTime(0, end);
    const pan = ctx.createStereoPanner();
    pan.pan.value = e.pan;
    osc.connect(g).connect(pan).connect(this.master!);
    osc.start(start);
    osc.stop(end + 0.02);
    this.voices.add(osc);
    osc.onended = () => {
      this.voices.delete(osc);
      osc.disconnect();
      g.disconnect();
      pan.disconnect();
    };
  }

  /** A short low "no data here" cue: two quick clicks of filtered noise-like square at 110 Hz. */
  noDataCue() {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + 0.02;
    for (const dt of [0, 0.12]) this.note({ sourceId: null, x: 0.5, y: 1, start: dt, duration: 0.06, frequency: 110, pan: 0, gain: 0.25, wave: "square" }, t0);
  }

  private stopListeners = new Set<() => void>();

  /** Called on every stop, so a scheduled follow-up (the A → B scan) is cancelled too. Returns the unsubscribe. */
  onStop(listener: () => void) {
    this.stopListeners.add(listener);
    return () => void this.stopListeners.delete(listener);
  }

  stop() {
    for (const v of this.voices) {
      try {
        v.stop();
      } catch {
        // already stopped
      }
    }
    this.voices.clear();
    for (const l of this.stopListeners) l();
  }

  async dispose() {
    this.stop();
    if (this.ctx) await this.ctx.close();
    this.ctx = null;
    this.master = null;
  }
}
