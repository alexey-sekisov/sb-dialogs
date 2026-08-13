import { nextTick } from 'vue'
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
    const id = nextId('toast')
    let resolveClosed!: () => void
    let timer: ReturnType<typeof setTimeout> | undefined
    let remaining = options.timeout ?? 5_000
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
    const record: ToastRecord = {
      id,
      title: options.title,
      message: options.message,
      type: options.type ?? 'info',
      timeout: options.timeout ?? 5_000,
      closable: options.closable ?? true,
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
    }
    uiState.toasts.push(record)
    start()

    return { id, closed: closedPromise, close: remove }
  }

  private open<T>(kind: DialogKind, options: Record<string, any>, cancelValue: T, technical?: string): Promise<T> {
    ensureUi()
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null

    return new Promise<T>((resolve) => {
      let settled = false
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
        cancel: () => finish(cancelValue),
      }
      uiState.dialogs.push(record)
    })
  }
}
