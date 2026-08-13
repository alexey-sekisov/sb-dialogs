import { createApp, type App } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import SbHost from './SbHost.vue'

let app: App<Element> | null = null
const styleInjector = Symbol.for('first-bit.sb.inject-styles')

export function ensureUi(): HTMLElement {
  if (typeof document === 'undefined') {
    throw new Error('Интерфейс Sb доступен только в браузере')
  }

  ;(globalThis as typeof globalThis & { [styleInjector]?: () => void })[styleInjector]?.()

  let root = document.getElementById('sb-ui-root')
  if (!root) {
    root = document.createElement('div')
    root.id = 'sb-ui-root'
    root.className = 'bitrix-desktop light'
    document.body.appendChild(root)
  }

  if (!app) {
    app = createApp(SbHost)
    app.use(createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/:pathMatch(.*)*', component: { render: () => null } }],
    }))
    app.mount(root)
  }
  return root
}

export function destroyUi(): void {
  app?.unmount()
  app = null
  document.getElementById('sb-ui-root')?.remove()
}
