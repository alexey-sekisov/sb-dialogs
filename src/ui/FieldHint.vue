<script setup lang="ts">
import B24Tooltip from '@bitrix24/b24ui-nuxt/components/Tooltip.vue'
import InfoCircleIcon from '@bitrix24/b24icons-vue/outline/InfoCircleIcon'

defineProps<{ text: string }>()
</script>

<template>
  <B24Tooltip :text="text" portal="#sb-ui-root" :delay-duration="250">
    <button
      type="button"
      class="sb-field-hint"
      :aria-label="`Подсказка: ${text}`"
      @click.prevent.stop
    ><InfoCircleIcon /></button>
  </B24Tooltip>
</template>
