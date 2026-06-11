#!/usr/bin/env node
// One-time setup script: downloads curated sample banks from Dirt-Samples into
// public/samples/ for offline use.  Safe to re-run — existing files are skipped.
// Usage: npm run vendor-samples

import { mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(__dirname, '..', 'public', 'samples')
const GITHUB_RAW =
  'https://raw.githubusercontent.com/tidalcycles/Dirt-Samples/master'

// Banks to vendor.  Add more here and re-run to extend the palette.
// All files listed explicitly so the manifest is auditable and deterministic.
// prettier-ignore
const BANKS = {
  industrial: [
    '000_01.wav', '001_02.wav', '002_03.wav', '003_04.wav', '004_05.wav',
    '005_06.wav', '006_07.wav', '007_08.wav', '008_09.wav', '009_10.wav',
    '010_11.wav', '011_12.wav', '012_13.wav', '013_14.wav', '014_15.wav',
    '015_16.wav', '016_17.wav', '017_18.wav', '018_19.wav', '019_20.wav',
    '020_21.wav', '021_22.wav', '022_23.wav', '023_24.wav', '024_25.wav',
    '025_26.wav', '026_27.wav', '027_28.wav', '028_29.wav', '029_30.wav',
    '030_31.wav', '031_32.wav',
  ],
  metal: [
    '000_0.wav', '001_1.wav', '002_2.wav', '003_3.wav', '004_4.wav',
    '005_5.wav', '006_6.wav', '007_7.wav', '008_8.wav', '009_9.wav',
  ],
};

async function download(url, dest) {
  if (existsSync(dest)) {
    process.stdout.write(`  skip   ${dest}\n`)
    return
  }
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`)
  const buf = Buffer.from(await res.arrayBuffer())
  writeFileSync(dest, buf)
  process.stdout.write(
    `  wrote  ${dest} (${(buf.length / 1024).toFixed(1)} KB)\n`,
  )
}

const manifest = { _base: '/samples/' }

for (const [bank, files] of Object.entries(BANKS)) {
  const dir = join(OUT_DIR, bank)
  mkdirSync(dir, { recursive: true })
  manifest[bank] = []
  console.log(`\n[${bank}] — ${files.length} files`)
  for (const file of files) {
    await download(`${GITHUB_RAW}/${bank}/${file}`, join(dir, file))
    manifest[bank].push(`${bank}/${file}`)
  }
}

writeFileSync(
  join(OUT_DIR, 'strudel.json'),
  JSON.stringify(manifest, null, 2) + '\n',
)
console.log('\nWrote public/samples/strudel.json')
console.log('Commit public/samples/ to track vendored files in the repo.')
