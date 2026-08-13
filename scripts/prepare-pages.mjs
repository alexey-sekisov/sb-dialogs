import { copyFile, mkdir, stat, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const source = resolve(root, 'dist/sb.umd.js')
const pagesRoot = resolve(root, 'playground-dist')
const target = resolve(pagesRoot, 'dist/sb.umd.js')

await stat(source)
await stat(resolve(pagesRoot, 'index.html'))
await mkdir(dirname(target), { recursive: true })
await copyFile(source, target)
await writeFile(resolve(pagesRoot, '.nojekyll'), '')

console.log('GitHub Pages artifact prepared in playground-dist/')
