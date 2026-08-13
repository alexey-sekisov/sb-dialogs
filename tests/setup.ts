import { afterEach, vi } from 'vitest'
import { uiState } from '../src/state'
import { destroyUi } from '../src/ui/mount'

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

Object.defineProperty(globalThis, 'ResizeObserver', { value: ResizeObserverMock, configurable: true })
Object.defineProperty(globalThis, 'PointerEvent', { value: MouseEvent, configurable: true })
Object.defineProperty(globalThis, 'CSS', {
  value: { supports: () => false, escape: (value: string) => value },
  configurable: true,
})

afterEach(() => {
  uiState.dialogs.splice(0)
  uiState.loaders.splice(0)
  uiState.toasts.splice(0)
  destroyUi()
  document.body.innerHTML = ''
  vi.useRealTimers()
  vi.restoreAllMocks()
})
