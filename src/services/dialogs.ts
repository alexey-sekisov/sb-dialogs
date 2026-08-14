import { nextTick, reactive } from 'vue'
import { technicalText } from '../errors'
import { nextId, uiState, type DialogKind, type DialogRecord, type ToastRecord } from '../state'
import type {
  AlertOptions,
  ConfirmOptions,
  CustomDialogOptions,
  ErrorDialogOptions,
  FormDialogOptions,
  PromptOptions,
  ToastHandle,
  ToastOptions,
} from '../types'
import { ensureUi } from '../ui/mount'

export class DialogService {
  alert(options: AlertOptions): Promise<void> {
    return this.open<void>('alert', { title: 'Сообщение', buttonLabel: 'ОК', ...options }, undefined)
  }

  confirm(options: ConfirmOptions): Promise<boolean> {
    return this.open<boolean>(
      'confirm',
      { title: 'Подтверждение', confirmLabel: 'Да', cancelLabel: 'Отмена', ...options },
      false,
    )
  }

  prompt(options: PromptOptions): Promise<string | null> {
    return this.open<string | null>(
      'prompt',
      {
        title: 'Введите значение',
        inputType: 'text',
        defaultValue: '',
        confirmLabel: 'ОК',
        cancelLabel: 'Отмена',
        ...options,
      },
      null,
    )
  }

  error(options: ErrorDialogOptions): Promise<void> {
    const error = options.error
    const message = options.message
      || (error instanceof Error ? error.message : typeof error === 'string' ? error : 'Произошла неизвестная ошибка')
    return this.open<void>(
      'error',
      { title: 'Ошибка', buttonLabel: 'Закрыть', ...options, message },
      undefined,
      technicalText(error ?? message, options.details),
    )
  }

  form(options: FormDialogOptions): Promise<unknown | null> {
    return this.open<unknown | null>('form', {
      ...options,
      onHandlerError: (error: unknown) => void this.error({ error }),
    }, null)
  }

  custom(options: CustomDialogOptions): Promise<unknown | null> {
    return this.open<unknown | null>('custom', {
      ...options,
      onHandlerError: (error: unknown) => void this.error({ error }),
    }, null)
  }

  toast(options: ToastOptions): ToastHandle {
    ensureUi()
    const type = options.type ?? 'info'
    let dedupe = options.dedupe ?? true
    const makeDedupeKey = (currentType: string, title: string | undefined, message: string) => typeof dedupe === 'string'
      ? dedupe
      : dedupe === false
        ? undefined
        : `${currentType}\u0000${title || ''}\u0000${message}`
    const dedupeKey = makeDedupeKey(type, options.title, options.message)
    const existing = dedupeKey && uiState.toasts.find((item) => item.dedupeKey === dedupeKey)
    if (existing) {
      existing.update(options)
      return existing.handle
    }

    const id = nextId('toast')
    let resolveClosed!: () => void
    let timer: ReturnType<typeof setTimeout> | undefined
    const defaultTimeout = type === 'success' ? 4_000 : type === 'warning' ? 7_000 : type === 'error' ? 9_000 : 5_000
    let remaining = options.timeout ?? defaultTimeout
    let startedAt = 0
    let closed = false
    const closedPromise = new Promise<void>((resolve) => { resolveClosed = resolve })

    const remove = () => {
      if (closed) return
      closed = true
      clearTimeout(timer)
      const index = uiState.toasts.findIndex((item) => item.id === id)
      if (index >= 0) uiState.toasts.splice(index, 1)
      resolveClosed()
    }
    const start = () => {
      if (closed || remaining <= 0 || record.timeout === 0) return
      startedAt = Date.now()
      timer = setTimeout(remove, remaining)
    }
    const restart = () => {
      clearTimeout(timer)
      timer = undefined
      remaining = record.timeout
      record.progressKey += 1
      start()
    }
    const update = (patch: Partial<ToastOptions>) => {
      if (closed) return
      if ('title' in patch) record.title = patch.title
      if (patch.message !== undefined) record.message = patch.message
      if (patch.type !== undefined) record.type = patch.type
      if (patch.timeout !== undefined) record.timeout = patch.timeout
      if (patch.closable !== undefined) record.closable = patch.closable
      if ('action' in patch) record.action = patch.action
      if (patch.dedupe !== undefined) dedupe = patch.dedupe
      record.dedupeKey = makeDedupeKey(record.type, record.title, record.message)
      restart()
    }
    let handle!: ToastHandle
    const thisService = this
    const record = reactive<ToastRecord>({
      id,
      dedupeKey,
      title: options.title,
      message: options.message,
      type,
      timeout: options.timeout ?? defaultTimeout,
      closable: options.closable ?? true,
      action: options.action,
      actionLoading: false,
      progressKey: 0,
      get handle() { return handle },
      update,
      async runAction(event) {
        if (record.actionLoading || !record.action) return
        record.actionLoading = true
        try {
          const result = await record.action.handler?.({ toast: handle, event })
          if (result !== false) remove()
        } catch (error) {
          void thisService.error({ error })
        } finally {
          record.actionLoading = false
        }
      },
      close: remove,
      pause() {
        if (!timer) return
        clearTimeout(timer)
        timer = undefined
        remaining = Math.max(0, remaining - (Date.now() - startedAt))
      },
      resume() {
        if (!timer) start()
      },
    })
    handle = { id, closed: closedPromise, update, close: remove }

    const maxVisible = Math.max(1, options.maxVisible ?? 5)
    while (uiState.toasts.length >= maxVisible) uiState.toasts[0]?.close()
    uiState.toasts.push(record)
    start()

    return handle
  }

  private open<T>(kind: DialogKind, options: Record<string, any>, cancelValue: T, technical?: string): Promise<T> {
    ensureUi()
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null

    return new Promise<T>((resolve) => {
      let settled = false
      let cancelPending = false
      const finish = (value: unknown = cancelValue) => {
        if (settled) return
        settled = true
        const index = uiState.dialogs.findIndex((item) => item.id === record.id)
        if (index >= 0) uiState.dialogs.splice(index, 1)
        resolve(value as T)
        void nextTick(() => opener?.isConnected && opener.focus())
      }
      const record: DialogRecord = {
        id: nextId('dialog'),
        kind,
        options,
        technical,
        finish,
        cancel: (reason = 'cancel') => {
          if (settled || cancelPending) return
          cancelPending = true
          void Promise.resolve(record.beforeCancel?.(reason)).then((allowed) => {
            if (allowed !== false) finish(cancelValue)
          }).catch((error) => {
            options.onHandlerError?.(error)
          }).finally(() => {
            cancelPending = false
          })
        },
      }
      uiState.dialogs.push(record)
    })
  }
}
