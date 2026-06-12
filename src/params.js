// Musical meaning of each knob: see docs/generative-pattern.md §Future control surface.
export const PARAMS = {
  masterGain:    { default: 1.0,  min: 0,  max: 1,  label: 'Master gain' },
  reverbSize:    { default: 0.96, min: 0,  max: 1,  label: 'Reverb size' },
  reverbSend:    { default: 0.90, min: 0,  max: 1,  label: 'Reverb send' },
  detuneSpread:  { default: 1.0,  min: 0,  max: 2,  label: 'Detune spread' },
  droneDensity:  { default: 1.0,  min: 0,  max: 2,  label: 'Drone density' },
  harmonicRate:  { default: 1.0,  min: 0,  max: 2,  label: 'Harmonic movement rate' },
  noiseLevel:    { default: 1.0,  min: 0,  max: 2,  label: 'Noise bed level' },
  eventSparsity: { default: 0.72, min: 0,  max: 1,  label: 'Event sparsity' },
  brightness:    { default: 0.0,  min: -1, max: 1,  label: 'Brightness' },
  layerActivity: { default: 0.8,  min: 0,  max: 1,  label: 'Layer activity' },
  register:      { default: 0,    min: -2, max: 2,  label: 'Register / octave centre' },
  stereoWidth:   { default: 1.0,  min: 0,  max: 2,  label: 'Stereo width' },
}

const _subscribers = new Set()

export const params = Object.fromEntries(
  Object.entries(PARAMS).map(([k, v]) => [k, v.default])
)

export function set(key, val) {
  if (!(key in PARAMS)) return
  const { min, max } = PARAMS[key]
  params[key] = Math.min(max, Math.max(min, val))
  _subscribers.forEach(cb => cb({ ...params }))
}

export function subscribe(cb) {
  _subscribers.add(cb)
  return () => _subscribers.delete(cb)
}
