import { describe, expect, it, vi } from 'vitest'
import { SbError } from '../src/errors'
import { HttpService } from '../src/services/http'

function createService() {
  const close = vi.fn()
  const show = vi.fn(() => ({ id: 'loader', update: vi.fn(), close }))
  const error = vi.fn(async () => undefined)
  const service = new HttpService({ show } as any, { error } as any)
  return { service, show, close, error }
}

describe('HttpService', () => {
  it('сериализует plain object в JSON и разбирает JSON-ответ', async () => {
    const { service, close } = createService()
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{"id":42}', {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }))

    await expect(service.post<{ id: number }>('/items', { title: 'Test' })).resolves.toEqual({ id: 42 })
    const init = fetchMock.mock.calls[0]![1]!
    expect(init.method).toBe('POST')
    expect(init.body).toBe('{"title":"Test"}')
    expect(new Headers(init.headers).get('content-type')).toBe('application/json')
    expect(close).toHaveBeenCalledOnce()
  })

  it('поддерживает query-массивы и text response', async () => {
    const { service } = createService()
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('ok', {
      headers: { 'content-type': 'text/plain' },
    }))
    await expect(service.get('/find', { query: { id: [1, 2], empty: null } })).resolves.toBe('ok')
    const url = String(fetchMock.mock.calls[0]![0])
    expect(url).toContain('id=1&id=2')
    expect(url).not.toContain('empty')
  })

  it('показывает non-2xx и всё равно отклоняет Promise', async () => {
    const { service, error, close } = createService()
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{"reason":"bad"}', {
      status: 422,
      headers: { 'content-type': 'application/json' },
    }))
    const promise = service.get('/bad')
    await expect(promise).rejects.toMatchObject({ code: 'HTTP_ERROR', details: { status: 422 } })
    expect(error).toHaveBeenCalledOnce()
    expect(close).toHaveBeenCalledOnce()
  })

  it('распознаёт бизнес-ошибку настраиваемым detector', async () => {
    const { service } = createService()
    service.configure({ detectError: (payload: any) => payload.ok ? false : { message: payload.message, code: 'INVALID' } })
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{"ok":false,"message":"Нельзя"}', {
      headers: { 'content-type': 'application/json' },
    }))
    await expect(service.get('/business', { notifyError: false })).rejects.toMatchObject({
      code: 'BUSINESS_ERROR',
      message: 'Нельзя',
    })
  })

  it('отменяет группу без error-окна', async () => {
    const { service, error, close } = createService()
    vi.spyOn(globalThis, 'fetch').mockImplementation((_url, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
    }))
    const request = service.get('/slow', { group: 'search' })
    service.cancelGroup('search')
    await expect(request).rejects.toMatchObject({ code: 'ABORTED' })
    expect(error).not.toHaveBeenCalled()
    expect(close).toHaveBeenCalledOnce()
  })

  it('отличает timeout от обычной отмены', async () => {
    vi.useFakeTimers()
    const { service } = createService()
    vi.spyOn(globalThis, 'fetch').mockImplementation((_url, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
    }))
    const request = service.get('/slow', { timeout: 50, notifyError: false })
    const assertion = expect(request).rejects.toMatchObject({ code: 'TIMEOUT' })
    await vi.advanceTimersByTimeAsync(51)
    await assertion
  })

  it('возвращает нативный Response в raw-режиме', async () => {
    const { service } = createService()
    const response = new Response('raw')
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(response)
    await expect(service.get('/raw', { responseType: 'response' })).resolves.toBe(response)
  })

  it('возвращает SbError при некорректном JSON', async () => {
    const { service } = createService()
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{bad', {
      headers: { 'content-type': 'application/json' },
    }))
    const error = await service.get('/json', { notifyError: false }).catch((reason) => reason)
    expect(error).toBeInstanceOf(SbError)
    expect(error).toMatchObject({ code: 'PARSE_ERROR' })
  })
})
