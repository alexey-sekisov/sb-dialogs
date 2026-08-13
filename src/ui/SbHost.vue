<script setup lang="ts">
import B24App from '@bitrix24/b24ui-nuxt/components/App.vue'
import B24Button from '@bitrix24/b24ui-nuxt/components/Button.vue'
import ru from '@bitrix24/b24ui-nuxt/runtime/locale/ru.js'
import { uiState } from '../state'
import DialogItem from './DialogItem.vue'
</script>

<template>
  <B24App :locale="ru" portal="#sb-ui-root" :toaster="null">
    <DialogItem
      v-for="(record, index) in uiState.dialogs"
      :key="record.id"
      :record="record"
      :active="index === uiState.dialogs.length - 1"
    />

    <div v-if="uiState.toasts.length" class="sb-toast-stack" aria-live="polite">
      <article
        v-for="toast in uiState.toasts"
        :key="toast.id"
        class="sb-toast"
        :class="`sb-toast--${toast.type}`"
        @mouseenter="toast.pause"
        @mouseleave="toast.resume"
      >
        <div class="sb-toast__bar" />
        <div class="sb-toast__content">
          <div v-if="toast.title" class="sb-toast__title">{{ toast.title }}</div>
          <div class="sb-toast__message">{{ toast.message }}</div>
        </div>
        <B24Button
          v-if="toast.closable"
          class="sb-toast__close"
          label="×"
          color="air-tertiary-no-accent"
          size="sm"
          aria-label="Закрыть"
          @click="toast.close"
        />
      </article>
    </div>

    <div v-if="uiState.loaders.length" class="sb-loader-overlay" role="status" aria-live="polite">
      <div class="sb-loader-panel">
        <div v-for="loader in uiState.loaders" :key="loader.id" class="sb-loader-row">
          <span class="sb-spinner" aria-hidden="true" />
          <span>{{ loader.message }}</span>
        </div>
      </div>
    </div>
  </B24App>
</template>
