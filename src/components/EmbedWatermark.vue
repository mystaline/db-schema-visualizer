<template>
  <a
    v-if="store.isEmbed"
    href="https://schemaviz.mystaline.dev"
    target="_blank"
    rel="noopener noreferrer"
    class="fixed bottom-3 right-3 z-50 flex items-center gap-1.5 rounded-md bg-secondary-950/80 px-2.5 py-1.5 text-[11px] font-mono backdrop-blur-sm transition-opacity hover:opacity-100 opacity-70 select-none"
  >
    <span class="text-secondary-50">SCHEMA</span
    ><span class="text-primary-400">VIZ</span>
  </a>
</template>

<script setup lang="ts">
import { useSchemaStore } from "../stores/schemaStore";
const store = useSchemaStore();
</script>
