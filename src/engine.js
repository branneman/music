import { webaudioRepl, getAudioContext } from '@strudel/webaudio'

const { start: _start, pause: _pause, setPattern: _setPattern } = webaudioRepl()
let audioResumed = false

export async function start() {
  if (!audioResumed) {
    await getAudioContext().resume()
    audioResumed = true
  }
  _start()
}

export function stop() {
  _pause()
}

export function setPattern(pattern) {
  _setPattern(pattern)
}
