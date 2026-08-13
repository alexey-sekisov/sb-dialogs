# Sb Air UI

Самодостаточная браузерная библиотека диалогов, HTTP-запросов, loader-состояний и утилит в стиле Bitrix24 Air. Production-поставка состоит из одного файла `dist/sb.umd.js`: Vue, B24UI и scoped-стили уже находятся внутри.

Библиотека не использует глобальный `BX` и не содержит адаптеров `BX.rest`, `BX.ajax` или `BX.SidePanel`.

## Подключение

```html
<script src="/assets/sb.umd.js"></script>
<script>
  Sb.dialogs().alert({
    title: 'Готово',
    message: 'Библиотека подключена',
  })
</script>
```

Повторное подключение файла не создаёт второй UI-root: библиотека оставит первый singleton и запишет предупреждение в консоль.

## API

```js
Sb.version
Sb.http()
Sb.dialogs()
Sb.loader()
Sb.utils()
```

Сервисы — singleton-экземпляры. Все диалоги принимают объект настроек; позиционных сигнатур и совместимости со старым `SBDialogs` нет.

### Диалоги

```js
await Sb.dialogs().alert({ title: 'Сообщение', message: 'Изменения сохранены' })

const accepted = await Sb.dialogs().confirm({
  title: 'Подтверждение',
  message: 'Удалить запись?',
  danger: true,
  confirmLabel: 'Удалить',
  closable: false,
})

const value = await Sb.dialogs().prompt({
  title: 'Название',
  label: 'Название задачи',
  required: true,
  validate: async (value) => value.length < 3 ? 'Минимум три символа' : undefined,
})
```

`confirm()` возвращает `false` при отмене. `prompt()`, `form()` и `custom()` возвращают `null`. Отмена пользователем не является исключением.

У всех модальных окон есть настройка `closable`, включённая по умолчанию. При `closable: false` крестик скрывается, а закрытие кликом снаружи и клавишей Escape блокируется. Закрыть такое окно можно кнопкой или программно через dialog controller.

Toast:

```js
const toast = Sb.dialogs().toast({
  type: 'success', // info | success | warning | error
  title: 'Готово',
  message: 'Сделка сохранена',
  timeout: 5000,  // 0 отключает автозакрытие
})

toast.close()
await toast.closed
```

Error-окно экранирует пользовательские строки, раскрывает технический JSON по ссылке «Подробнее» и позволяет скопировать его иконкой внутри блока:

```js
await Sb.dialogs().error({
  message: 'Не удалось сохранить данные',
  error,
  details: { entityId: 42 },
})
```

Поля `token`, `authorization`, `password`, `secret`, `cookie`, `sessid`, `csrf`, `apiKey` и аналогичные автоматически скрываются в технических данных.

### Форма по схеме

```js
const result = await Sb.dialogs().form({
  title: 'Параметры',
  rootClassName: 'to-do',
  initialValues: { priority: 'normal' },
  fields: [
    { name: 'title', type: 'text', label: 'Название', hint: 'Короткое название задачи', required: true, min: 3 },
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
    { type: 'content', content: 'Статический текст безопасно выводится как текст.' },
  ],
  actions: [
    {
      id: 'save',
      label: 'Сохранить',
      variant: 'air-primary',
      handler: async ({ values }) => {
        await save(values)
        return values
      },
    },
    { id: 'cancel', label: 'Отмена', cancel: true },
  ],
})
```

Поддерживаются `text`, `textarea`, `number`, `select`, `multiselect`, `checkbox`, `radio`, `content`, `divider`. Валидация: `required`, `min`, `max`, `pattern` и sync/async `validate`. Возврат `false` из action-handler оставляет форму открытой; другое успешное значение закрывает окно и становится результатом Promise.

Опциональный `hint` добавляет к label поля Air-иконку подсказки. Текст показывается официальным B24UI Tooltip при наведении мыши или фокусе с клавиатуры. `hint` работает и у checkbox-полей.

### Своя DOM-верстка

```js
const result = await Sb.dialogs().custom({
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

Callback обязан вернуть `HTMLElement` или `DocumentFragment`. HTML-строки и `innerHTML` намеренно не поддерживаются. Переданный DOM находится в light DOM под `#sb-ui-root`, поэтому его можно стилизовать со страницы.

### HTTP

```js
Sb.http().configure({
  baseUrl: '/api/',
  timeout: 60_000,
  credentials: 'same-origin',
  headers: () => ({ 'X-CSRF-Token': getToken() }),
  detectError: (payload) => {
    if (payload && payload.success === false) {
      return { message: payload.message || 'Операция отклонена', code: payload.code }
    }
    return false
  },
})

const data = await Sb.http().get('tasks', {
  query: { status: ['new', 'active'] },
  group: 'task-list',
  loader: 'Загружаем задачи…',
})

await Sb.http().post('tasks', { title: 'Новая задача' }, {
  loader: false,
  notifyError: false,
})
```

Методы: `request`, `get`, `post`, `put`, `delete`, `download`, `cancelGroup`, `cancelAll`.

- Plain object сериализуется в JSON.
- `FormData`, `Blob`, строки и `URLSearchParams` передаются как есть.
- `responseType`: `auto`, `json`, `text`, `blob`, `arrayBuffer`, `response`.
- Автоматические loader и error-окно включены по умолчанию.
- Поддерживаются `AbortSignal`, `timeout` и группы отмены.
- Отмена выбрасывает `SbError` с `code: 'ABORTED'`, но не показывает error-окно.
- Timeout использует `code: 'TIMEOUT'`.

```js
const controller = new AbortController()
const request = Sb.http().get('/search', { signal: controller.signal })
controller.abort()

Sb.http().cancelGroup('task-list')
Sb.http().cancelAll()
```

Скачивание:

```js
await Sb.http().download('/reports/42', { filename: 'report.xlsx' })
await Sb.utils().download(blob, 'data.csv')
await Sb.utils().download(response) // имя читается из Content-Disposition
```

Поддерживаются `filename=` и RFC 5987 `filename*=UTF-8''...`.

### Loader и утилиты

```js
const loading = Sb.loader().show({ message: 'Сохраняем…' })
loading.update({ message: 'Почти готово…' })
loading.close()
loading.close() // безопасно повторять

await Sb.utils().copy('Текст')

const reload = Sb.utils().reload({ delay: 3000 })
reload.cancel()
```

Параллельные loader-записи независимы и отображаются в одном блокирующем Air-слое. `reload()` не обращается к `BX.SidePanel` и перезагружает обычную страницу.

## Разработка

```bash
bun install
bun run dev              # playground
bun run typecheck
bun run test
bun run build            # dist/sb.umd.js + raw/gzip size
bun run build:playground
bun run check
```

Стили B24UI/Tailwind на этапе сборки префиксуются `#sb-ui-root`, reset не выходит за пределы контейнера. UI-root и Vue-приложение монтируются лениво при первом вызове UI.
