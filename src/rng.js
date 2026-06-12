function _hash(n) {
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b)
  n = Math.imul(n ^ (n >>> 13), 0x9e3779b9)
  return ((n ^ (n >>> 16)) >>> 0) / 0x100000000
}

export function createRng(seed) {
  const s = seed >>> 0
  const at     = i => _hash(s ^ (i >>> 0))
  const range  = (lo, hi, i) => lo + at(i) * (hi - lo)
  const choose = (arr, i) => arr[Math.floor(at(i) * arr.length)]
  return { at, range, choose }
}
