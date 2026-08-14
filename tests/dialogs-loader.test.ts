import { nextTick } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { DialogService } from '../src/services/dialogs'
import { LoaderService } from '../src/services/loader'
import { uiState } from '../src/state'

describe('DialogService и LoaderService', () => {
  it('confirm возвращает false при отмене', async () => {
    const dialogs = new DialogService()
    const promise = dialogs.confirm({ message: 'Продолжить?' })
    expect(uiState.dialogs).toHaveLength(1)
    uiState.dialogs[0]!.cancel()
    await expect(promise).resolves.toBe(false)
  })

  it('prompt возвращает null при закрытии', async () => {
    const dialogs = new DialogService()
    const promise = dialogs.prompt({ title: 'Значение' })
    uiState.dialogs[0]!.cancel()
    await expect(promise).resolves.toBeNull()
  })

  it('closable=false скрывает крестик и запрещает закрытие по Escape', async () => {
    const dialogs = new DialogService()
    let settled = false
    const promise = dialogs.alert({ message: 'Управляемое окно', closable: false }).finally(() => { settled = true })
    await nextTick()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(document.querySelector('[aria-label="Закрыть"]')).toBeNull()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
    await nextTick()
    expect(settled).toBe(false)
    uiState.dialogs[0]!.finish()
    await promise
  })

  it('формирует стек и завершает только нужное окно', async () => {
    const dialogs = new DialogService()
    const first = dialogs.confirm({ message: 'Первое' })
    const second = dialogs.alert({ message: 'Второе' })
    expect(uiState.dialogs.map((item) => item.kind)).toEqual(['confirm', 'alert'])
    uiState.dialogs[1]!.finish()
    await second
    expect(uiState.dialogs).toHaveLength(1)
    uiState.dialogs[0]!.finish(true)
    await expect(first).resolves.toBe(true)
  })

  it('рендерит двухколоночную форму с визуальной секцией', async () => {
    const dialogs = new DialogService()
    const promise = dialogs.form({
      title: 'Параметры',
      columns: 2,
      fields: [
        { type: 'section', title: 'Основное', description: 'Описание секции' },
        { name: 'title', type: 'text', columnSpan: 2 },
      ],
      actions: [],
    })
    await nextTick()
    expect(document.querySelector('.sb-form__fields--columns-2')).not.toBeNull()
    expect(document.querySelector('.sb-form-section')?.textContent).toContain('Основное')
    uiState.dialogs[0]!.cancel()
    await promise
  })

  it('форма защищает несохранённые данные через beforeClose', async () => {
    const dialogs = new DialogService()
    const beforeClose = vi.fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true)
    const promise = dialogs.form({
      fields: [{ name: 'title', type: 'text', defaultValue: 'Задача' }],
      actions: [{ id: 'cancel', label: 'Отмена', cancel: true }],
      beforeClose,
    })
    await nextTick()

    uiState.dialogs[0]!.cancel('dismiss')
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(uiState.dialogs).toHaveLength(1)
    expect(beforeClose).toHaveBeenCalledWith(expect.objectContaining({ reason: 'dismiss', dirty: false }))

    uiState.dialogs[0]!.cancel('cancel')
    await expect(promise).resolves.toBeNull()
    expect(beforeClose).toHaveBeenLastCalledWith(expect.objectContaining({ reason: 'cancel' }))
  })

  it('форма отправляется по Enter и фокусирует первое поле с ошибкой', async () => {
    const dialogs = new DialogService()
    const handler = vi.fn(({ values }) => values)
    const promise = dialogs.form({
      fields: [
        { name: 'title', type: 'text', required: true },
        { name: 'code', type: 'text', autofocus: true },
      ],
      actions: [{ id: 'save', label: 'Сохранить', handler }],
    })
    await nextTick()
    await new Promise((resolve) => setTimeout(resolve, 0))
    const code = document.querySelector<HTMLInputElement>('#sb-field-code')!
    expect(document.activeElement).toBe(code)

    code.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(handler).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(document.querySelector('#sb-field-title'))

    uiState.dialogs[0]!.cancel()
    await promise
  })

  it('форма загружает динамические options и не рендерит скрытые поля', async () => {
    const dialogs = new DialogService()
    const optionsProvider = vi.fn().mockResolvedValue([{ value: 'new', label: 'Новый' }])
    const promise = dialogs.form({
      initialValues: { mode: 'simple' },
      fields: [
        { name: 'mode', type: 'text' },
        { name: 'secret', type: 'text', visibleWhen: (values) => values.mode === 'advanced' },
        { name: 'status', type: 'select', optionsDeps: ['mode'], options: optionsProvider },
      ],
      actions: [],
    })
    await nextTick()
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(optionsProvider).toHaveBeenCalledWith(expect.objectContaining({ mode: 'simple' }))
    expect(document.querySelector('#sb-field-secret')).toBeNull()
    expect(document.querySelector('#sb-field-status')).not.toBeNull()

    uiState.dialogs[0]!.cancel()
    await promise
  })

  it('toast закрывается по таймеру и поддерживает ручное закрытие', async () => {
    vi.useFakeTimers()
    const dialogs = new DialogService()
    const handle = dialogs.toast({ message: 'Сохранено', timeout: 100 })
    expect(uiState.toasts).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(101)
    await handle.closed
    expect(uiState.toasts).toHaveLength(0)
  })

  it('toast поддерживает update, action и дедупликацию', async () => {
    const dialogs = new DialogService()
    const action = vi.fn()
    const first = dialogs.toast({
      message: 'Сохранено',
      timeout: 0,
      action: { label: 'Отменить', handler: action },
    })
    const duplicate = dialogs.toast({ message: 'Сохранено', timeout: 0 })

    expect(duplicate.id).toBe(first.id)
    expect(uiState.toasts).toHaveLength(1)
    first.update({ message: 'Обновлено' })
    await nextTick()
    expect(uiState.toasts[0]!.message).toBe('Обновлено')
    expect(document.querySelector('.sb-toast__message')?.textContent).toBe('Обновлено')

    first.update({ action: { label: 'Отменить', handler: action } })
    uiState.toasts[0]!.runAction(new MouseEvent('click'))
    await first.closed
    expect(action).toHaveBeenCalledOnce()
    expect(uiState.toasts).toHaveLength(0)
  })

  it('loader handles независимы, update реактивно меняет запись, close идемпотентен', () => {
    const service = new LoaderService()
    const first = service.show({ message: 'A' })
    const second = service.show({ message: 'B' })
    first.update({ message: 'A2' })
    expect(uiState.loaders.map((item) => item.message)).toEqual(['A2', 'B'])
    first.close()
    first.close()
    expect(uiState.loaders.map((item) => item.message)).toEqual(['B'])
    second.close()
  })
})
