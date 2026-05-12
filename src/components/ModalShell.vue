<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    isOpen: boolean;
    maxWidth?: string;
    padding?: string;
    closable?: boolean;
  }>(),
  { closable: true },
);

const emit = defineEmits<{ close: [] }>();
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="isOpen"
        class="fixed inset-0 z-[200000] bg-black/60 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        @click="props.closable && emit('close')"
      >
        <div class="absolute inset-0 flex items-center justify-center p-4 md:p-8">
          <div
            class="modal-panel w-full"
            :class="[maxWidth ?? 'max-w-4xl', padding ?? '']"
            @click.stop
          >
            <slot />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.15s ease;
}
.modal-enter-active .modal-panel,
.modal-leave-active .modal-panel {
  transition: transform 0.15s ease, opacity 0.15s ease;
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
.modal-enter-from .modal-panel {
  transform: scale(0.97) translateY(8px);
  opacity: 0;
}
</style>
