import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import bitrix24UI from '@bitrix24/b24ui-nuxt/vite'
import postcss from 'postcss'
import prefixSelector from 'postcss-prefix-selector'

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
    bitrix24UI(),
    tailwindcss(),
    ...(mode === 'playground' ? [] : [injectCssIntoUmd()]),
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
