import './style.css'
import { SbError } from './errors'
import { DialogService } from './services/dialogs'
import { HttpService } from './services/http'
import { LoaderService } from './services/loader'
import { UtilsService } from './services/utils'

export * from './types'
export { SbError }

export interface SbApi {
  readonly version: string
  http(): HttpService
  dialogs(): DialogService
  loader(): LoaderService
  utils(): UtilsService
}

declare global {
  interface Window {
    Sb: SbApi
  }
}

const VERSION = '1.0.0'
const marker = Symbol.for('first-bit.sb.instance')
const scope = globalThis as typeof globalThis & { Sb?: SbApi; [marker]?: boolean }

function createSb(): SbApi {
  const loader = new LoaderService()
  const dialogs = new DialogService()
  const http = new HttpService(loader, dialogs)
  const utils = new UtilsService(dialogs)

  return Object.freeze({
    version: VERSION,
    http: () => http,
    dialogs: () => dialogs,
    loader: () => loader,
    utils: () => utils,
  })
}

let Sb: SbApi
if (scope[marker] && scope.Sb) {
  Sb = scope.Sb
  console.warn('[Sb] Библиотека уже подключена; используется существующий экземпляр.')
} else {
  Sb = createSb()
  scope.Sb = Sb
  scope[marker] = true
}

export { Sb }
export default Sb
