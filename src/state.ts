import { reactive } from 'vue'
import type { ToastOptions } from './types'

export type DialogKind = 'alert' | 'confirm' | 'prompt' | 'error' | 'form' | 'custom'

export interface DialogRecord {
  id: string
  kind: DialogKind
  options: Record<string, any>
  technical?: string
  finish(result?: unknown): void
  cancel(): void
}

export interface LoaderRecord {
  id: string
  message: string
}

export interface ToastRecord extends Required<Pick<ToastOptions, 'message' | 'type' | 'timeout' | 'closable'>> {
  id: string
  title?: string
  close(): void
  pause(): void
  resume(): void
}

export const uiState = reactive({
  dialogs: [] as DialogRecord[],
  loaders: [] as LoaderRecord[],
  toasts: [] as ToastRecord[],
})

let sequence = 0
export function nextId(prefix: string): string {
  sequence += 1
  return `${prefix}-${Date.now().toString(36)}-${sequence.toString(36)}`
}
