import { nextTick, onUnmounted, watch } from "vue";
import type { Ref } from "vue";

export function useModalKeyboard(
  isOpen: Readonly<Ref<boolean>>,
  opts: {
    onEsc?: () => void;
    onEnter?: () => void;
    modalRef?: Ref<HTMLElement | null>;
    onOpen?: () => void;
  } = {},
) {
  const { onEsc, onEnter, modalRef, onOpen } = opts;

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape" && onEsc) {
      e.preventDefault();
      onEsc();
      return;
    }

    if (e.key === "Enter" && onEnter) {
      e.preventDefault();
      onEnter();
      return;
    }

    if (e.key === "Tab" && modalRef?.value) {
      const focusables = modalRef.value.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]):not([readonly]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
  };

  watch(isOpen, async (val) => {
    if (val) {
      document.addEventListener("keydown", onKeyDown);
      if (onOpen) {
        await nextTick();
        onOpen();
      }
    } else {
      document.removeEventListener("keydown", onKeyDown);
    }
  });

  onUnmounted(() => document.removeEventListener("keydown", onKeyDown));
}
