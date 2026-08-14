import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import bitrix24UI from '@bitrix24/b24ui-nuxt/vite'
import dts from 'unplugin-dts/vite'
import postcss from 'postcss'
import prefixSelector from 'postcss-prefix-selector'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const usedB24Themes = [
  'button',
  'checkbox',
  'input',
  'modal',
  'radio-group',
  'select',
  'separator',
  'textarea',
  'tooltip',
]

function limitB24ThemeSources(): Plugin {
  return {
    name: 'sb-limit-b24-theme-sources',
    config(config) {
      // B24UI generates this cache file in an earlier config hook on every run.
      const themeFile = resolve(config.root || '.', 'node_modules/.b24ui-nuxt/b24ui.css')
      const code = readFileSync(themeFile, 'utf8')
      if (!code.includes('@source "./b24ui";')) {
        throw new Error('Не удалось ограничить набор B24UI-тем: изменился формат b24ui.css')
      }
      writeFileSync(themeFile, code.replace(
        '@source "./b24ui";',
        usedB24Themes.map((theme) => `@source "./b24ui/${theme}.ts";`).join('\n'),
      ))
    },
  }
}

function injectCssIntoUmd(): Plugin {
  return {
    name: 'sb-inject-css-into-umd',
    apply: 'build',
    enforce: 'post',
    async generateBundle(_options, bundle) {
      const cssAssets = Object.values(bundle).filter(
        (item) => item.type === 'asset' && item.fileName.endsWith('.css'),
      )
      const sourceCss = cssAssets.map((asset) => String((asset as { source: string | Uint8Array }).source)).join('\n')
      const css = (await postcss([
        prefixSelector({
          prefix: '#sb-ui-root',
          exclude: [/^@/, /^from$/, /^to$/, /^\d+%$/],
          transform(prefix: string, selector: string, prefixedSelector: string) {
            if (selector.includes(':root') || selector.includes(':host')) {
              return selector.split(':root').join(prefix).split(':host').join(prefix)
            }
            if (selector === 'html' || selector === 'body') return prefix
            if (selector.startsWith('html ')) return `${prefix} ${selector.slice(5)}`
            if (selector.startsWith('body ')) return `${prefix} ${selector.slice(5)}`
            return prefixedSelector
          },
        }),
      ]).process(sourceCss, { from: undefined })).css
      if (!css) return

      const injection = `;globalThis[Symbol.for('first-bit.sb.inject-styles')]=()=>{if(typeof document==='undefined'||document.getElementById('sb-ui-styles'))return;const s=document.createElement('style');s.id='sb-ui-styles';s.textContent=${JSON.stringify(css)};document.head.appendChild(s)};`
      for (const item of Object.values(bundle)) {
        if (item.type === 'chunk' && item.isEntry) item.code = injection + item.code
      }
      for (const asset of cssAssets) delete bundle[asset.fileName]
    },
  }
}

export default defineConfig(({ mode }) => ({
  base: mode === 'playground' ? './' : undefined,
  plugins: [
    vue(),
    bitrix24UI({
      autoImport: false,
      colorMode: false,
      components: false,
      dts: false,
      prose: false,
      router: false,
    }),
    limitB24ThemeSources(),
    ...(mode === 'playground' ? [] : [
      dts({
        bundleTypes: true,
        include: ['src/**/*.ts', 'src/**/*.vue'],
        outDirs: 'dist',
        processor: 'vue',
        tsconfigPath: './tsconfig.json',
      }),
      injectCssIntoUmd(),
    ]),
  ],
  build: mode === 'playground'
    ? { outDir: 'playground-dist' }
    : {
        target: 'es2020',
        outDir: 'dist',
        emptyOutDir: true,
        cssCodeSplit: false,
        lib: {
          entry: 'src/index.ts',
          name: 'SbBundle',
          formats: ['umd'],
          fileName: () => 'sb.umd.js',
        },
        rollupOptions: { output: { inlineDynamicImports: true, exports: 'named' } },
        minify: 'esbuild',
        sourcemap: false,
      },
  test: {
    environment: 'jsdom',
    setupFiles: ['tests/setup.ts'],
    css: true,
    restoreMocks: true,
  },
}))
