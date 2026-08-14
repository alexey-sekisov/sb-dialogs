import { readFileSync } from 'node:fs'

const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const tag = process.env.GITHUB_REF_NAME || process.argv[2]
const expected = `v${packageJson.version}`

if (!tag) {
  throw new Error('Не указан release tag: передайте его аргументом или через GITHUB_REF_NAME')
}

if (tag !== expected) {
  throw new Error(`Release tag ${tag} не совпадает с package.json: ожидался ${expected}`)
}

console.log(`Release tag ${tag} соответствует package.json`)
