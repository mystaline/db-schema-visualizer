<script setup lang="ts">
import { ref, watch, nextTick } from "vue";

defineProps<{
  isOpen: boolean;
  maxWidth?: string;
  padding?: string;
  closable?: boolean;
}>();

const emit = defineEmits<{ close: [] }>();

const containerRef = ref<HTMLElement | null>(null);

watch(containerRef, async (el) => {
  if (el && !el.contains(document.activeElement)) {
    await nextTick();
    el.focus();
  }
});
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="isOpen"
        ref="containerRef"
        class="fixed inset-0 z-[200000] flex items-center justify-center p-4 md:p-8 bg-black/60 backdrop-blur-sm outline-none"
        role="dialog"
        aria-modal="true"
        tabindex="-1"
        @keydown.esc.stop="closable !== false && emit('close')"
        @click.self="closable !== false && emit('close')"
      >
        <!-- Panel -->
        <div
          class="relative w-full"
          :class="[maxWidth ?? 'max-w-4xl', padding ?? '']"
        >
          <slot />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.15s ease;
}
.modal-enter-active .relative,
.modal-leave-active .relative {
  transition: transform 0.15s ease, opacity 0.15s ease;
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
.modal-enter-from .relative {
  transform: scale(0.97) translateY(8px);
  opacity: 0;
}
</style>
