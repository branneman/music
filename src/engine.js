import { webaudioRepl, getAudioContext, initAudio, registerSynthSounds, getSuperdoughAudioController } from '@strudel/webaudio'

registerSynthSounds()

const { start: _start, setPattern: _setPattern } = webaudioRepl()
let _resumePromise = null
let _schedulerStarted = false

const _masterGain = () => getSuperdoughAudioController().output.destinationGain.gain

export async function start() {
  _resumePromise ??= getAudioContext().resume().then(() => initAudio())
  await _resumePromise
  if (!_schedulerStarted) {
    await _start()
    _schedulerStarted = true
  }
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
}

export function setPattern(pattern) {
  _setPattern(pattern).catch(console.error)
}
