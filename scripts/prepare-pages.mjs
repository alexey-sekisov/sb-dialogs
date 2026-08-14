import { copyFile, mkdir, stat, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const pagesRoot = resolve(root, 'playground-dist')
const pagesDist = resolve(pagesRoot, 'dist')
const artifacts = ['sb.umd.js', 'sb.d.ts', 'sb.umd.js.sha256']

await stat(resolve(pagesRoot, 'index.html'))
await mkdir(pagesDist, { recursive: true })
for (const artifact of artifacts) {
  const source = resolve(root, 'dist', artifact)
  await stat(source)
  await copyFile(source, resolve(pagesDist, artifact))
}
await writeFile(resolve(pagesRoot, '.nojekyll'), '')

console.log('GitHub Pages artifact prepared in playground-dist/')
