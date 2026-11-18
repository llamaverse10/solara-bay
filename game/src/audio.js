// audio.js — every sound is synthesized with WebAudio. No audio files, no
// network. The context starts on the first user gesture; calls before that
// are no-ops (screenshots run silent).
export class AudioSys {
  constructor() {
    this.ctx = null; this.master = null; this.engineOsc = null;
    this.engineGain = null; this.musicTimer = null; this.muted = false;
  }
  ensure() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      this.startMusic();
    } catch { this.ctx = null; }
  }
  now() { return this.ctx ? this.ctx.currentTime : 0; }
  // Short noise burst through a lowpass filter: gunshots, impacts.
  noise(dur, filterFreq, gain, when = 0) {
    if (!this.ctx || this.muted) return;
    const t = this.now() + when;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = filterFreq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t); src.stop(t + dur + 0.02);
  }
  // Plain oscillator blip: UI, pickups, sirens.
  tone(freq, dur, type, gain, when = 0, slideTo = 0) {
    if (!this.ctx || this.muted) return;
    const t = this.now() + when;
    const o = this.ctx.createOscillator();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  }
  shot() { this.noise(0.16, 2400, 0.5); this.tone(140, 0.09, 'square', 0.22, 0, 60); }
  enemyShot() { this.noise(0.14, 1800, 0.28); }
  punch() { this.noise(0.08, 700, 0.4); }
  pickup() { this.tone(660, 0.1, 'sine', 0.3); this.tone(990, 0.14, 'sine', 0.3, 0.08); }
  coin() { this.tone(880, 0.08, 'triangle', 0.25); this.tone(1318, 0.12, 'triangle', 0.25, 0.07); }
  click() { this.tone(1200, 0.05, 'square', 0.12); }
  mission() { [523, 659, 784].forEach((f, i) => this.tone(f, 0.16, 'triangle', 0.28, i * 0.1)); }
  fail() { [392, 311].forEach((f, i) => this.tone(f, 0.2, 'sawtooth', 0.16, i * 0.14)); }
  sirenBlip() { this.tone(700, 0.35, 'sine', 0.1, 0, 950); }
  crash() { this.noise(0.25, 900, 0.5); }
  reload() { this.tone(300, 0.05, 'square', 0.15); this.tone(420, 0.05, 'square', 0.15, 0.12); }
  // Engine hum: one sawtooth whose pitch follows speed. Call every frame.
  engine(speed01, on) {
    if (!this.ctx || this.muted) return;
    if (!on) {
      if (this.engineGain) this.engineGain.gain.setTargetAtTime(0, this.now(), 0.1);
      return;
    }
    if (!this.engineOsc) {
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = 700;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      this.engineOsc.connect(f); f.connect(this.engineGain); this.engineGain.connect(this.master);
      this.engineOsc.start();
    }
    this.engineOsc.frequency.setTargetAtTime(55 + speed01 * 130, this.now(), 0.08);
    this.engineGain.gain.setTargetAtTime(0.05 + speed01 * 0.06, this.now(), 0.1);
  }
  // Simple sunset groove: a bass line + hats, scheduled a bar ahead.
  startMusic() {
    if (!this.ctx || this.musicTimer) return;
    const bass = [55, 0, 65.4, 0, 49, 0, 58.3, 73.4];
    let step = 0;
    const tick = () => {
      if (!this.ctx || this.muted) return;
      const t = this.now() + 0.05;
      const f = bass[step % bass.length];
      if (f) {
        const o = this.ctx.createOscillator();
        o.type = 'triangle'; o.frequency.value = f;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.14, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
        o.connect(g); g.connect(this.master);
        o.start(t); o.stop(t + 0.25);
      }
      if (step % 2 === 0) this.noise(0.03, 6000, 0.05, 0.05);
      step++;
    };
    this.musicTimer = setInterval(tick, 240);
  }
}
