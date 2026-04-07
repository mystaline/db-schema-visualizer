<script setup lang="ts">
import { useToast } from "../composables/useToast";
const { toasts } = useToast();
</script>

<template>
  <Teleport to="body">
    <div
      aria-live="polite"
      aria-atomic="false"
      class="fixed bottom-8 left-1/2 -translate-x-1/2 z-99999 flex flex-col items-center gap-2 pointer-events-none"
    >
      <TransitionGroup name="toast">
        <div
          v-for="t in toasts"
          :key="t.id"
          class="px-5 py-3 rounded-xl text-sm font-bold shadow-2xl backdrop-blur-md border whitespace-nowrap"
          :class="{
            'bg-secondary-900/90 border-success-500/40 text-success-300':
              t.type === 'success',
            'bg-secondary-900/90 border-red-500/40 text-red-300':
              t.type === 'error',
            'bg-secondary-900/90 border-primary-500/40 text-primary-300':
              t.type === 'info',
          }"
        >
          {{ t.message }}
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: all 0.25s ease;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>
