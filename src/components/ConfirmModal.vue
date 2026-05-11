<script setup lang="ts">
import ModalShell from "./ModalShell.vue";

defineProps<{
  isOpen: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
}>();

const emit = defineEmits<{
  confirm: [];
  cancel: [];
}>();
</script>

<template>
  <ModalShell :is-open="isOpen" max-width="max-w-sm" @close="emit('cancel')">
    <div
      class="bg-secondary-900 border border-secondary-700 rounded-3xl shadow-2xl p-8 space-y-6"
    >
      <div class="space-y-1">
        <h2
          class="text-lg font-black uppercase tracking-tight text-secondary-50"
        >
          {{ title }}
        </h2>
        <p
          v-if="message"
          class="text-xs text-secondary-400 font-mono leading-relaxed"
        >
          {{ message }}
        </p>
      </div>

      <div class="flex gap-3">
        <button
          class="flex-1 py-3 rounded-xl border border-secondary-700 text-secondary-400 text-sm font-bold hover:bg-secondary-800 transition-all active:scale-95"
          @click="emit('cancel')"
        >
          Cancel
        </button>
        <button
          class="flex-1 py-3 rounded-xl bg-danger-500 hover:bg-danger-600 text-white text-sm font-bold transition-all active:scale-95 shadow-lg shadow-danger-500/20"
          @click="emit('confirm')"
        >
          {{ confirmLabel ?? "Delete" }}
        </button>
      </div>
    </div>
  </ModalShell>
</template>
