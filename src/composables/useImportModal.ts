import { ref } from "vue";

const isOpen = ref(false);

export function useImportModal() {
  const open = () => { isOpen.value = true; };
  const close = () => { isOpen.value = false; };
  return { isImportOpen: isOpen, openImport: open, closeImport: close };
}
