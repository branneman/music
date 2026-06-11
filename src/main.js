import { start, stop, setPattern } from './engine.js'
import { note, sequence } from '@strudel/core'

// Throwaway test patterns — replaced by buildPattern(params, rng) in Story 3
const patternA = note(sequence('c3', 'c3', 'g3', 'c3')).sound('sine').slow(8)
const patternB = note(sequence('e3', 'e3', 'b3', 'e3')).sound('sine').slow(8)

setPattern(patternA)

// Run from browser console to verify live swap: _swapPattern()
window._swapPattern = () => setPattern(patternB)
window._swapBack = () => setPattern(patternA)

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
