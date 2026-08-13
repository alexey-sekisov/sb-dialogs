import { nextId, uiState } from '../state'
import type { LoaderHandle, LoaderOptions } from '../types'
import { ensureUi } from '../ui/mount'

export class LoaderService {
  show(options: LoaderOptions = {}): LoaderHandle {
    ensureUi()
    const record = {
      id: nextId('loader'),
      message: options.message || 'Загрузка…',
    }
    uiState.loaders.push(record)
    let closed = false

    return {
      id: record.id,
      update(next) {
        if (!closed && next.message !== undefined) {
          const current = uiState.loaders.find((item) => item.id === record.id)
          if (current) current.message = next.message
        }
      },
      close() {
        if (closed) return
        closed = true
        const index = uiState.loaders.findIndex((item) => item.id === record.id)
        if (index >= 0) uiState.loaders.splice(index, 1)
      },
    }
  }
}
