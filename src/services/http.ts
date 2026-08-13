import { filenameFromDisposition, saveBlob } from '../download'
import { SbError, sanitizeTechnicalValue, toSbError } from '../errors'
import type {
  BusinessErrorResult,
  HttpConfiguration,
  HttpDeleteOptions,
  HttpDownloadOptions,
  HttpMethodOptions,
  HttpRequestOptions,
  LoaderSetting,
  ResponseType,
} from '../types'
import type { DialogService } from './dialogs'
import type { LoaderService } from './loader'

const DEFAULT_TIMEOUT = 60_000

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || Object.prototype.toString.call(value) !== '[object Object]') return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === null || prototype === Object.prototype
}

function appendQuery(url: URL, query?: Record<string, unknown> | URLSearchParams): void {
  if (!query) return
  if (query instanceof URLSearchParams) {
    query.forEach((value, key) => url.searchParams.append(key, value))
    return
  }
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue
    const values = Array.isArray(value) ? value : [value]
    for (const item of values) {
      url.searchParams.append(key, typeof item === 'object' ? JSON.stringify(item) : String(item))
    }
  }
}

function loaderMessage(setting: LoaderSetting | undefined): string | undefined {
  if (setting === false) return undefined
  if (typeof setting === 'string') return setting
  return (typeof setting === 'object' ? setting.message : undefined) || 'Загрузка…'
}

async function parseResponse(response: Response, responseType: ResponseType): Promise<unknown> {
  if (responseType === 'response') return response
  if (responseType === 'blob') return response.blob()
  if (responseType === 'arrayBuffer') return response.arrayBuffer()
  if (response.status === 204 || response.status === 205) return undefined

  const type = responseType === 'auto'
    ? (response.headers.get('content-type')?.includes('json') ? 'json' : 'text')
    : responseType
  const text = await response.text()
  if (!text) return type === 'json' ? undefined : ''
  if (type === 'text') return text
  try {
    return JSON.parse(text)
  } catch (cause) {
    throw new SbError('Сервер вернул некорректный JSON', {
      code: 'PARSE_ERROR',
      details: { response: text },
      cause,
    })
  }
}

function createUrl(value: string, baseUrl?: string): URL {
  const fallback = typeof location === 'undefined' ? 'http://localhost/' : location.href
  return new URL(value, baseUrl ? new URL(baseUrl, fallback) : fallback)
}

export class HttpService {
  private configuration: Required<Pick<HttpConfiguration, 'credentials' | 'timeout'>> & HttpConfiguration = {
    credentials: 'same-origin',
    timeout: DEFAULT_TIMEOUT,
    detectError: null,
  }

  private readonly controllers = new Set<AbortController>()
  private readonly groups = new Map<string, Set<AbortController>>()

  constructor(private readonly loaders: LoaderService, private readonly dialogs: DialogService) {}

  configure(options: HttpConfiguration): this {
    this.configuration = { ...this.configuration, ...options }
    return this
  }

  get<T = unknown>(url: string, options: HttpMethodOptions = {}): Promise<T> {
    return this.request<T>({ ...options, url, method: 'GET' })
  }

  post<T = unknown>(url: string, body?: unknown, options: HttpMethodOptions = {}): Promise<T> {
    return this.request<T>({ ...options, url, body, method: 'POST' })
  }

  put<T = unknown>(url: string, body?: unknown, options: HttpMethodOptions = {}): Promise<T> {
    return this.request<T>({ ...options, url, body, method: 'PUT' })
  }

  delete<T = unknown>(url: string, options: HttpDeleteOptions = {}): Promise<T> {
    return this.request<T>({ ...options, url, method: 'DELETE' })
  }

  async download(url: string, options: HttpDownloadOptions = {}): Promise<void> {
    const { filename, ...requestOptions } = options
    const response = await this.request<Response>({
      ...requestOptions,
      url,
      method: 'GET',
      responseType: 'response',
    })
    const fallback = decodeURIComponent(new URL(response.url || url, location.href).pathname.split('/').pop() || 'download')
    saveBlob(await response.blob(), filename || filenameFromDisposition(response.headers.get('content-disposition')) || fallback)
  }

  async request<T = unknown>(options: HttpRequestOptions): Promise<T> {
    const controller = new AbortController()
    const group = options.group
    const url = createUrl(options.url, this.configuration.baseUrl)
    appendQuery(url, options.query)

    const configHeaders = typeof this.configuration.headers === 'function'
      ? this.configuration.headers()
      : this.configuration.headers
    const headers = new Headers(configHeaders)
    new Headers(options.headers).forEach((value, key) => headers.set(key, value))

    let body: BodyInit | null | undefined
    if (isPlainObject(options.body)) {
      if (!headers.has('content-type')) headers.set('content-type', 'application/json')
      if (!headers.has('accept')) headers.set('accept', 'application/json')
      body = JSON.stringify(options.body)
    } else if (options.body !== undefined && options.body !== null) {
      body = options.body as BodyInit
    }

    const method = (options.method || 'GET').toUpperCase()
    const timeout = options.timeout ?? this.configuration.timeout
    const message = loaderMessage(options.loader)
    const loader = message ? this.loaders.show({ message }) : undefined
    let timedOut = false
    let externalAbort: (() => void) | undefined
    let timeoutId: ReturnType<typeof setTimeout> | undefined

    this.controllers.add(controller)
    if (group) {
      const set = this.groups.get(group) ?? new Set<AbortController>()
      set.add(controller)
      this.groups.set(group, set)
    }
    if (options.signal) {
      externalAbort = () => controller.abort(options.signal?.reason)
      if (options.signal.aborted) externalAbort()
      else options.signal.addEventListener('abort', externalAbort, { once: true })
    }
    if (timeout > 0) {
      timeoutId = setTimeout(() => {
        timedOut = true
        controller.abort('timeout')
      }, timeout)
    }

    const errorDetails = {
      transport: 'http' as const,
      method,
      url: url.toString(),
      request: sanitizeTechnicalValue(options.body),
    }

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: method === 'GET' || method === 'HEAD' ? undefined : body,
        credentials: options.credentials ?? this.configuration.credentials,
        signal: controller.signal,
      })

      if (!response.ok) {
        let responseBody: unknown
        try { responseBody = await parseResponse(response.clone(), 'auto') } catch { responseBody = await response.text() }
        throw new SbError(`Ошибка HTTP ${response.status}`, {
          code: 'HTTP_ERROR',
          details: { ...errorDetails, status: response.status, response: responseBody },
        })
      }

      const responseType = options.responseType ?? 'auto'
      const payload = await parseResponse(response, responseType)
      if (responseType !== 'response' && this.configuration.detectError) {
        const detected = this.configuration.detectError(payload, response)
        if (detected) {
          const result: BusinessErrorResult = typeof detected === 'string' ? { message: detected } : detected
          throw new SbError(result.message, {
            code: 'BUSINESS_ERROR',
            details: {
              ...errorDetails,
              status: response.status,
              response: payload,
              businessCode: result.code,
              businessDetails: result.details,
            },
          })
        }
      }
      return payload as T
    } catch (cause) {
      let error: SbError
      if (controller.signal.aborted) {
        error = new SbError(timedOut ? 'Превышено время ожидания запроса' : 'Запрос отменён', {
          code: timedOut ? 'TIMEOUT' : 'ABORTED',
          details: errorDetails,
          cause,
        })
      } else if (cause instanceof SbError) {
        error = cause.details.transport ? cause : new SbError(cause.message, {
          code: cause.code,
          details: { ...errorDetails, ...cause.details },
          cause: cause.cause,
        })
      } else {
        error = toSbError(cause, {
          message: 'Не удалось выполнить запрос',
          code: 'NETWORK_ERROR',
          details: errorDetails,
        })
      }

      if (!error.isAbort && options.notifyError !== false) void this.dialogs.error({ error })
      throw error
    } finally {
      clearTimeout(timeoutId)
      loader?.close()
      this.controllers.delete(controller)
      if (group) {
        const set = this.groups.get(group)
        set?.delete(controller)
        if (set?.size === 0) this.groups.delete(group)
      }
      if (options.signal && externalAbort) options.signal.removeEventListener('abort', externalAbort)
    }
  }

  cancelGroup(group: string): void {
    for (const controller of this.groups.get(group) ?? []) controller.abort(`group:${group}`)
  }

  cancelAll(): void {
    for (const controller of this.controllers) controller.abort('all')
  }
}
