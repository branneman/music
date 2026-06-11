import { webaudioRepl, getAudioContext } from '@strudel/webaudio'

const { start: _start, pause: _pause, setPattern: _setPattern } = webaudioRepl()
let _resumePromise = null

export async function start() {
  _resumePromise ??= getAudioContext().resume()
  await _resumePromise
  await _start()
}

export function stop() {
  _pause()
}

export function setPattern(pattern) {
  _setPattern(pattern).catch(console.error)
}
