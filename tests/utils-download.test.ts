import { describe, expect, it, vi } from 'vitest'
import { filenameFromDisposition } from '../src/download'
import { UtilsService } from '../src/services/utils'

describe('download и utils', () => {
  it('извлекает обычное и UTF-8 имя файла', () => {
    expect(filenameFromDisposition('attachment; filename="report.pdf"')).toBe('report.pdf')
    expect(filenameFromDisposition("attachment; filename*=UTF-8''%D0%BE%D1%82%D1%87%D1%91%D1%82.pdf")).toBe('отчёт.pdf')
  })

  it('копирует и показывает success toast', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    const toast = vi.fn()
    const utils = new UtilsService({ toast } as any)
    await utils.copy('text')
    expect(writeText).toHaveBeenCalledWith('text')
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ type: 'success' }))
  })

  it('reload можно отменить', () => {
    vi.useFakeTimers()
    const utils = new UtilsService({} as any)
    const handle = utils.reload({ delay: 100 })
    handle.cancel()
    expect(vi.getTimerCount()).toBe(0)
  })
})
