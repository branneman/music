import { note, stack, cat, sine, perlin } from '@strudel/core'

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
    const oct  = 1 + reg
    const fOct = Math.max(0, oct - 1)  // fifth one octave lower, min oct 0
    return note(`<${r}${oct} ${r}${oct} ${f}${fOct} ${r}${oct} ${r}${oct} ${f}${fOct}>`)
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
    return note(
      `<${r}${oct} ${r}${oct} ${f}${oct} ${r}${oct + 1} ${sv}${oct} ${f}${oct} ${r}${oct} ${r}${oct + 1}>`
    )
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

export function buildPattern(params, rng) {
  const zoneLenCycles = Math.round(1801 / params.harmonicRate)
  const zones = buildZoneSeq(rng)
  return stack(
    buildSubBassLayer(zones, params, zoneLenCycles),
    buildDroneLayer(zones, params, zoneLenCycles),
  )
}
