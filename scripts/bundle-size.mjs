import { gzipSync } from 'node:zlib'
import { readFileSync } from 'node:fs'

const path = new URL('../dist/sb.umd.js', import.meta.url)
const buffer = readFileSync(path)
const format = (bytes) => `${(bytes / 1024).toFixed(1)} KiB`

console.log(`sb.umd.js: ${format(buffer.length)} raw, ${format(gzipSync(buffer).length)} gzip`)
