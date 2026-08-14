import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'

const umdUrl = new URL('../dist/sb.umd.js', import.meta.url)
const declarationUrl = new URL('../dist/sb.d.ts', import.meta.url)
const checksumUrl = new URL('../dist/sb.umd.js.sha256', import.meta.url)

const [umd, declaration] = await Promise.all([
  readFile(umdUrl),
  readFile(declarationUrl),
])

if (!declaration.includes(Buffer.from('SbApi'))) {
  throw new Error('dist/sb.d.ts не содержит публичный SbApi')
}

const checksum = createHash('sha256').update(umd).digest('hex')
await writeFile(checksumUrl, `${checksum}  sb.umd.js\n`)

console.log(`Release assets готовы: sb.umd.js, sb.d.ts, sb.umd.js.sha256`)
