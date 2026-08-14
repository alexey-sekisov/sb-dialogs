<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
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
const formError = ref('')
const loadingAction = ref<string | null>(null)

for (const field of options.fields) {
  if ('name' in field && field.name && values[field.name] === undefined) {
    values[field.name] = field.defaultValue ?? (field.type === 'checkbox' ? false : field.type === 'multiselect' ? [] : '')
  }
}

const normalizedOptions = (field: FormField): FormOption[] => {
  if (!('options' in field)) return []
  return field.options.map((item) => typeof item === 'object'
    ? item
    : { value: item, label: String(item) })
}

function isEmpty(value: unknown): boolean {
  return value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0)
}

async function validateField(field: FormField): Promise<string> {
  if (!('name' in field) || !field.name) return ''
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
  for (const field of options.fields) {
    if (!('name' in field) || !field.name) continue
    try {
      errors[field.name] = await validateField(field)
    } catch (error) {
      errors[field.name] = toSbError(error, { message: 'Ошибка проверки поля' }).message
    }
    if (errors[field.name]) valid = false
  }
  return valid
}

async function runAction(action: FormAction, event: MouseEvent): Promise<void> {
  if (loadingAction.value) return
  if (action.cancel) {
    props.record.cancel()
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

function fieldSpan(field: FormField): 1 | 2 {
  if (options.columns !== 2) return 1
  if (field.columnSpan) return field.columnSpan
  return ['textarea', 'radio', 'checkbox', 'content', 'divider', 'section'].includes(field.type) ? 2 : 1
}
</script>

<template>
  <div class="sb-form" :class="options.rootClassName">
    <div class="sb-form__fields" :class="`sb-form__fields--columns-${options.columns || 1}`">
      <template v-for="(field, index) in options.fields" :key="'name' in field ? field.name || index : index">
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

        <div v-else class="sb-field" :class="[field.rootClassName, `sb-field--span-${fieldSpan(field)}`]">
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
            :disabled="field.disabled"
            :highlight="Boolean(errors[field.name])"
          />
          <B24Input
            v-else-if="field.type === 'text' || field.type === 'number'"
            :id="`sb-field-${field.name}`"
            v-model="values[field.name]"
            :type="field.type"
            :placeholder="field.placeholder"
            :disabled="field.disabled"
            :highlight="Boolean(errors[field.name])"
          />
          <B24Select
            v-else-if="field.type === 'select' || field.type === 'multiselect'"
            :id="`sb-field-${field.name}`"
            v-model="values[field.name]"
            :items="normalizedOptions(field)"
            :multiple="field.type === 'multiselect'"
            :placeholder="field.placeholder || 'Выберите значение'"
            :disabled="field.disabled"
            :highlight="Boolean(errors[field.name])"
            portal="#sb-ui-root"
          />
          <B24Checkbox
            v-else-if="field.type === 'checkbox'"
            v-model="values[field.name]"
            :disabled="field.disabled"
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
            :disabled="field.disabled"
            :required="field.required"
            :highlight="Boolean(errors[field.name])"
            variant="list"
          />

          <div v-if="errors[field.name]" class="sb-field__error" role="alert">{{ errors[field.name] }}</div>
        </div>
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
        @click="runAction(action, $event)"
      />
    </div>
  </div>
</template>
