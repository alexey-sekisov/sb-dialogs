export type ErrorCode =
  | 'HTTP_ERROR'
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'ABORTED'
  | 'PARSE_ERROR'
  | 'BUSINESS_ERROR'
  | 'BITRIX_ERROR'
  | 'HANDLER_ERROR'
  | 'CONFIG_ERROR'
  | 'UNKNOWN_ERROR'

export type TransportName = 'http' | 'dialog' | 'utils'

export interface SbErrorDetails {
  transport?: TransportName
  method?: string
  url?: string
  action?: string
  status?: number
  response?: unknown
  request?: unknown
  [key: string]: unknown
}

export interface LoaderOptions {
  message?: string
}

export interface LoaderHandle {
  readonly id: string
  update(options: LoaderOptions): void
  close(): void
}

export type LoaderSetting = boolean | string | LoaderOptions

export interface CommonTransportOptions {
  signal?: AbortSignal
  timeout?: number
  group?: string
  loader?: LoaderSetting
  notifyError?: boolean
}

export type ResponseType = 'auto' | 'json' | 'text' | 'blob' | 'arrayBuffer' | 'response'

export interface BusinessErrorResult {
  message: string
  code?: string
  details?: unknown
}

export type BusinessErrorDetector = (
  payload: unknown,
  response: Response,
) => false | null | undefined | string | BusinessErrorResult

export interface HttpConfiguration {
  baseUrl?: string
  headers?: HeadersInit | (() => HeadersInit)
  credentials?: RequestCredentials
  timeout?: number
  detectError?: BusinessErrorDetector | null
}

export interface HttpRequestOptions extends CommonTransportOptions {
  url: string
  method?: string
  query?: Record<string, unknown> | URLSearchParams
  headers?: HeadersInit
  body?: unknown
  credentials?: RequestCredentials
  responseType?: ResponseType
}

export type HttpMethodOptions = Omit<HttpRequestOptions, 'url' | 'method' | 'body'>
export type HttpDeleteOptions = Omit<HttpRequestOptions, 'url' | 'method'>

export interface HttpDownloadOptions extends Omit<HttpMethodOptions, 'responseType'> {
  filename?: string
}

export type ToastType = 'info' | 'success' | 'warning' | 'error'

export interface ToastOptions {
  title?: string
  message: string
  type?: ToastType
  timeout?: number
  closable?: boolean
  /** Одинаковые активные toast объединяются. Строка задаёт явный ключ. По умолчанию true. */
  dedupe?: boolean | string
  /** Максимальное число одновременно видимых toast. По умолчанию 5. */
  maxVisible?: number
  action?: ToastAction
}

export interface ToastHandle {
  readonly id: string
  readonly closed: Promise<void>
  update(options: Partial<ToastOptions>): void
  close(): void
}

export interface ToastAction {
  label: string
  /** Возврат false оставляет toast открытым. */
  handler?: (context: { toast: ToastHandle; event: MouseEvent }) => unknown | Promise<unknown>
}

export type DialogSize = 'sm' | 'md' | 'lg'

export interface BaseDialogOptions {
  title?: string
  message?: string
  /** Ширина окна. Если не указана, выбирается автоматически по типу диалога. */
  size?: DialogSize
  /** Показывать крестик и разрешать закрытие снаружи/Escape. По умолчанию true. */
  closable?: boolean
  rootClassName?: string
}

export interface AlertOptions extends BaseDialogOptions {
  buttonLabel?: string
}

export interface ConfirmOptions extends BaseDialogOptions {
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
}

export interface PromptOptions extends BaseDialogOptions {
  label?: string
  defaultValue?: string
  placeholder?: string
  inputType?: 'text' | 'password' | 'email' | 'number' | 'textarea'
  required?: boolean
  confirmLabel?: string
  cancelLabel?: string
  validate?: (value: string) => string | void | Promise<string | void>
}

export interface ErrorDialogOptions extends BaseDialogOptions {
  error?: unknown
  details?: unknown
  buttonLabel?: string
}

export type FormOptionValue = string | number | boolean
export interface FormOption {
  value: FormOptionValue
  label: string
  disabled?: boolean
}

export type FormValidator = (
  value: unknown,
  values: Readonly<Record<string, unknown>>,
) => string | void | Promise<string | void>

interface FormFieldBase {
  name?: string
  label?: string
  /** Текст подсказки, показываемой в Air Hint при наведении или фокусе. */
  hint?: string
  defaultValue?: unknown
  required?: boolean
  disabled?: boolean
  readonly?: boolean
  autofocus?: boolean
  /** Постоянный поясняющий текст под полем. */
  description?: string
  visibleWhen?: (values: Readonly<Record<string, unknown>>) => boolean
  disabledWhen?: (values: Readonly<Record<string, unknown>>) => boolean
  min?: number
  max?: number
  pattern?: RegExp | string
  validate?: FormValidator
  rootClassName?: string
  /** Количество колонок, занимаемых полем в двухколоночной форме. */
  columnSpan?: 1 | 2
}

export interface FormInputField extends FormFieldBase {
  name: string
  type: 'text' | 'textarea' | 'number'
  placeholder?: string
}

export interface FormChoiceField extends FormFieldBase {
  name: string
  type: 'select' | 'multiselect' | 'radio'
  options: Array<FormOption | FormOptionValue> | FormOptionsProvider
  /** Поля, после изменения которых нужно повторно загрузить options. */
  optionsDeps?: string[]
  placeholder?: string
}

export type FormOptionsProvider = (
  values: Readonly<Record<string, unknown>>,
) => Array<FormOption | FormOptionValue> | Promise<Array<FormOption | FormOptionValue>>

export interface FormCheckboxField extends FormFieldBase {
  name: string
  type: 'checkbox'
}

export interface FormContentField extends Omit<FormFieldBase, 'name'> {
  type: 'content'
  content: string | Node | (() => Node)
}

export interface FormDividerField extends Omit<FormFieldBase, 'name'> {
  type: 'divider'
}

export interface FormSectionField extends Omit<FormFieldBase, 'name' | 'label'> {
  type: 'section'
  title: string
  description?: string
}

export type FormField =
  | FormInputField
  | FormChoiceField
  | FormCheckboxField
  | FormContentField
  | FormDividerField
  | FormSectionField

export type AirButtonVariant =
  | 'air-primary'
  | 'air-primary-success'
  | 'air-primary-alert'
  | 'air-primary-warning'
  | 'air-secondary'
  | 'air-secondary-alert'
  | 'air-secondary-accent'
  | 'air-tertiary'

export interface DialogController {
  close(result?: unknown): void
}

export interface FormActionContext {
  values: Readonly<Record<string, unknown>>
  dialog: DialogController
  event: Event
}

export interface FormAction {
  id: string
  label: string
  variant?: AirButtonVariant
  validate?: boolean
  cancel?: boolean
  /** Использовать action при Enter. Иначе выбирается первый action без cancel. */
  submit?: boolean
  handler?: (context: FormActionContext) => unknown | Promise<unknown>
}

export type FormCloseReason = 'dismiss' | 'cancel'

export interface FormBeforeCloseContext {
  reason: FormCloseReason
  values: Readonly<Record<string, unknown>>
  dirty: boolean
}

export interface FormDialogOptions extends BaseDialogOptions {
  fields: FormField[]
  actions: FormAction[]
  initialValues?: Record<string, unknown>
  /** Desktop-сетка формы. По умолчанию одна колонка. */
  columns?: 1 | 2
  /** Отправлять форму по Enter и Cmd/Ctrl+Enter в textarea. По умолчанию true. */
  submitOnEnter?: boolean
  /** Может запретить закрытие формы крестиком, overlay, Escape или cancel-action. */
  beforeClose?: (context: FormBeforeCloseContext) => boolean | void | Promise<boolean | void>
}

export interface CustomDialogContext extends DialogController {
  resolve(result?: unknown): void
}

export interface CustomAction {
  id: string
  label: string
  variant?: AirButtonVariant
  cancel?: boolean
  handler?: (context: { dialog: DialogController; event: MouseEvent }) => unknown | Promise<unknown>
}

export interface CustomDialogOptions extends BaseDialogOptions {
  content: (context: CustomDialogContext) => HTMLElement | DocumentFragment
  actions?: CustomAction[]
}

export interface CopyOptions {
  notify?: boolean
  successMessage?: string
}

export interface ReloadOptions {
  delay?: number
}

export interface ReloadHandle {
  cancel(): void
}
