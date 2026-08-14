# Sb Air UI

[![CI/CD](https://github.com/alexey-sekisov/sb-dialogs/actions/workflows/ci-cd.yml/badge.svg)](https://github.com/alexey-sekisov/sb-dialogs/actions/workflows/ci-cd.yml)

[Demo](https://alexey-sekisov.github.io/sb-dialogs/) · [Последний Release](https://github.com/alexey-sekisov/sb-dialogs/releases/latest) · [Скачать актуальный UMD](https://github.com/alexey-sekisov/sb-dialogs/releases/latest/download/sb.umd.js)

Самодостаточная браузерная библиотека диалогов, HTTP-запросов, loader-состояний и утилит в стиле Bitrix24 Air.

Потребителю нужен только один файл `sb.umd.js`. Vue, используемые Air-компоненты B24UI и изолированные стили уже находятся внутри: npm-пакеты, отдельный CSS и сетевые runtime-зависимости не требуются.

> Библиотека предназначена для современных desktop-браузеров в коробочном Bitrix24.

## Возможности

| Раздел | Возможности |
| --- | --- |
| Диалоги | `alert`, `confirm`, `prompt`, `error`, `form`, `custom`, стек модальных окон |
| Уведомления | Air-status toast, timeout, pause при наведении, ручное закрытие |
| HTTP | GET/POST/PUT/DELETE, JSON, FormData, timeout, AbortSignal, группы отмены, download |
| Ошибки | Единый `SbError`, безопасные технические сведения, редактирование секретов |
| Loader | Общий блокирующий слой с независимыми параллельными операциями |
| Утилиты | Clipboard API с fallback, сохранение Blob/Response, отложенная перезагрузка |

## Быстрый старт

```html
<script src="/assets/sb.umd.js"></script>
<script>
  Sb.dialogs().alert({
    title: 'Готово',
    message: 'Библиотека подключена',
  })
</script>
```

Глобальный `window.Sb` является singleton:

```js
Sb.http()
Sb.dialogs()
Sb.loader()
Sb.utils()
```

Повторное подключение UMD не создаёт второй Vue root: сохраняется первый экземпляр `window.Sb`, а в консоль выводится предупреждение. UI и стили создаются лениво при первом вызове диалога, toast или loader.

### TypeScript

Каждый GitHub Release содержит автономный `sb.d.ts`, сгенерированный из фактического публичного API. Положите его в проект и подключите через `tsconfig.json` или reference directive:

```ts
/// <reference path="./types/sb.d.ts" />

const accepted: boolean = await Sb.dialogs().confirm({
  title: 'Подтверждение',
  message: 'Продолжить?',
})
```

Декларация описывает глобальные `Sb` и `window.Sb`, а также экспортирует типы `SbError`, options, handles и generic-результаты HTTP. На runtime и размер UMD она не влияет.

## Диалоги

| Метод | Результат Promise | Результат отмены |
| --- | --- | --- |
| `alert(options)` | `void` | `void` |
| `confirm(options)` | `boolean` | `false` |
| `prompt(options)` | `string \| null` | `null` |
| `error(options)` | `void` | `void` |
| `form(options)` | результат action-handler | `null` |
| `custom(options)` | пользовательское значение | `null` |

```js
await Sb.dialogs().alert({
  title: 'Сохранено',
  message: 'Изменения успешно сохранены',
})

const accepted = await Sb.dialogs().confirm({
  title: 'Подтверждение',
  message: 'Удалить запись?',
  danger: true,
  confirmLabel: 'Удалить',
  cancelLabel: 'Отмена',
})

const title = await Sb.dialogs().prompt({
  title: 'Новая задача',
  label: 'Название',
  placeholder: 'Что нужно сделать?',
  required: true,
  validate: async (value) => value.trim().length < 3
    ? 'Минимум три символа'
    : undefined,
})
```

Все окна по умолчанию имеют `closable: true`: показывают крестик и закрываются по Escape или клику на overlay. При `closable: false` все три способа блокируются; закрыть окно можно только кнопкой или через dialog controller.

Модальные окна образуют стек. Клавиатурный фокус остаётся в активном верхнем окне и восстанавливается на исходном элементе после закрытия.

### Toast

`toast()` сразу возвращает handle, а не Promise:

```js
const toast = Sb.dialogs().toast({
  type: 'success', // info | success | warning | error
  title: 'Готово',
  message: 'Сделка сохранена',
  timeout: 5000,  // 0 отключает автозакрытие
  closable: true,
})

toast.close()
await toast.closed
```

Toast располагаются стеком справа сверху. При наведении отсчёт timeout приостанавливается.

### Error

```js
await Sb.dialogs().error({
  message: 'Не удалось сохранить данные',
  error,
  details: { entityId: 42 },
})
```

Пользователь видит безопасное сообщение. По ссылке «Подробнее» раскрывается технический JSON, который можно скопировать иконкой в правом верхнем углу блока.

Из технических данных автоматически удаляются значения полей `authorization`, `cookie`, `token`, `auth`, `password`, `secret`, `sessid`, `csrf`, `apiKey` и похожих ключей. Циклические ссылки обрабатываются, массивы и объекты ограничиваются, длинный текст обрезается.

## Форма по схеме

```js
const result = await Sb.dialogs().form({
  title: 'Параметры задачи',
  rootClassName: 'task-form',
  initialValues: { priority: 'normal' },
  fields: [
    {
      name: 'title',
      type: 'text',
      label: 'Название',
      hint: 'Короткое и понятное название задачи',
      required: true,
      min: 3,
    },
    {
      name: 'priority',
      type: 'select',
      label: 'Приоритет',
      options: [
        { value: 'low', label: 'Низкий' },
        { value: 'normal', label: 'Обычный' },
        { value: 'high', label: 'Высокий', disabled: true },
      ],
    },
    { name: 'tags', type: 'multiselect', label: 'Метки', options: [1, 2, 3] },
    { name: 'estimate', type: 'number', label: 'Оценка', min: 1, max: 100 },
    { name: 'description', type: 'textarea', label: 'Описание' },
    { name: 'notify', type: 'checkbox', label: 'Уведомить', defaultValue: true },
    { name: 'mode', type: 'radio', label: 'Режим', options: ['auto', 'manual'] },
    { type: 'divider' },
    { type: 'content', content: 'Статический безопасный текст' },
  ],
  actions: [
    {
      id: 'save',
      label: 'Сохранить',
      variant: 'air-primary',
      handler: async ({ values, dialog, event }) => {
        await save(values)
        return values
      },
    },
    { id: 'cancel', label: 'Отмена', cancel: true },
  ],
})
```

Поддерживаемые поля:

| Тип | Значение | Особенности |
| --- | --- | --- |
| `text`, `textarea` | `string` | placeholder, ограничения длины, pattern |
| `number` | `number` | min/max |
| `select` | примитив | options из примитивов или объектов |
| `multiselect` | массив | множественный выбор |
| `checkbox` | `boolean` | hint рядом с label |
| `radio` | примитив | список вариантов |
| `content` | — | строка, DOM Node или callback |
| `divider` | — | визуальный разделитель |

Правила формы:

- `hint` выводится официальным B24UI Tooltip при наведении или фокусе с клавиатуры.
- Доступны `required`, `min`, `max`, `pattern` и sync/async `validate`.
- Action запускает валидацию, если не передано `validate: false`.
- Во время async handler активная кнопка показывает loader, остальные блокируются.
- Возврат `false` оставляет форму открытой.
- Любой другой успешный результат закрывает форму и становится результатом Promise.
- Ошибка handler открывает error-окно, а форма остаётся в стеке.

## Своя DOM-разметка

```js
const selected = await Sb.dialogs().custom({
  title: 'Карточка',
  content: ({ resolve }) => {
    const root = document.createElement('div')
    const button = document.createElement('button')

    button.textContent = 'Выбрать'
    button.addEventListener('click', () => resolve({ id: 42 }))
    root.append(button)

    return root
  },
  actions: [{ id: 'cancel', label: 'Отмена', cancel: true }],
})
```

`content` обязан вернуть `HTMLElement` или `DocumentFragment`. HTML-строки и `innerHTML` намеренно не поддерживаются. Пользовательский DOM находится под `#sb-ui-root`, поэтому его можно стилизовать со страницы через переданный `rootClassName`.

## HTTP

### Общая конфигурация

```js
Sb.http().configure({
  baseUrl: '/api/',
  timeout: 60_000,
  credentials: 'same-origin',
  headers: () => ({ 'X-CSRF-Token': getToken() }),
  detectError: (payload) => {
    if (payload && payload.success === false) {
      return {
        message: payload.message || 'Операция отклонена',
        code: payload.code,
        details: payload,
      }
    }
    return false
  },
})
```

`configure()` объединяет новые значения с текущей конфигурацией и возвращает HTTP-service.

### Запросы

```js
const tasks = await Sb.http().get('tasks', {
  query: { status: ['new', 'active'] },
  group: 'task-list',
  loader: 'Загружаем задачи…',
})

await Sb.http().post('tasks', { title: 'Новая задача' })
await Sb.http().put('tasks/42', { title: 'Обновлённая задача' })
await Sb.http().delete('tasks/42', { notifyError: false })

await Sb.http().request({
  url: 'tasks/42',
  method: 'PATCH',
  body: { archived: true },
  responseType: 'json',
})
```

Настройки отдельного запроса:

| Поле | Назначение |
| --- | --- |
| `query` | Объект или `URLSearchParams`; массив превращается в повторяющиеся параметры |
| `headers` | Дополняют и переопределяют глобальные headers |
| `credentials` | Переопределяют глобальный режим Fetch credentials |
| `responseType` | `auto`, `json`, `text`, `blob`, `arrayBuffer`, `response` |
| `timeout` | Таймаут в миллисекундах; `0` отключает его |
| `signal` | Внешний `AbortSignal` |
| `group` | Имя группы для массовой отмены |
| `loader` | `false`, строка сообщения или `{ message }` |
| `notifyError` | `false` отключает автоматическое error-окно |

Plain object автоматически сериализуется в JSON и получает `Content-Type: application/json`. `FormData`, `Blob`, строки и `URLSearchParams` передаются без преобразования. Ответ в режиме `auto` разбирается как JSON при JSON Content-Type, иначе как text.

Loader и error-окно включены по умолчанию. Error-окно не поглощает ошибку: исходный Promise всё равно отклоняется экземпляром `SbError`.

### Отмена

```js
const controller = new AbortController()
const request = Sb.http().get('/search', { signal: controller.signal })
controller.abort()

Sb.http().cancelGroup('task-list')
Sb.http().cancelAll()
```

Отмена возвращает `SbError` с кодом `ABORTED` и не открывает error-окно. Таймаут использует код `TIMEOUT`.

### Скачивание

```js
await Sb.http().download('/reports/42', { filename: 'report.xlsx' })
await Sb.utils().download(blob, 'data.csv')
await Sb.utils().download(response)
```

Имя определяется из явно переданного `filename`, затем из `Content-Disposition`, включая UTF-8 `filename*`, и в последнюю очередь из URL.

## Loader и утилиты

```js
const loading = Sb.loader().show({ message: 'Сохраняем…' })
loading.update({ message: 'Почти готово…' })
loading.close()
loading.close() // идемпотентно

await Sb.utils().copy('Текст', {
  successMessage: 'Ссылка скопирована',
})

const reload = Sb.utils().reload({ delay: 3000 })
reload.cancel()
```

Параллельные loader-записи независимы и отображаются в одном блокирующем слое. `copy()` использует Clipboard API с fallback и по умолчанию показывает toast. `reload()` перезагружает обычную страницу и не обращается к `BX.SidePanel`.

## Обработка ошибок

Все транспортные ошибки нормализуются в `SbError`:

```js
try {
  await Sb.http().get('/tasks/42')
} catch (error) {
  if (error instanceof Error && error.name === 'SbError') {
    console.log(error.message)
  }
}
```

В TypeScript технические поля можно типизировать без runtime-импорта:

```ts
import type { SbError } from './types/sb'

const normalized = error as SbError
console.log(normalized.code, normalized.details, normalized.isAbort)
```

Основные коды: `HTTP_ERROR`, `NETWORK_ERROR`, `TIMEOUT`, `ABORTED`, `PARSE_ERROR`, `BUSINESS_ERROR`, `HANDLER_ERROR`, `CONFIG_ERROR`, `UNKNOWN_ERROR`.

## Изоляция страницы

- UI монтируется в единственный `#sb-ui-root`.
- Modal и всплывающие элементы teleport-ятся внутрь этого root.
- Встроенный CSS префиксуется `#sb-ui-root` во время сборки.
- Глобальный Tailwind reset не применяется к странице.
- Стили вставляются один раз и только при первом UI-вызове.

## Разработка

Требования: Bun `1.3.13`; для semantic-release — Node.js `^22.14.0` или `>=24.10.0`. В CI используется Node.js `24.11.1`.

```bash
bun install
bun run dev              # playground
bun run typecheck
bun run test
bun run build            # UMD + raw/gzip breakdown
bun run build:playground
bun run build:pages      # UMD + готовый playground-dist
bun run check            # typecheck + tests + UMD build
bun run release:dry-run  # расчёт следующей версии без публикации
```

## Релизы

Релизы полностью автоматизированы через semantic-release. После успешного push в `main` workflow анализирует Conventional Commits, при необходимости создаёт тег `vX.Y.Z`, формирует release notes и публикует GitHub Release.

| Commit | Результат |
| --- | --- |
| `fix: ...`, `perf: ...` | Patch-релиз |
| `feat: ...` | Minor-релиз |
| `feat!: ...` или footer `BREAKING CHANGE:` | Major-релиз |
| `docs: ...`, `test: ...`, `ci: ...`, `chore: ...` | Новый релиз не создаётся |

Версия определяется историей Git и тегами; вручную менять `version` в `package.json`, создавать тег или запускать `gh release create` не нужно. В каждый Release загружаются:

- `sb.umd.js`
- `sb.d.ts`
- `sb.umd.js.sha256`

GitHub Pages продолжает обновляться после каждого успешного push в `main`, независимо от того, потребовался ли новый Release.
