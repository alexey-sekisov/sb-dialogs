<script setup lang="ts">
import { provide, ref, useId } from 'vue'
import { ConfigProvider, TooltipProvider } from 'reka-ui'
import B24Button from '@bitrix24/b24ui-nuxt/components/Button.vue'
import LoaderWaitIcon from '@bitrix24/b24icons-vue/animated/LoaderWaitIcon'
import AlertAccentIcon from '@bitrix24/b24icons-vue/outline/AlertAccentIcon'
import CircleCheckIcon from '@bitrix24/b24icons-vue/outline/CircleCheckIcon'
import CrossMIcon from '@bitrix24/b24icons-vue/outline/CrossMIcon'
import InfoCircleIcon from '@bitrix24/b24icons-vue/outline/InfoCircleIcon'
import ru from '@bitrix24/b24ui-nuxt/runtime/locale/ru.js'
import { localeContextInjectionKey } from '@bitrix24/b24ui-nuxt/runtime/composables/useLocale.js'
import { portalTargetInjectionKey } from '@bitrix24/b24ui-nuxt/runtime/composables/usePortal.js'
import { uiState } from '../state'
import DialogItem from './DialogItem.vue'

provide(localeContextInjectionKey, ref(ru))
provide(portalTargetInjectionKey, ref('#sb-ui-root'))

const toastIcons = {
  info: InfoCircleIcon,
  success: CircleCheckIcon,
  warning: AlertAccentIcon,
  error: AlertAccentIcon,
}
</script>

<template>
  <ConfigProvider :use-id="() => useId()" :dir="ru.dir" :locale="ru.code">
    <TooltipProvider>
    <DialogItem
      v-for="(record, index) in uiState.dialogs"
      :key="record.id"
      :record="record"
      :active="index === uiState.dialogs.length - 1"
    />

    <TransitionGroup v-if="uiState.toasts.length" name="sb-toast" tag="div" class="sb-toast-stack" aria-live="polite">
      <article
        v-for="toast in uiState.toasts"
        :key="toast.id"
        class="sb-toast"
        :class="`sb-toast--${toast.type}`"
        :role="toast.type === 'error' ? 'alert' : 'status'"
        @mouseenter="toast.pause"
        @mouseleave="toast.resume"
      >
        <Component :is="toastIcons[toast.type]" class="sb-toast__icon" aria-hidden="true" />
        <div class="sb-toast__content">
          <div v-if="toast.title" class="sb-toast__title">{{ toast.title }}</div>
          <div class="sb-toast__message">{{ toast.message }}</div>
          <B24Button
            v-if="toast.action"
            class="sb-toast__action"
            :label="toast.action.label"
            color="air-tertiary-no-accent"
            size="sm"
            :loading="toast.actionLoading"
            @click="toast.runAction($event)"
          />
        </div>
        <B24Button
          v-if="toast.closable"
          class="sb-toast__close"
          :icon="CrossMIcon"
          color="air-tertiary-no-accent"
          size="sm"
          aria-label="Закрыть"
          @click="toast.close"
        />
        <div
          v-if="toast.timeout > 0"
          :key="toast.progressKey"
          class="sb-toast__progress"
          :style="{ animationDuration: `${toast.timeout}ms` }"
        />
      </article>
    </TransitionGroup>

    <Transition name="sb-loader">
      <div v-if="uiState.loaders.length" class="sb-loader-overlay" role="status" aria-live="polite">
        <div class="sb-loader-panel">
          <LoaderWaitIcon class="sb-loader-icon" aria-hidden="true" />
          <div class="sb-loader-content">
            <div class="sb-loader-title">
              {{ uiState.loaders.length === 1 ? uiState.loaders[0]?.message : 'Выполняются операции' }}
            </div>
            <TransitionGroup
              v-if="uiState.loaders.length > 1"
              name="sb-loader-row"
              tag="div"
              class="sb-loader-list"
            >
              <div v-for="loader in uiState.loaders" :key="loader.id" class="sb-loader-row">
                {{ loader.message }}
              </div>
            </TransitionGroup>
          </div>
        </div>
      </div>
    </Transition>
    </TooltipProvider>
  </ConfigProvider>
</template>
