import { gzipSync } from 'node:zlib'
import { appendFileSync, readFileSync } from 'node:fs'

const path = new URL('../dist/sb.umd.js', import.meta.url)
const buffer = readFileSync(path)
const format = (bytes) => `${(bytes / 1024).toFixed(1)} KiB`
const source = buffer.toString('utf8')
const cssMarker = 's.textContent='
const cssStart = source.indexOf(cssMarker)
const cssEnd = cssStart < 0 ? -1 : source.indexOf(';document.head.appendChild(s)};', cssStart)
const css = cssStart >= 0 && cssEnd >= 0
  ? Buffer.from(JSON.parse(source.slice(cssStart + cssMarker.length, cssEnd)))
  : Buffer.alloc(0)
const javascript = css.length
  ? Buffer.from(`${source.slice(0, cssStart + cssMarker.length)}""${source.slice(cssEnd)}`)
  : buffer

const rows = [
  ['Всего', buffer],
  ['JavaScript', javascript],
  ['Встроенный CSS', css],
].map(([label, content]) => ({
  label,
  raw: content.length,
  gzip: gzipSync(content).length,
}))

console.log(`sb.umd.js: ${format(rows[0].raw)} raw, ${format(rows[0].gzip)} gzip`)
for (const row of rows.slice(1)) {
  console.log(`  ${row.label}: ${format(row.raw)} raw, ${format(row.gzip)} gzip`)
}

if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, [
    '### Размер UMD',
    '',
    '| Часть | Raw | Gzip |',
    '| --- | ---: | ---: |',
    ...rows.map((row) => `| ${row.label} | ${format(row.raw)} | ${format(row.gzip)} |`),
    '',
  ].join('\n'))
}
