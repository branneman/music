import { webaudioRepl, getAudioContext, initAudio, registerSynthSounds } from '@strudel/webaudio'

registerSynthSounds()

const { start: _start, pause: _pause, setPattern: _setPattern } = webaudioRepl()
let _resumePromise = null

export async function start() {
  _resumePromise ??= getAudioContext().resume().then(() => initAudio())
  await _resumePromise
  await _start()
}

export function stop() {
  _pause()
}

export function setPattern(pattern) {
  _setPattern(pattern).catch(console.error)
}
