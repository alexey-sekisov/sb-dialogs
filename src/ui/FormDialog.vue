<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import B24Button from '@bitrix24/b24ui-nuxt/components/Button.vue'
import B24Checkbox from '@bitrix24/b24ui-nuxt/components/Checkbox.vue'
import B24Input from '@bitrix24/b24ui-nuxt/components/Input.vue'
import B24RadioGroup from '@bitrix24/b24ui-nuxt/components/RadioGroup.vue'
import B24Select from '@bitrix24/b24ui-nuxt/components/Select.vue'
import B24Separator from '@bitrix24/b24ui-nuxt/components/Separator.vue'
import B24Textarea from '@bitrix24/b24ui-nuxt/components/Textarea.vue'
import { toSbError } from '../errors'
import type { DialogRecord } from '../state'
import type { FormAction, FormDialogOptions, FormField, FormOption } from '../types'
import DomContent from './DomContent.vue'
import FieldHint from './FieldHint.vue'

const props = defineProps<{ record: DialogRecord }>()
const options = props.record.options as FormDialogOptions
const values = reactive<Record<string, any>>({ ...options.initialValues })
const errors = reactive<Record<string, string>>({})
const resolvedOptions = reactive<Record<string, FormOption[]>>({})
const optionsLoading = reactive<Record<string, boolean>>({})
const formError = ref('')
const loadingAction = ref<string | null>(null)
const optionRequestIds = new Map<string, number>()

for (const field of options.fields) {
  if ('name' in field && field.name && values[field.name] === undefined) {
    values[field.name] = field.defaultValue ?? (field.type === 'checkbox' ? false : field.type === 'multiselect' ? [] : '')
  }
}

const serializeValues = () => JSON.stringify(
  Object.keys(values).sort().reduce<Record<string, unknown>>((result, key) => {
    result[key] = values[key]
    return result
  }, {}),
)
const initialValuesSnapshot = serializeValues()
const isDirty = computed(() => serializeValues() !== initialValuesSnapshot)

props.record.beforeCancel = async (reason) => {
  if (!options.beforeClose) return true
  return (await options.beforeClose({
    reason,
    values: Object.freeze({ ...values }),
    dirty: isDirty.value,
  })) !== false
}
onUnmounted(() => { props.record.beforeCancel = undefined })

const normalizeOptionItems = (items: Array<FormOption | string | number | boolean>): FormOption[] => items.map((item) =>
  typeof item === 'object' ? item : { value: item, label: String(item) },
)

const normalizedOptions = (field: FormField): FormOption[] => {
  if (!('options' in field)) return []
  return typeof field.options === 'function' ? resolvedOptions[field.name] || [] : normalizeOptionItems(field.options)
}

for (const field of options.fields) {
  if (!('options' in field) || typeof field.options !== 'function') continue
  const optionsProvider = field.options
  watch(
    () => field.optionsDeps?.length
      ? field.optionsDeps.map((name) => values[name])
      : { ...values },
    async () => {
      const requestId = (optionRequestIds.get(field.name) || 0) + 1
      optionRequestIds.set(field.name, requestId)
      optionsLoading[field.name] = true
      try {
        const items = await optionsProvider(Object.freeze({ ...values }))
        if (optionRequestIds.get(field.name) === requestId) resolvedOptions[field.name] = normalizeOptionItems(items)
      } catch (error) {
        if (optionRequestIds.get(field.name) === requestId) {
          errors[field.name] = toSbError(error, { message: 'Не удалось загрузить варианты' }).message
        }
      } finally {
        if (optionRequestIds.get(field.name) === requestId) optionsLoading[field.name] = false
      }
    },
    { deep: true, immediate: true },
  )
}

function fieldValues(): Readonly<Record<string, unknown>> {
  return Object.freeze({ ...values })
}

function isFieldVisible(field: FormField): boolean {
  return field.visibleWhen?.(fieldValues()) !== false
}

function isFieldDisabled(field: FormField): boolean {
  return Boolean(field.disabled || field.disabledWhen?.(fieldValues()) || ('name' in field && field.name && optionsLoading[field.name]))
}

function isEmpty(value: unknown): boolean {
  return value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0)
}

async function validateField(field: FormField): Promise<string> {
  if (!('name' in field) || !field.name || !isFieldVisible(field)) return ''
  const value = values[field.name]
  if (field.required && (isEmpty(value) || value === false)) return 'Поле обязательно для заполнения'
  if (!isEmpty(value) && field.min !== undefined) {
    if (typeof value === 'number' && value < field.min) return `Минимальное значение: ${field.min}`
    if ((typeof value === 'string' || Array.isArray(value)) && value.length < field.min) return `Минимальная длина: ${field.min}`
  }
  if (!isEmpty(value) && field.max !== undefined) {
    if (typeof value === 'number' && value > field.max) return `Максимальное значение: ${field.max}`
    if ((typeof value === 'string' || Array.isArray(value)) && value.length > field.max) return `Максимальная длина: ${field.max}`
  }
  if (!isEmpty(value) && field.pattern) {
    const pattern = field.pattern instanceof RegExp ? field.pattern : new RegExp(field.pattern)
    pattern.lastIndex = 0
    if (!pattern.test(String(value))) return 'Значение не соответствует требуемому формату'
  }
  return (await field.validate?.(value, { ...values })) || ''
}

async function validateAll(): Promise<boolean> {
  formError.value = ''
  let valid = true
  let firstInvalidName = ''
  for (const field of options.fields) {
    if (!('name' in field) || !field.name) continue
    try {
      errors[field.name] = await validateField(field)
    } catch (error) {
      errors[field.name] = toSbError(error, { message: 'Ошибка проверки поля' }).message
    }
    if (errors[field.name]) {
      valid = false
      firstInvalidName ||= field.name
    }
  }
  if (firstInvalidName) await focusField(firstInvalidName)
  return valid
}

async function focusField(name: string): Promise<void> {
  await nextTick()
  const container = document.querySelector<HTMLElement>(`#sb-ui-root [data-sb-field="${CSS.escape(name)}"]`)
  const target = container?.querySelector<HTMLElement>('input, textarea, button, [tabindex]:not([tabindex="-1"])')
  target?.focus()
  container?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' })
}

async function runAction(action: FormAction, event: Event): Promise<void> {
  if (loadingAction.value) return
  if (action.cancel) {
    props.record.cancel('cancel')
    return
  }
  if (action.validate !== false && !(await validateAll())) return

  loadingAction.value = action.id
  formError.value = ''
  try {
    if (!action.handler) {
      props.record.finish({ ...values })
      return
    }
    const result = await action.handler({
      values: Object.freeze({ ...values }),
      dialog: { close: props.record.finish },
      event,
    })
    if (result !== false) props.record.finish(result)
  } catch (error) {
    formError.value = toSbError(error, { message: 'Не удалось выполнить действие', code: 'HANDLER_ERROR' }).message
    props.record.options.onHandlerError?.(error)
  } finally {
    loadingAction.value = null
  }
}

const hasActions = computed(() => options.actions.length > 0)
const submitAction = computed(() => options.actions.find((action) => action.submit)
  || options.actions.find((action) => !action.cancel))

function handleKeydown(event: KeyboardEvent): void {
  if (options.submitOnEnter === false || event.defaultPrevented || event.isComposing || loadingAction.value) return
  const target = event.target
  if (event.key !== 'Enter' || !(target instanceof HTMLElement)) return
  if (target instanceof HTMLTextAreaElement && !event.ctrlKey && !event.metaKey) return
  if (target instanceof HTMLInputElement && ['checkbox', 'radio', 'button', 'submit'].includes(target.type)) return
  if (!(target instanceof HTMLInputElement) && !(target instanceof HTMLTextAreaElement)) return
  if (!submitAction.value) return
  event.preventDefault()
  void runAction(submitAction.value, event)
}

onMounted(() => {
  const field = options.fields.find((item) => 'name' in item && item.name && item.autofocus && isFieldVisible(item) && !isFieldDisabled(item))
  if (field && 'name' in field && field.name) void focusField(field.name)
})

function fieldSpan(field: FormField): 1 | 2 {
  if (options.columns !== 2) return 1
  if (field.columnSpan) return field.columnSpan
  return ['textarea', 'radio', 'checkbox', 'content', 'divider', 'section'].includes(field.type) ? 2 : 1
}
</script>

<template>
  <div class="sb-form" :class="options.rootClassName" @keydown="handleKeydown">
    <div class="sb-form__fields" :class="`sb-form__fields--columns-${options.columns || 1}`">
      <template v-for="(field, index) in options.fields" :key="'name' in field ? field.name || index : index">
        <template v-if="isFieldVisible(field)">
          <B24Separator
            v-if="field.type === 'divider'"
            class="sb-form-divider sb-field--span-2"
          />

          <div v-else-if="field.type === 'section'" class="sb-form-section sb-field--span-2" :class="field.rootClassName">
            <div class="sb-form-section__title">{{ field.title }}</div>
            <div v-if="field.description" class="sb-form-section__description">{{ field.description }}</div>
          </div>

          <div
            v-else-if="field.type === 'content'"
            class="sb-field"
            :class="[field.rootClassName, `sb-field--span-${fieldSpan(field)}`]"
          >
            <DomContent
              v-if="typeof field.content !== 'string'"
              :node="typeof field.content === 'function' ? field.content() : field.content"
            />
            <div v-else>{{ field.content }}</div>
          </div>

          <div
            v-else
            class="sb-field"
            :class="[field.rootClassName, `sb-field--span-${fieldSpan(field)}`]"
            :data-sb-field="field.name"
          >
          <div v-if="field.label && field.type !== 'checkbox'" class="sb-field__label-line">
            <label class="sb-field__label" :for="`sb-field-${field.name}`">
              {{ field.label }} <span v-if="field.required" class="sb-field__required">*</span>
            </label>
            <FieldHint v-if="field.hint" :text="field.hint" />
          </div>

          <B24Textarea
            v-if="field.type === 'textarea'"
            :id="`sb-field-${field.name}`"
            v-model="values[field.name]"
            :placeholder="field.placeholder"
            :disabled="isFieldDisabled(field)"
            :readonly="field.readonly"
            :autofocus="field.autofocus"
            :aria-describedby="field.description ? `sb-field-description-${field.name}` : undefined"
            :highlight="Boolean(errors[field.name])"
          />
          <B24Input
            v-else-if="field.type === 'text' || field.type === 'number'"
            :id="`sb-field-${field.name}`"
            v-model="values[field.name]"
            :type="field.type"
            :placeholder="field.placeholder"
            :disabled="isFieldDisabled(field)"
            :readonly="field.readonly"
            :autofocus="field.autofocus"
            :aria-describedby="field.description ? `sb-field-description-${field.name}` : undefined"
            :highlight="Boolean(errors[field.name])"
          />
          <B24Select
            v-else-if="field.type === 'select' || field.type === 'multiselect'"
            :id="`sb-field-${field.name}`"
            v-model="values[field.name]"
            :items="normalizedOptions(field)"
            :multiple="field.type === 'multiselect'"
            :placeholder="field.placeholder || 'Выберите значение'"
            :disabled="isFieldDisabled(field) || field.readonly"
            :loading="optionsLoading[field.name]"
            :autofocus="field.autofocus"
            :aria-describedby="field.description ? `sb-field-description-${field.name}` : undefined"
            :highlight="Boolean(errors[field.name])"
            portal="#sb-ui-root"
          />
          <B24Checkbox
            v-else-if="field.type === 'checkbox'"
            v-model="values[field.name]"
            :disabled="isFieldDisabled(field) || field.readonly"
            :required="field.required"
            :highlight="Boolean(errors[field.name])"
          >
            <template v-if="field.label" #label>
              <span class="sb-checkbox-label">
                <span>{{ field.label }} <span v-if="field.required" class="sb-field__required">*</span></span>
                <FieldHint v-if="field.hint" :text="field.hint" />
              </span>
            </template>
          </B24Checkbox>
          <B24RadioGroup
            v-else-if="field.type === 'radio'"
            v-model="values[field.name]"
            :items="normalizedOptions(field)"
            :disabled="isFieldDisabled(field) || field.readonly"
            :required="field.required"
            :highlight="Boolean(errors[field.name])"
            variant="list"
          />

            <div
              v-if="field.description"
              :id="`sb-field-description-${field.name}`"
              class="sb-field__description"
            >{{ field.description }}</div>
            <div v-if="errors[field.name]" class="sb-field__error" role="alert">{{ errors[field.name] }}</div>
          </div>
        </template>
      </template>
    </div>

    <div v-if="formError" class="sb-form__error" role="alert">{{ formError }}</div>

    <div v-if="hasActions" class="sb-modal-footer">
      <B24Button
        v-for="action in options.actions"
        :key="action.id"
        :label="action.label"
        :color="action.variant || (action.cancel ? 'air-tertiary' : 'air-primary')"
        :loading="loadingAction === action.id"
        :disabled="Boolean(loadingAction)"
        type="button"
        @click="runAction(action, $event)"
      />
    </div>
  </div>
</template>
