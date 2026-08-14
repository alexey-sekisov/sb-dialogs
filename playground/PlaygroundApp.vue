<script setup lang="ts">
import { ref } from 'vue'
import B24Button from '@bitrix24/b24ui-nuxt/components/Button.vue'
import Sb, { SbError, type ToastType } from '../src'

type DemoButtonColor = 'air-primary' | 'air-secondary' | 'air-secondary-alert'

interface DemoAction {
  id: string
  label: string
  color?: DemoButtonColor
}

const dialogActions: DemoAction[] = [
  { id: 'alert', label: 'Alert', color: 'air-primary' },
  { id: 'confirm', label: 'Confirm' },
  { id: 'prompt', label: 'Prompt' },
  { id: 'error', label: 'Error + details', color: 'air-secondary-alert' },
  { id: 'custom', label: 'Custom DOM' },
  { id: 'stack', label: 'Стек окон' },
]

const toastActions: Array<DemoAction & { type: ToastType }> = [
  { id: 'toast-info', label: 'Информация', type: 'info' },
  { id: 'toast-success', label: 'Успешно', type: 'success' },
  { id: 'toast-warning', label: 'Внимание', type: 'warning' },
  { id: 'toast-error', label: 'Ошибка', type: 'error', color: 'air-secondary-alert' },
]

const httpActions: DemoAction[] = [
  { id: 'http-success', label: 'Успешный JSON', color: 'air-primary' },
  { id: 'http-error', label: 'HTTP 422', color: 'air-secondary-alert' },
  { id: 'http-cancel', label: 'Отмена группы' },
  { id: 'loader', label: 'Два loader' },
  { id: 'download', label: 'Скачать demo.txt' },
  { id: 'copy', label: 'Копировать текст' },
]

const activeAction = ref<string | null>(null)
const resultTitle = ref('Playground готов')
const resultText = ref('Выберите сценарий — результат появится здесь.')

function print(title: string, value: unknown): void {
  resultTitle.value = title
  if (typeof value === 'string') resultText.value = value
  else if (value === undefined) resultText.value = 'Выполнено'
  else resultText.value = JSON.stringify(value, null, 2)
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
    print('Alert', 'Окно закрыто')
  },
  async confirm() {
    print('Confirm', await Sb.dialogs().confirm({ title: 'Подтверждение', message: 'Продолжить операцию?' }))
  },
  async prompt() {
    print('Prompt', await Sb.dialogs().prompt({
      title: 'Название',
      label: 'Название задачи',
      required: true,
      defaultValue: 'Новая задача',
    }))
  },
  async error() {
    await Sb.dialogs().error({
      error: new SbError('Не удалось сохранить сделку', {
        code: 'HTTP_ERROR',
        details: {
          status: 500,
          url: '/crm/save?token=very-secret',
          response: { error: 'Database unavailable' },
        },
      }),
    })
    print('Error', 'Диагностическое окно закрыто')
  },
  async custom() {
    print('Custom DOM', await Sb.dialogs().custom({
      title: 'Своя DOM-вёрстка',
      content: ({ resolve }) => {
        const card = document.createElement('div')
        card.className = 'sb-custom-demo'
        const text = document.createElement('p')
        text.textContent = 'Этот DOM создан приложением, без HTML-строк и innerHTML.'
        const button = document.createElement('button')
        button.className = 'sb-custom-demo__button'
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
    print('Стек окон', await first)
  },
  async form() {
    print('Форма', await Sb.dialogs().form({
      title: 'Новая задача',
      size: 'lg',
      columns: 2,
      rootClassName: 'to-do',
      fields: [
        { type: 'section', title: 'Основные параметры', description: 'Заполните данные новой задачи.' },
        {
          name: 'title',
          type: 'text',
          label: 'Название',
          hint: 'Короткое и понятное название задачи',
          description: 'Enter сохранит форму после успешной проверки.',
          autofocus: true,
          required: true,
          min: 3,
          placeholder: 'Что нужно сделать?',
        },
        {
          name: 'priority',
          type: 'select',
          label: 'Приоритет',
          hint: 'Влияет на порядок задачи в очереди',
          defaultValue: 'normal',
          options: [
            { value: 'low', label: 'Низкий' },
            { value: 'normal', label: 'Обычный' },
            { value: 'high', label: 'Высокий' },
          ],
        },
        { name: 'tags', type: 'multiselect', label: 'Метки', options: [1, 2, 3] },
        {
          name: 'template',
          type: 'select',
          label: 'Шаблон',
          description: 'Варианты загружаются заново при смене приоритета.',
          optionsDeps: ['priority'],
          options: async (values) => {
            await new Promise((resolve) => setTimeout(resolve, 450))
            return [
              { value: `${values.priority}-default`, label: `Шаблон: ${values.priority}` },
              { value: 'empty', label: 'Без шаблона' },
            ]
          },
        },
        { name: 'estimate', type: 'number', label: 'Оценка, часы', min: 1, max: 100 },
        { name: 'description', type: 'textarea', label: 'Описание', placeholder: 'Дополнительная информация' },
        { type: 'divider' },
        {
          name: 'notify',
          type: 'checkbox',
          label: 'Уведомить ответственного',
          hint: 'Отправить уведомление сразу после сохранения',
          defaultValue: true,
        },
      ],
      actions: [
        {
          id: 'save',
          label: 'Сохранить',
          variant: 'air-primary',
          submit: true,
          handler: async ({ values }) => {
            await new Promise((resolve) => setTimeout(resolve, 800))
            return values
          },
        },
        { id: 'cancel', label: 'Отмена', cancel: true },
      ],
      beforeClose: async ({ dirty }) => !dirty || Sb.dialogs().confirm({
        title: 'Несохранённые изменения',
        message: 'Закрыть форму без сохранения?',
      }),
    }))
  },
  async 'http-success'() {
    print('HTTP 200', await Sb.http().get('/__sb_demo__/success'))
  },
  async 'http-error'() {
    try {
      await Sb.http().post('/__sb_demo__/error', { password: 'secret' })
    } catch (error) {
      print('HTTP 422', { code: (error as SbError).code, message: (error as Error).message })
    }
  },
  async 'http-cancel'() {
    const request = Sb.http().get('/__sb_demo__/slow', { group: 'playground', loader: 'Долгий запрос…' })
    setTimeout(() => Sb.http().cancelGroup('playground'), 800)
    try {
      await request
    } catch (error) {
      print('Отмена группы', { code: (error as SbError).code })
    }
  },
  loader() {
    const first = Sb.loader().show({ message: 'Первая операция…' })
    const second = Sb.loader().show({ message: 'Вторая операция…' })
    setTimeout(() => first.update({ message: 'Первая почти готова…' }), 700)
    setTimeout(() => first.close(), 1400)
    setTimeout(() => second.close(), 2400)
    print('Loader', 'Запущены две независимые операции')
  },
  async download() {
    await Sb.utils().download(new Blob(['Sb Air UI demo\n'], { type: 'text/plain' }), 'demo.txt')
    print('Download', 'Файл demo.txt подготовлен')
  },
  async copy() {
    await Sb.utils().copy('Скопировано из Sb Playground')
    print('Clipboard', 'Текст скопирован')
  },
}

async function runAction(action: DemoAction): Promise<void> {
  if (activeAction.value) return
  activeAction.value = action.id
  try {
    await actions[action.id]?.()
  } catch (error) {
    print(action.label, { error: (error as Error).message })
  } finally {
    activeAction.value = null
  }
}

function showToast(action: DemoAction & { type: ToastType }): void {
  const toast = Sb.dialogs().toast({
    type: action.type,
    title: action.label,
    message: 'Таймер приостанавливается при наведении.',
    dedupe: `playground-${action.type}`,
    action: {
      label: 'Показать результат',
      handler: () => print('Toast action', { type: action.type }),
    },
  })
  setTimeout(() => toast.update({ message: 'Toast обновлён через handle.update().' }), 900)
  print('Toast', { type: action.type, title: action.label })
}
</script>

<template>
  <main class="playground">
    <header class="playground-hero">
      <div class="playground-hero__copy">
        <div class="eyebrow">FIRST BIT · BITRIX24 AIR</div>
        <h1>Sb Air UI</h1>
        <p>Диалоги, HTTP, loader и утилиты в одном самодостаточном UMD-файле.</p>
        <div class="downloads">
          <a class="download download-primary" href="./dist/sb.umd.js" download>Скачать sb.umd.js</a>
          <a class="download" href="./dist/sb.d.ts" download>TypeScript declaration</a>
          <a class="download" href="https://github.com/alexey-sekisov/sb-dialogs/releases/latest">Последний Release</a>
        </div>
      </div>
      <div class="playground-hero__meta" aria-label="Особенности сборки">
        <span>UMD</span>
        <span>Vue 3</span>
        <span>Air UI</span>
        <span>Без runtime-зависимостей</span>
      </div>
    </header>

    <div class="playground-workspace">
      <div class="showcase-grid">
        <section class="showcase-card showcase-card--wide">
          <div class="showcase-card__header">
            <div>
              <div class="showcase-card__kicker">Окна</div>
              <h2>Диалоги</h2>
            </div>
            <p>Базовые сценарии, произвольный DOM и стек модальных окон.</p>
          </div>
          <div class="action-grid">
            <B24Button
              v-for="action in dialogActions"
              :key="action.id"
              :label="action.label"
              :color="action.color || 'air-secondary'"
              size="md"
              :loading="activeAction === action.id"
              :disabled="Boolean(activeAction)"
              @click="runAction(action)"
            />
          </div>
        </section>

        <section class="showcase-card">
          <div class="showcase-card__header showcase-card__header--stacked">
            <div>
              <div class="showcase-card__kicker">Уведомления</div>
              <h2>Toast</h2>
            </div>
            <p>Статусы, ручное закрытие, timeout и pause при наведении.</p>
          </div>
          <div class="action-grid">
            <B24Button
              v-for="action in toastActions"
              :key="action.id"
              :label="action.label"
              :color="action.color || 'air-secondary'"
              size="md"
              @click="showToast(action)"
            />
          </div>
        </section>

        <section class="showcase-card">
          <div class="showcase-card__header showcase-card__header--stacked">
            <div>
              <div class="showcase-card__kicker">Schema driven</div>
              <h2>Форма</h2>
            </div>
            <p>Две колонки, Hint, валидация и асинхронный action.</p>
          </div>
          <B24Button
            label="Открыть форму"
            color="air-primary"
            size="md"
            :loading="activeAction === 'form'"
            :disabled="Boolean(activeAction)"
            @click="runAction({ id: 'form', label: 'Форма' })"
          />
        </section>

        <section class="showcase-card showcase-card--wide">
          <div class="showcase-card__header">
            <div>
              <div class="showcase-card__kicker">Transport</div>
              <h2>HTTP и утилиты</h2>
            </div>
            <p>Mocks успешных запросов, ошибок, отмены, download и clipboard.</p>
          </div>
          <div class="action-grid">
            <B24Button
              v-for="action in httpActions"
              :key="action.id"
              :label="action.label"
              :color="action.color || 'air-secondary'"
              size="md"
              :loading="activeAction === action.id"
              :disabled="Boolean(activeAction)"
              @click="runAction(action)"
            />
          </div>
        </section>
      </div>

      <aside class="result-panel" aria-live="polite">
        <div class="result-panel__header">
          <span class="result-panel__dot" />
          Последний результат
        </div>
        <div class="result-panel__title">{{ resultTitle }}</div>
        <pre>{{ resultText }}</pre>
      </aside>
    </div>

    <footer class="playground-footer">
      <span>Sb Air UI</span>
      <a href="https://github.com/alexey-sekisov/sb-dialogs">GitHub</a>
      <a href="https://bitrix24.github.io/b24ui/">Bitrix24 UI</a>
    </footer>
  </main>
</template>
