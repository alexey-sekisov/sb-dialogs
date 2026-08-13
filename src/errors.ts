import type { ErrorCode, SbErrorDetails } from './types'

const SECRET_KEY = /(?:authorization|cookie|token|auth|password|passwd|secret|sessid|csrf|api[-_]?key)/i
const MAX_TEXT_LENGTH = 20_000

function truncate(value: string): string {
  return value.length > MAX_TEXT_LENGTH
    ? `${value.slice(0, MAX_TEXT_LENGTH)}\n… [обрезано]`
    : value
}

function redactString(value: string): string {
  try {
    const url = new URL(value, typeof location === 'undefined' ? 'https://sb.local' : location.href)
    for (const key of Array.from(url.searchParams.keys())) {
      if (SECRET_KEY.test(key)) url.searchParams.set(key, '[СКРЫТО]')
    }
    if (/^https?:/i.test(value) || value.startsWith('/')) {
      return value.startsWith('/') ? `${url.pathname}${url.search}${url.hash}` : url.toString()
    }
  } catch {
    // Это обычная строка, а не URL.
  }
  return truncate(value)
}

export function sanitizeTechnicalValue(value: unknown, seen = new WeakSet<object>()): unknown {
  if (typeof value === 'string') return redactString(value)
  if (value == null || typeof value === 'number' || typeof value === 'boolean') return value
  if (typeof value === 'bigint') return value.toString()
  if (typeof value === 'function') return `[Функция ${value.name || 'anonymous'}]`
  if (value instanceof Date) return value.toISOString()
  if (value instanceof Headers) {
    return Object.fromEntries(
      Array.from(value.entries()).map(([key, item]) => [key, SECRET_KEY.test(key) ? '[СКРЫТО]' : truncate(item)]),
    )
  }
  if (typeof value !== 'object') return String(value)
  if (seen.has(value)) return '[Циклическая ссылка]'
  seen.add(value)

  if (Array.isArray(value)) return value.slice(0, 100).map((item) => sanitizeTechnicalValue(item, seen))

  const result: Record<string, unknown> = {}
  for (const [key, item] of Object.entries(value as Record<string, unknown>).slice(0, 100)) {
    result[key] = SECRET_KEY.test(key) ? '[СКРЫТО]' : sanitizeTechnicalValue(item, seen)
  }
  return result
}

export class SbError extends Error {
  readonly code: ErrorCode
  readonly details: SbErrorDetails
  readonly cause?: unknown

  constructor(message: string, options: { code?: ErrorCode; details?: SbErrorDetails; cause?: unknown } = {}) {
    super(message)
    this.name = 'SbError'
    this.code = options.code ?? 'UNKNOWN_ERROR'
    this.details = options.details ?? {}
    this.cause = options.cause
  }

  get isAbort(): boolean {
    return this.code === 'ABORTED'
  }

  toJSON(): Record<string, unknown> {
    return sanitizeTechnicalValue({
      name: this.name,
      code: this.code,
      message: this.message,
      ...this.details,
      stack: this.stack,
      cause: this.cause instanceof Error
        ? { name: this.cause.name, message: this.cause.message, stack: this.cause.stack }
        : this.cause,
      timestamp: new Date().toISOString(),
    }) as Record<string, unknown>
  }
}

export function toSbError(
  error: unknown,
  fallback: { message?: string; code?: ErrorCode; details?: SbErrorDetails } = {},
): SbError {
  if (error instanceof SbError) return error
  if (error instanceof DOMException && error.name === 'AbortError') {
    return new SbError('Запрос отменён', { code: 'ABORTED', details: fallback.details, cause: error })
  }
  if (error instanceof Error) {
    return new SbError(error.message || fallback.message || 'Неизвестная ошибка', {
      code: fallback.code,
      details: fallback.details,
      cause: error,
    })
  }
  return new SbError(
    typeof error === 'string' ? error : fallback.message || 'Неизвестная ошибка',
    { code: fallback.code, details: fallback.details, cause: error },
  )
}

export function technicalText(error: unknown, details?: unknown): string {
  const normalized = error instanceof SbError
    ? error.toJSON()
    : sanitizeTechnicalValue({
        name: error instanceof Error ? error.name : 'Error',
        message: error instanceof Error ? error.message : String(error ?? 'Неизвестная ошибка'),
        stack: error instanceof Error ? error.stack : undefined,
        details,
        timestamp: new Date().toISOString(),
      })
  return truncate(JSON.stringify(normalized, null, 2))
}
