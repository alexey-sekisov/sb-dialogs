import { copyTextToClipboard } from '../clipboard'
import { filenameFromDisposition, saveBlob } from '../download'
import { SbError, toSbError } from '../errors'
import type { CopyOptions, ReloadHandle, ReloadOptions } from '../types'
import type { DialogService } from './dialogs'

export class UtilsService {
  constructor(private readonly dialogs: DialogService) {}

  async copy(text: string, options: CopyOptions = {}): Promise<void> {
    try {
      await copyTextToClipboard(String(text))
      if (options.notify !== false) {
        this.dialogs.toast({ type: 'success', message: options.successMessage || 'Скопировано в буфер обмена' })
      }
    } catch (cause) {
      const error = toSbError(cause, { message: 'Не удалось скопировать текст', code: 'UNKNOWN_ERROR', details: { transport: 'utils' } })
      if (options.notify !== false) this.dialogs.toast({ type: 'error', message: error.message })
      throw error
    }
  }

  async download(source: Blob | Response, filename?: string): Promise<void> {
    try {
      if (source instanceof Response) {
        const resolvedName = filename
          || filenameFromDisposition(source.headers.get('content-disposition'))
          || decodeURIComponent(new URL(source.url || 'download', location.href).pathname.split('/').pop() || 'download')
        saveBlob(await source.blob(), resolvedName)
        return
      }
      saveBlob(source, filename || 'download')
    } catch (cause) {
      const error = new SbError('Не удалось сохранить файл', {
        code: 'UNKNOWN_ERROR',
        details: { transport: 'utils', filename },
        cause,
      })
      void this.dialogs.error({ error })
      throw error
    }
  }

  reload(options: ReloadOptions = {}): ReloadHandle {
    const timer = setTimeout(() => window.location.reload(), Math.max(0, options.delay ?? 0))

    return { cancel: () => clearTimeout(timer) }
  }
}
