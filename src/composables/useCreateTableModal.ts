import { ref } from "vue";

const isOpen = ref(false);
const closable = ref(false);

export function useCreateTableModal() {
  const open = (isClosable = false) => {
    closable.value = isClosable;
    isOpen.value = true;
  };
  const close = () => { isOpen.value = false; };
  return { isOpen, closable, open, close };
}
