import '../src/style.css'
import Sb, { SbError, type ToastType } from '../src'
import './playground.css'

const result = document.querySelector<HTMLOutputElement>('#result')!
const print = (value: unknown) => {
  result.textContent = typeof value === 'string' ? value : JSON.stringify(value, null, 2)
}

const nativeFetch = window.fetch.bind(window)
window.fetch = async (input, init) => {
  const url = String(input)
  if (!url.includes('/__sb_demo__/')) return nativeFetch(input, init)
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, url.endsWith('/slow') ? 5000 : 700)
    init?.signal?.addEventListener('abort', () => {
      clearTimeout(timer)
      reject(new DOMException('Aborted', 'AbortError'))
    }, { once: true })
  })
  if (url.endsWith('/error')) {
    return new Response(JSON.stringify({ reason: 'Демонстрационная ошибка', token: 'secret-value' }), {
      status: 422,
      headers: { 'content-type': 'application/json' },
    })
  }
  return new Response(JSON.stringify({ ok: true, at: new Date().toISOString() }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

const actions: Record<string, () => void | Promise<void>> = {
  async alert() {
    await Sb.dialogs().alert({ title: 'Готово', message: 'Обычное информационное окно.' })
    print('Alert закрыт')
  },
  async confirm() {
    print(await Sb.dialogs().confirm({ title: 'Подтверждение', message: 'Продолжить операцию?' }))
  },
  async prompt() {
    print(await Sb.dialogs().prompt({ title: 'Название', label: 'Название задачи', required: true, defaultValue: 'Новая задача' }))
  },
  async error() {
    await Sb.dialogs().error({
      error: new SbError('Не удалось сохранить сделку', {
        code: 'HTTP_ERROR',
        details: { status: 500, url: '/crm/save?token=very-secret', response: { error: 'Database unavailable' } },
      }),
    })
  },
  async custom() {
    print(await Sb.dialogs().custom({
      title: 'Своя DOM-верстка',
      content: ({ resolve }) => {
        const card = document.createElement('div')
        const text = document.createElement('p')
        text.textContent = 'Этот DOM создан приложением, без HTML-строк и innerHTML.'
        const button = document.createElement('button')
        button.textContent = 'Вернуть значение'
        button.addEventListener('click', () => resolve({ source: 'custom-dom' }))
        card.append(text, button)
        return card
      },
      actions: [{ id: 'cancel', label: 'Отмена', cancel: true }],
    }))
  },
  async stack() {
    const first = Sb.dialogs().confirm({ title: 'Первое окно', message: 'Поверх него сейчас откроется второе.' })
    const second = Sb.dialogs().alert({ title: 'Второе окно', message: 'Закройте меня, чтобы вернуться к первому.' })
    await second
    print(await first)
  },
  async form() {
    print(await Sb.dialogs().form({
      title: 'Новая задача',
      rootClassName: 'to-do',
      fields: [
        { name: 'title', type: 'text', label: 'Название', hint: 'Короткое и понятное название задачи', required: true, min: 3, placeholder: 'Что нужно сделать?' },
        { name: 'priority', type: 'select', label: 'Приоритет', hint: 'Влияет на порядок задачи в очереди', defaultValue: 'normal', options: [
          { value: 'low', label: 'Низкий' },
          { value: 'normal', label: 'Обычный' },
          { value: 'high', label: 'Высокий' },
        ] },
        { name: 'tags', type: 'multiselect', label: 'Метки', options: [1, 2, 3] },
        { name: 'estimate', type: 'number', label: 'Оценка, часы', min: 1, max: 100 },
        { name: 'description', type: 'textarea', label: 'Описание' },
        { type: 'divider' },
        { name: 'notify', type: 'checkbox', label: 'Уведомить ответственного', hint: 'Отправить уведомление сразу после сохранения', defaultValue: true },
      ],
      actions: [
        { id: 'save', label: 'Сохранить', variant: 'air-primary', handler: async ({ values }) => {
          await new Promise((resolve) => setTimeout(resolve, 800))
          return values
        } },
        { id: 'cancel', label: 'Отмена', cancel: true },
      ],
    }))
  },
  async 'http-success'() {
    print(await Sb.http().get('/__sb_demo__/success'))
  },
  async 'http-error'() {
    try { await Sb.http().post('/__sb_demo__/error', { password: 'secret' }) } catch (error) { print((error as Error).message) }
  },
  async 'http-cancel'() {
    const request = Sb.http().get('/__sb_demo__/slow', { group: 'playground', loader: 'Долгий запрос…' })
    setTimeout(() => Sb.http().cancelGroup('playground'), 800)
    try { await request } catch (error) { print((error as SbError).code) }
  },
  loader() {
    const first = Sb.loader().show({ message: 'Первая операция…' })
    const second = Sb.loader().show({ message: 'Вторая операция…' })
    setTimeout(() => first.update({ message: 'Первая почти готова…' }), 700)
    setTimeout(() => first.close(), 1400)
    setTimeout(() => second.close(), 2400)
  },
  download() {
    return Sb.utils().download(new Blob(['Sb Air UI demo\n'], { type: 'text/plain' }), 'demo.txt')
  },
  async copy() {
    await Sb.utils().copy('Скопировано из Sb Playground')
    print('Текст скопирован')
  },
}

document.addEventListener('click', (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-action]')
  if (!button) return
  const action = actions[button.dataset.action || '']
  void Promise.resolve(action?.()).catch((error) => print((error as Error).message))
})

for (const button of document.querySelectorAll<HTMLButtonElement>('button[data-toast]')) {
  button.addEventListener('click', () => Sb.dialogs().toast({
    type: button.dataset.toast as ToastType,
    title: button.textContent || undefined,
    message: 'Уведомление приостанавливает таймер при наведении.',
  }))
}
