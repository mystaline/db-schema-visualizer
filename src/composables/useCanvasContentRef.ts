import { ref } from 'vue';

/** Shared ref to the canvas transform layer DOM node, registered by SchemaCanvas. */
const canvasContentEl = ref<HTMLElement | null>(null);

export function useCanvasContentRef() {
  const register = (el: HTMLElement | null) => {
    canvasContentEl.value = el;
  };
  return { canvasContentEl, register };
}
