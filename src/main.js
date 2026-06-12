import { start, stop, setPattern } from './engine.js'
import { buildPattern } from './generator.js'
import { createRng } from './rng.js'
import { params, set, subscribe } from './params.js'

const rng = createRng(12345)

function applyPattern(snapshot) {
  const p = buildPattern(snapshot, rng)
  if (p) setPattern(p)
}

applyPattern(params)
subscribe(applyPattern)

// Dev helpers — test from the browser console:
//   window._rng.at(0)              → float in [0, 1)
//   window._set('reverbSize', 0.5) → updates params + fires subscribe
//   window._getParams()            → current params snapshot
window._rng = rng
window._set = set
window._getParams = () => params

const btn = document.getElementById('play-pause')
let playing = false

btn.addEventListener('click', async () => {
  if (playing) {
    stop()
    btn.textContent = 'Play'
    btn.setAttribute('aria-label', 'Play')
  } else {
    try {
      await start()
    } catch (err) {
      console.error('start() failed:', err)
      return
    }
    btn.textContent = 'Pause'
    btn.setAttribute('aria-label', 'Pause')
  }
  playing = !playing
})
