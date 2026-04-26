<script setup lang="ts">
import { nextTick, onUnmounted, ref, watch } from "vue";
import { APP_VERSION, CHANGELOG } from "../version";

const props = defineProps<{ isOpen: boolean }>();
const emit = defineEmits(["close"]);

const modalRef = ref<HTMLElement | null>(null);
const closeBtnRef = ref<HTMLButtonElement | null>(null);

// Accordion — latest version open by default
const openVersion = ref<string>(CHANGELOG[0].version);

const toggle = (version: string) => {
  openVersion.value = openVersion.value === version ? "" : version;
};

const badgeLabel: Record<string, string> = {
  new: "New",
  improved: "Update",
  fix: "Patch",
};

const badgeColor: Record<string, string> = {
  new: "bg-primary-100 dark:bg-primary-500/15 text-primary-950 dark:text-primary-400 border-primary-200 dark:border-primary-500/30",
  improved:
    "bg-info-100 dark:bg-info-500/15 text-info-950 dark:text-info-400 border-info-200 dark:border-info-500/30",
  fix: "bg-success-100 dark:bg-success-500/15 text-success-950 dark:text-success-600 border-success-200 dark:border-success-500/30",
};

const typeMeta: Record<string, { label: string; color: string }> = {
  feature: {
    label: "New",
    color:
      "text-primary-950 dark:text-primary-400 bg-primary-100 dark:bg-primary-500/10 border-primary-200 dark:border-primary-500/20",
  },
  improvement: {
    label: "Improved",
    color:
      "text-info-950 dark:text-info-400 bg-info-100 dark:bg-info-500/10 border-info-200 dark:border-info-500/20",
  },
  fix: {
    label: "Fix",
    color:
      "text-success-950 dark:text-success-600 bg-success-100 dark:bg-success-500/15 border-success-200 dark:border-success-500/30",
  },
};

// Focus trap + ESC
const onKeyDown = (e: KeyboardEvent) => {
  if (!props.isOpen) return;
  if (e.key === "Escape") {
    emit("close");
    return;
  }

  if (e.key === "Tab") {
    const focusables = modalRef.value?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    if (!focusables?.length) return;
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

watch(
  () => props.isOpen,
  async (open) => {
    if (open) {
      // Reset to latest on every open
      openVersion.value = CHANGELOG[0].version;
      document.addEventListener("keydown", onKeyDown);
      await nextTick();
      closeBtnRef.value?.focus();
    } else {
      document.removeEventListener("keydown", onKeyDown);
    }
  },
);

onUnmounted(() => document.removeEventListener("keydown", onKeyDown));
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="isOpen"
        class="fixed inset-0 z-[300000] flex items-center justify-center p-4 md:p-8"
        role="dialog"
        aria-modal="true"
        aria-labelledby="whats-new-title"
      >
        <!-- Backdrop -->
        <div
          class="absolute inset-0 bg-secondary-950/90 backdrop-blur-xl"
          @click="emit('close')"
        />

        <!-- Modal -->
        <Transition
          appear
          enter-active-class="transition duration-300 ease-out"
          enter-from-class="opacity-0 scale-95 translate-y-4"
          enter-to-class="opacity-100 scale-100 translate-y-0"
          leave-active-class="transition duration-200 ease-in"
          leave-from-class="opacity-100 scale-100 translate-y-0"
          leave-to-class="opacity-0 scale-95 translate-y-4"
        >
          <div
            v-if="isOpen"
            ref="modalRef"
            class="relative w-full max-w-2xl max-h-[88vh] flex flex-col rounded-3xl overflow-hidden shadow-2xl dark:shadow-[0_0_100px_rgba(0,0,0,0.9)] border border-secondary-200 dark:border-secondary-800 bg-white dark:bg-secondary-900"
          >
            <!-- Accent bar -->
            <div
              class="h-1 w-full bg-linear-to-r from-primary-500 via-info-400 to-primary-700 shrink-0"
            />

            <!-- Header -->
            <div class="px-8 pt-7 pb-5 shrink-0 relative overflow-hidden">
              <div
                class="absolute -top-10 -right-10 w-48 h-48 bg-primary-500/10 rounded-full blur-3xl pointer-events-none"
              />
              <div
                class="absolute -top-10 left-10 w-32 h-32 bg-info-500/8 rounded-full blur-3xl pointer-events-none"
              />

              <div class="flex items-center justify-between relative">
                <div class="flex items-center gap-4">
                  <div
                    class="w-11 h-11 rounded-2xl bg-linear-to-br from-primary-500/20 to-info-500/20 border border-primary-500/30 flex items-center justify-center shrink-0"
                  >
                    <svg
                      class="w-5 h-5 text-primary-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
                      />
                    </svg>
                  </div>
                  <div>
                    <h2
                      id="whats-new-title"
                      class="text-xl font-black text-secondary-900 dark:text-secondary-50 tracking-tight leading-none"
                    >
                      What's New
                    </h2>
                    <p
                      class="text-[10px] font-bold text-secondary-700 dark:text-secondary-400 uppercase tracking-[0.18em] mt-1"
                    >
                      Release Notes · v{{ APP_VERSION }}
                    </p>
                  </div>
                </div>

                <button
                  ref="closeBtnRef"
                  class="w-9 h-9 flex items-center justify-center rounded-xl bg-secondary-800 hover:bg-secondary-700 text-secondary-500 hover:text-secondary-50 transition-all focus:outline-none focus:ring-2 focus:ring-primary-500 shrink-0"
                  aria-label="Close what's new"
                  @click="emit('close')"
                >
                  <svg
                    class="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            </div>

            <!-- Accordion body -->
            <div
              class="flex-1 overflow-y-auto custom-scrollbar px-6 pb-6 space-y-2"
            >
              <div
                v-for="(entry, idx) in CHANGELOG"
                :key="entry.version"
                class="rounded-2xl border overflow-hidden transition-all duration-200"
                :class="
                  openVersion === entry.version
                    ? 'border-secondary-300 dark:border-secondary-600 bg-secondary-50 dark:bg-secondary-800/40 shadow-sm'
                    : 'border-secondary-200 dark:border-secondary-800 bg-white dark:bg-secondary-800/20 hover:border-secondary-300 dark:hover:border-secondary-700'
                "
              >
                <!-- Accordion trigger -->
                <button
                  class="w-full flex items-center justify-between gap-3 px-5 py-4 text-left focus:outline-none"
                  :aria-expanded="openVersion === entry.version"
                  @click="toggle(entry.version)"
                >
                  <div class="flex items-center gap-3 min-w-0">
                    <!-- "Latest" dot on the first entry -->
                    <span
                      v-if="idx === 0"
                      class="w-2 h-2 rounded-full bg-primary-400 shadow-md shadow-primary-500/50 shrink-0 animate-pulse"
                    />

                    <!-- Version badge -->
                    <span
                      class="text-sm font-black font-mono text-secondary-900 dark:text-secondary-200 shrink-0"
                    >
                      v{{ entry.version }}
                    </span>

                    <!-- Type badge -->
                    <span
                      v-if="entry.badge"
                      class="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border shrink-0"
                      :class="badgeColor[entry.badge]"
                    >
                      {{ badgeLabel[entry.badge] }}
                    </span>

                    <!-- Date -->
                    <span
                      class="text-[10px] text-secondary-700 dark:text-secondary-600 font-medium truncate"
                    >
                      {{ entry.date }}
                    </span>
                  </div>

                  <!-- Chevron -->
                  <svg
                    class="w-4 h-4 text-secondary-500 shrink-0 transition-transform duration-200"
                    :class="openVersion === entry.version ? 'rotate-180' : ''"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>

                <!-- Accordion content -->
                <Transition
                  enter-active-class="transition-all duration-250 ease-out overflow-hidden"
                  enter-from-class="opacity-0 max-h-0"
                  enter-to-class="opacity-100 max-h-[600px]"
                  leave-active-class="transition-all duration-200 ease-in overflow-hidden"
                  leave-from-class="opacity-100 max-h-[600px]"
                  leave-to-class="opacity-0 max-h-0"
                >
                  <div
                    v-if="openVersion === entry.version"
                    class="px-5 pb-4 space-y-2 border-t border-secondary-700/50"
                  >
                    <div
                      v-for="(item, j) in entry.items"
                      :key="j"
                      class="flex items-start gap-2.5 pt-3"
                    >
                      <span
                        class="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border shrink-0 mt-0.5"
                        :class="typeMeta[item.type].color"
                      >
                        {{ typeMeta[item.type].label }}
                      </span>
                      <span
                        class="text-sm leading-relaxed"
                        :class="
                          idx === 0
                            ? 'text-secondary-950 dark:text-secondary-50 font-medium'
                            : 'text-secondary-800 dark:text-secondary-400'
                        "
                      >
                        {{ item.text }}
                      </span>
                    </div>
                  </div>
                </Transition>
              </div>
            </div>

            <!-- Footer -->
            <div
              class="px-8 py-5 border-t border-secondary-200 dark:border-secondary-800 bg-secondary-50/50 dark:bg-secondary-950/40 shrink-0 flex items-center justify-between"
            >
              <span
                class="text-xs text-secondary-800 dark:text-secondary-600 font-mono"
                >SchemaVis · v{{ APP_VERSION }}</span
              >
              <button
                class="px-8 py-2.5 bg-linear-to-r from-primary-500 to-primary-700 hover:from-primary-400 hover:to-primary-600 text-white text-sm font-bold rounded-xl transition-all active:scale-[0.97] focus:outline-none focus:ring-2 focus:ring-primary-500 shadow-lg shadow-primary-500/20"
                @click="emit('close')"
              >
                Got it 🎉
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 5px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #334155;
  border-radius: 10px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #475569;
}
</style>
