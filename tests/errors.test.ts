import { describe, expect, it } from 'vitest'
import { SbError, sanitizeTechnicalValue, technicalText } from '../src/errors'

describe('ошибки', () => {
  it('редактирует секретные поля и query-параметры', () => {
    const value = sanitizeTechnicalValue({
      password: 'secret',
      url: 'https://example.test/api?token=secret&id=42',
      nested: { authorization: 'Bearer token' },
    }) as any

    expect(value.password).toBe('[СКРЫТО]')
    expect(value.url).toContain('token=%5B%D0%A1%D0%9A%D0%A0%D0%AB%D0%A2%D0%9E%5D')
    expect(value.url).toContain('id=42')
    expect(value.nested.authorization).toBe('[СКРЫТО]')
  })

  it('создаёт копируемый технический JSON', () => {
    const error = new SbError('Ошибка', { code: 'HTTP_ERROR', details: { status: 500 } })
    const parsed = JSON.parse(technicalText(error))
    expect(parsed.code).toBe('HTTP_ERROR')
    expect(parsed.status).toBe(500)
  })
})
