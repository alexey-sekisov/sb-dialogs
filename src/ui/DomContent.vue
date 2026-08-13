<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

const props = defineProps<{ node: Node }>()
const host = ref<HTMLElement | null>(null)

onMounted(() => host.value?.appendChild(props.node))
onBeforeUnmount(() => {
  if (props.node.parentNode === host.value) host.value?.removeChild(props.node)
})
</script>

<template><div ref="host" /></template>
