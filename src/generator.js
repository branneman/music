import { note, stack, cat, sine, perlin, s, irand, rand } from '@strudel/core'

const HARMONIC_ZONES = [
  { id: 'd-aeolian',  root: 'd', notes: ['d','f','a','c','e','g']       },
  { id: 'd-dorian',   root: 'd', notes: ['d','f','a','c','e','g','b']   },
  { id: 'a-aeolian',  root: 'a', notes: ['a','c','e','g','b','d','f']   },
  { id: 'e-phrygian', root: 'e', notes: ['e','g','b','d','f','a','c']   },
  { id: 'g-aeolian',  root: 'g', notes: ['g','bb','d','f','a','c','eb'] },
]

const NUM_ZONES = 12

// Index contract: [root, b3, 5th, b7, 9th*, 4th, b6]
// *index 4 is b2 in E Phrygian — intentional dark shimmer colour (see architecture D7)
const root    = z => z.notes[0]
const fifth   = z => z.notes[2]
const seventh = z => z.notes[3]
const ninth   = z => z.notes[4]
const fourth  = z => z.notes[5]

function buildZoneSeq(rng) {
  return Array.from({ length: NUM_ZONES }, (_, i) =>
    HARMONIC_ZONES[Math.floor(rng.at(i) * HARMONIC_ZONES.length)]
  )
}

// Core zone assembly. ta = notePeriod/S ensures note sequence cycles
// at exactly notePeriod cycles; each zone lasts zoneLenCycles cycles.
function zonePattern(zones, buildVoice, notePeriod, zoneLenCycles) {
  const S  = NUM_ZONES * zoneLenCycles
  const ta = notePeriod / S
  return cat(...zones.map(z => buildVoice(z).slow(ta))).slow(S)
}

function buildSubBassLayer(zones, params, zoneLenCycles) {
  const reg     = Math.round(Math.max(-2, Math.min(2, params.register)))
  const maxGain = 0.42 * params.layerActivity * params.droneDensity
  const dw      = params.detuneSpread

  const buildVoice = zone => {
    const r = root(zone), f = fifth(zone)
    const oct  = Math.max(0, 1 + reg)
    const fOct = Math.max(0, oct - 1)  // fifth one octave lower, min oct 0
    return cat(note(`${r}${oct}`), note(`${r}${oct}`), note(`${f}${fOct}`),
               note(`${r}${oct}`), note(`${r}${oct}`), note(`${f}${fOct}`))
  }

  return zonePattern(zones, buildVoice, 277, zoneLenCycles)
    .s('sine')
    .gain(sine.slow(191).range(0, maxGain))
    .attack(18).sustain(1).release(16)
    .detune(perlin.slow(67).range(-4 * dw, 4 * dw))
    .pan(0.5)
    .room(params.reverbSend).size(params.reverbSize)
    .orbit(1)
}

function buildDroneLayer(zones, params, zoneLenCycles) {
  const reg     = Math.round(Math.max(-2, Math.min(2, params.register)))
  const la      = params.layerActivity * params.droneDensity
  const dw      = params.detuneSpread
  const sw      = params.stereoWidth

  const buildVoice = zone => {
    const r = root(zone), f = fifth(zone), sv = seventh(zone)
    const oct = 2 + reg
    return cat(note(`${r}${oct}`), note(`${r}${oct}`), note(`${f}${oct}`),
               note(`${r}${oct + 1}`), note(`${sv}${oct}`), note(`${f}${oct}`),
               note(`${r}${oct}`), note(`${r}${oct + 1}`))
  }

  const seq  = zonePattern(zones, buildVoice, 277, zoneLenCycles)
  const panA = 0.5 + (0.40 - 0.5) * sw
  const panB = 0.5 + (0.60 - 0.5) * sw

  const droneA = seq
    .s('sine')
    .gain(sine.slow(127).range(0, 0.36 * la))
    .attack(12).sustain(1).release(10)
    .detune(perlin.slow(53).range(-8 * dw, 8 * dw))
    .pan(panA)
    .room(params.reverbSend * 0.99).size(params.reverbSize * 0.98)
    .orbit(1)

  const droneB = seq
    .s('sine')
    .gain(sine.slow(163).range(0, 0.28 * la))
    .attack(14).sustain(1).release(10)
    .detune(perlin.slow(37).range(6 * dw, 22 * dw))
    .pan(panB)
    .room(params.reverbSend * 0.99).size(params.reverbSize * 0.98)
    .orbit(1)

  return stack(droneA, droneB)
}

function buildPadLayer(zones, params, zoneLenCycles) {
  const reg     = Math.round(Math.max(-2, Math.min(2, params.register)))
  const la      = params.layerActivity * params.droneDensity
  const sw      = params.stereoWidth

  const buildVoice = zone => {
    const r = root(zone), f = fifth(zone), sv = seventh(zone), ni = ninth(zone)
    const oct = 3 + reg
    return cat(
      stack(note(`${r}${oct}`), note(`${f}${oct}`), note(`${sv}${oct}`), note(`${ni}${oct + 1}`)),
      stack(note(`${r}${oct}`), note(`${f}${oct}`), note(`${sv}${oct}`), note(`${ni}${oct}`)),
      stack(note(`${r}${oct}`), note(`${sv}${oct}`), note(`${ni}${oct}`), note(`${r}${oct + 1}`))
    )
  }

  const cutoffHi = Math.max(280, 1500 * (1 + params.brightness))
  const panLo    = 0.5 + (0.28 - 0.5) * sw
  const panHi    = 0.5 + (0.72 - 0.5) * sw

  return zonePattern(zones, buildVoice, 421, zoneLenCycles)
    .s('sawtooth')
    .gain(sine.slow(149).range(0, 0.12 * la))
    .attack(9).sustain(1).release(9)
    .cutoff(perlin.slow(97).range(260, cutoffHi))
    .resonance(2)
    .pan(perlin.slow(43).range(panLo, panHi))
    .room(params.reverbSend * 0.91).size(params.reverbSize * 0.97)
    .orbit(2)
}

function buildFmSwellLayer(zones, params, zoneLenCycles) {
  const reg     = Math.round(Math.max(-2, Math.min(2, params.register)))
  const la      = params.layerActivity * params.droneDensity
  const sw      = params.stereoWidth

  const buildVoice = zone => {
    const r = root(zone), fo = fourth(zone), f = fifth(zone), sv = seventh(zone)
    const oct = 3 + reg
    return cat(note(`${r}${oct}`), note(`${fo}${oct}`), note(`${f}${oct}`),
               note(`${sv}${oct}`), note(`${r}${oct}`))
  }

  const cutoffHi = Math.max(420, 2200 * (1 + params.brightness))
  const panLo    = 0.5 + (0.2 - 0.5) * sw
  const panHi    = 0.5 + (0.8 - 0.5) * sw

  return zonePattern(zones, buildVoice, 337, zoneLenCycles)
    .s('sine')
    .fm(perlin.slow(73).range(0.5, 4))
    .fmh(perlin.slow(83).range(0.3, 2))
    .gain(sine.slow(89).range(0, 0.18 * la))
    .attack(11).sustain(1).release(13)
    .cutoff(perlin.slow(73).range(400, cutoffHi))
    .pan(perlin.slow(47).range(panLo, panHi))
    .room(params.reverbSend * 0.94).size(params.reverbSize * 0.98)
    .orbit(3)
}

function buildShimmerLayer(zones, params, zoneLenCycles) {
  const reg     = Math.round(Math.max(-2, Math.min(2, params.register)))
  const la      = params.layerActivity * params.droneDensity
  const dw      = params.detuneSpread
  const sw      = params.stereoWidth

  const buildVoice = zone => {
    const f = fifth(zone), sv = seventh(zone), ni = ninth(zone)
    const oct = 4 + reg
    return cat(note(`${f}${oct}`), note(`${ni}${oct}`), note(`${sv}${oct}`),
               note(`${f}${oct + 1}`), note(`${ni}${oct}`), note(`${sv}${oct + 1}`))
  }

  const panLo = 0.5 + (0.12 - 0.5) * sw
  const panHi = 0.5 + (0.88 - 0.5) * sw

  return zonePattern(zones, buildVoice, 641, zoneLenCycles)
    .s('sine')
    .gain(sine.slow(211).range(0, 0.09 * la))
    .attack(16).sustain(0.8).release(14)
    .detune(perlin.slow(61).range(-22 * dw, 22 * dw))
    .pan(perlin.slow(29).range(panLo, panHi))
    .room(params.reverbSend * 0.97).size(params.reverbSize * 0.99)
    .orbit(4)
}

function buildNoiseAtmosphereLayer(params) {
  const cutoffHi = Math.max(250, 480 * (1 + params.brightness))
  return s("brown")
    .gain(perlin.slow(151).range(0, 0.14 * params.noiseLevel))
    .cutoff(perlin.slow(107).range(100, cutoffHi))
    .resonance(1.5)
    .attack(2).sustain(1).release(2)
    .pan(0.5)
    .room(0.55).size(0.68).orbit(5)
}

function buildIndustrialLayer(params) {
  return s("industrial").n(irand(32))
    .gain(sine.slow(173).range(0, 0.28 * params.layerActivity))
    .speed(perlin.slow(101).range(0.35, 0.95))
    .pan(rand.range(0.05, 0.95))
    .room(0.96).size(0.99).orbit(7)
    .degradeBy(0.80).slow(113)
}

function buildMetalLayer(params) {
  return s("metal").n(irand(10))
    .gain(perlin.slow(157).range(0.05, 0.20 * params.layerActivity))
    .speed(perlin.slow(59).range(0.25, 0.80))
    .pan(rand.range(0.1, 0.9))
    .room(0.97).size(0.99).orbit(8)
    .degradeBy(0.86).slow(79)
}

function buildSparseEventLayer(zones, params, zoneLenCycles) {
  const reg = Math.round(Math.max(-2, Math.min(2, params.register)))

  const buildVoice = zone => {
    const oct = 3 + reg
    const lo  = zone.notes.map(n => note(`${n}${oct}`))
    const hi  = [note(`${root(zone)}${oct+1}`), note(`${fifth(zone)}${oct+1}`), note(`${seventh(zone)}${oct+1}`)]
    return cat(...lo, ...hi)
  }

  return zonePattern(zones, buildVoice, 103, zoneLenCycles)
    .s('sine')
    .gain(perlin.slow(41).range(0.10, 0.24 * params.layerActivity))
    .attack(0.5).sustain(1).release(perlin.slow(19).range(2, 12))
    .pan(rand.range(0.12, 0.88))
    .room(params.reverbSend * 0.97).size(params.reverbSize * 0.99)
    .orbit(6)
    .degradeBy(params.eventSparsity)
}

export function buildPattern(params, rng) {
  const zoneLenCycles = Math.round(1801 / params.harmonicRate)
  const zones = buildZoneSeq(rng)
  return stack(
    buildSubBassLayer(zones, params, zoneLenCycles),
    buildDroneLayer(zones, params, zoneLenCycles),
    buildPadLayer(zones, params, zoneLenCycles),
    buildFmSwellLayer(zones, params, zoneLenCycles),
    buildShimmerLayer(zones, params, zoneLenCycles),
    buildNoiseAtmosphereLayer(params),
    buildSparseEventLayer(zones, params, zoneLenCycles),
    buildIndustrialLayer(params),
    buildMetalLayer(params),
  )
}
