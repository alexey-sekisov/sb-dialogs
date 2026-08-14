/// <reference path="../dist/sb.d.ts" />

import type { ConfirmOptions, SbError } from '../dist/sb'

const confirmOptions: ConfirmOptions = {
  title: 'Проверка типов',
  message: 'Продолжить?',
  size: 'sm',
}

async function consumeGlobalApi(): Promise<void> {
  const accepted: boolean = await window.Sb.dialogs().confirm(confirmOptions)
  const response = await Sb.http().get<{ id: number }>('/api/item')

  void Sb.dialogs().form({
    title: 'Типизированная форма',
    columns: 2,
    fields: [
      { type: 'section', title: 'Параметры' },
      { name: 'title', type: 'text', columnSpan: 2, autofocus: true, description: 'Введите название' },
      {
        name: 'status',
        type: 'select',
        optionsDeps: ['title'],
        options: async () => [{ value: 'new', label: 'Новый' }],
        visibleWhen: (values) => Boolean(values.title),
      },
    ],
    actions: [{ id: 'save', label: 'Сохранить', submit: true }],
    beforeClose: ({ dirty }) => !dirty,
  })

  const toast = Sb.dialogs().toast({
    message: 'Сохранено',
    dedupe: 'save-result',
    action: { label: 'Отменить', handler: ({ toast }) => toast.close() },
  })
  toast.update({ message: 'Обновлено' })

  console.log(accepted, response.id)

  try {
    await Sb.http().get('/api/error')
  } catch (error) {
    if (error instanceof Error && error.name === 'SbError') {
      const normalized = error as SbError
      console.log(normalized.code, normalized.details)
    }
  }
}

void consumeGlobalApi()

// @ts-expect-error Все диалоги принимают только объект options.
void Sb.dialogs().confirm('Продолжить?')
