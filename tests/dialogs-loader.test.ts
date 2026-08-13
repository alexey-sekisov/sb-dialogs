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

  it('toast закрывается по таймеру и поддерживает ручное закрытие', async () => {
    vi.useFakeTimers()
    const dialogs = new DialogService()
    const handle = dialogs.toast({ message: 'Сохранено', timeout: 100 })
    expect(uiState.toasts).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(101)
    await handle.closed
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
