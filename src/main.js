import { start, stop } from './engine.js'

const btn = document.getElementById('play-pause')
let playing = false

btn.addEventListener('click', () => {
  if (playing) {
    stop()
    btn.textContent = 'Play'
    btn.setAttribute('aria-label', 'Play')
  } else {
    start()
    btn.textContent = 'Pause'
    btn.setAttribute('aria-label', 'Pause')
  }
  playing = !playing
})
