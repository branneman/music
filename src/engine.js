import { webaudioRepl, getAudioContext, initAudio, registerSynthSounds, getSuperdoughAudioController } from '@strudel/webaudio'

registerSynthSounds()

const { start: _start, pause: _pause, setPattern: _setPattern } = webaudioRepl()
let _resumePromise = null
let _stopTimeout = null

const _masterGain = () => getSuperdoughAudioController().output.destinationGain.gain

export async function start() {
  clearTimeout(_stopTimeout)
  _stopTimeout = null
  _resumePromise ??= getAudioContext().resume().then(() => initAudio())
  await _resumePromise
  await _start()
  const gain = _masterGain()
  const now = getAudioContext().currentTime
  gain.cancelScheduledValues(now)
  gain.setValueAtTime(gain.value, now)
  gain.linearRampToValueAtTime(1, now + 0.1)
}

export function stop() {
  const gain = _masterGain()
  const now = getAudioContext().currentTime
  gain.cancelScheduledValues(now)
  gain.setValueAtTime(gain.value, now)
  gain.linearRampToValueAtTime(0, now + 0.1)
  _stopTimeout = setTimeout(() => _pause(), 110)
}

export function setPattern(pattern) {
  _setPattern(pattern).catch(console.error)
}
