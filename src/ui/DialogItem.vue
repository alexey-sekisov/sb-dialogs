<script setup lang="ts">
import { onMounted, ref } from 'vue'
import B24Button from '@bitrix24/b24ui-nuxt/components/Button.vue'
import B24Input from '@bitrix24/b24ui-nuxt/components/Input.vue'
import B24Modal from '@bitrix24/b24ui-nuxt/components/Modal.vue'
import B24Textarea from '@bitrix24/b24ui-nuxt/components/Textarea.vue'
import CopyIcon from '@bitrix24/b24icons-vue/outline/CopyIcon'
import { copyTextToClipboard } from '../clipboard'
import { toSbError } from '../errors'
import type { DialogRecord } from '../state'
import type { CustomDialogOptions, PromptOptions } from '../types'
import DomContent from './DomContent.vue'
import FormDialog from './FormDialog.vue'

const props = defineProps<{ record: DialogRecord; active: boolean }>()
const promptValue = ref('')
const promptError = ref('')
const promptLoading = ref(false)
const detailsOpen = ref(false)
const copied = ref(false)
const customNode = ref<Node | null>(null)
const customLoading = ref<string | null>(null)

onMounted(() => {
  if (props.record.kind === 'prompt') promptValue.value = (props.record.options as PromptOptions).defaultValue || ''
  if (props.record.kind === 'custom') {
    const options = props.record.options as CustomDialogOptions
    try {
      const node = options.content({ close: props.record.finish, resolve: props.record.finish })
      if (!(node instanceof Node)) throw new TypeError('custom.content должен вернуть HTMLElement или DocumentFragment')
      customNode.value = node
    } catch (error) {
      props.record.options.onHandlerError?.(error)
      props.record.cancel()
    }
  }
})

function updateOpen(open: boolean): void {
  if (!open && props.active && props.record.options.closable !== false) props.record.cancel()
}

async function submitPrompt(): Promise<void> {
  const options = props.record.options as PromptOptions
  promptError.value = ''
  if (options.required && !promptValue.value.trim()) {
    promptError.value = 'Поле обязательно для заполнения'
    return
  }
  promptLoading.value = true
  try {
    promptError.value = (await options.validate?.(promptValue.value)) || ''
    if (!promptError.value) props.record.finish(promptValue.value)
  } catch (error) {
    promptError.value = toSbError(error, { message: 'Ошибка проверки значения' }).message
  } finally {
    promptLoading.value = false
  }
}

async function copyDetails(): Promise<void> {
  if (!props.record.technical) return
  await copyTextToClipboard(props.record.technical)
  copied.value = true
  setTimeout(() => { copied.value = false }, 1500)
}

function toggleDetails(): void {
  detailsOpen.value = !detailsOpen.value
}

async function runCustomAction(action: any, event: MouseEvent): Promise<void> {
  if (action.cancel) {
    props.record.cancel()
    return
  }
  customLoading.value = action.id
  try {
    if (!action.handler) props.record.finish(action.id)
    else {
      const result = await action.handler({ dialog: { close: props.record.finish }, event })
      if (result !== false) props.record.finish(result)
    }
  } catch (error) {
    props.record.options.onHandlerError?.(error)
  } finally {
    customLoading.value = null
  }
}
</script>

<template>
  <B24Modal
    :open="true"
    :title="record.options.title"
    :close="record.options.closable !== false"
    :dismissible="record.options.closable !== false && active"
    :modal="active"
    portal="#sb-ui-root"
    @update:open="updateOpen"
  >
    <template #body>
      <div class="sb-modal-body" :class="record.options.rootClassName">
        <template v-if="record.kind === 'prompt'">
          <label v-if="record.options.label" class="sb-field__label" for="sb-prompt-input">{{ record.options.label }}</label>
          <B24Textarea
            v-if="record.options.inputType === 'textarea'"
            id="sb-prompt-input"
            v-model="promptValue"
            :placeholder="record.options.placeholder"
            :highlight="Boolean(promptError)"
            autofocus
            @keydown.ctrl.enter="submitPrompt"
          />
          <B24Input
            v-else
            id="sb-prompt-input"
            v-model="promptValue"
            :type="record.options.inputType"
            :placeholder="record.options.placeholder"
            :highlight="Boolean(promptError)"
            autofocus
            @keydown.enter="submitPrompt"
          />
          <div v-if="promptError" class="sb-field__error" role="alert">{{ promptError }}</div>
        </template>

        <template v-else-if="record.kind === 'error'">
          <div>{{ record.options.message }}</div>
          <template v-if="record.technical">
            <button
              type="button"
              class="sb-details-toggle"
              :aria-expanded="detailsOpen"
              @click="toggleDetails"
            >{{ detailsOpen ? 'Скрыть подробности' : 'Подробнее' }}</button>
            <div v-if="detailsOpen" class="sb-error-details-wrap">
              <button
                type="button"
                class="sb-error-details-copy"
                :aria-label="copied ? 'Скопировано' : 'Скопировать техническую информацию'"
                :title="copied ? 'Скопировано' : 'Скопировать'"
                @click="copyDetails"
              ><CopyIcon /></button>
              <pre class="sb-error-details">{{ record.technical }}</pre>
            </div>
          </template>
        </template>

        <FormDialog v-else-if="record.kind === 'form'" :record="record" />
        <DomContent v-else-if="record.kind === 'custom' && customNode" :node="customNode" />
        <div v-else-if="record.options.message">{{ record.options.message }}</div>
      </div>
    </template>

    <template v-if="record.kind !== 'form'" #footer>
      <div class="sb-modal-footer">
        <template v-if="record.kind === 'alert' || record.kind === 'error'">
          <B24Button :label="record.options.buttonLabel" color="air-primary" @click="record.finish()" />
        </template>
        <template v-else-if="record.kind === 'confirm'">
          <B24Button
            :label="record.options.confirmLabel"
            :color="record.options.danger ? 'air-primary-alert' : 'air-primary'"
            @click="record.finish(true)"
          />
          <B24Button :label="record.options.cancelLabel" color="air-tertiary" @click="record.cancel()" />
        </template>
        <template v-else-if="record.kind === 'prompt'">
          <B24Button :label="record.options.confirmLabel" color="air-primary" :loading="promptLoading" @click="submitPrompt" />
          <B24Button :label="record.options.cancelLabel" color="air-tertiary" @click="record.cancel()" />
        </template>
        <template v-else-if="record.kind === 'custom'">
          <B24Button
            v-for="action in record.options.actions || []"
            :key="action.id"
            :label="action.label"
            :color="action.variant || (action.cancel ? 'air-tertiary' : 'air-primary')"
            :loading="customLoading === action.id"
            :disabled="Boolean(customLoading)"
            @click="runCustomAction(action, $event)"
          />
        </template>
      </div>
    </template>
  </B24Modal>
</template>
