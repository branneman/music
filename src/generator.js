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

export function buildPattern(params, rng) {
  const zoneLenCycles = Math.round(1801 / params.harmonicRate)
  const zones = buildZoneSeq(rng)
  return stack()  // placeholder — filled out task by task
}
