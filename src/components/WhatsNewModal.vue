<script setup lang="ts">
import { ref, computed, toRef, watch } from "vue";
import { APP_VERSION, CHANGELOG, type ChangelogEntry } from "../version";
import ModalShell from "./ModalShell.vue";
import { useModalKeyboard } from "../composables/useModalKeyboard";

const props = defineProps<{ isOpen: boolean }>();
const emit = defineEmits(["close"]);

const modalRef = ref<HTMLElement | null>(null);
const closeBtnRef = ref<HTMLButtonElement | null>(null);

interface GroupedEntry {
  date: string;
  version: string;
  badge?: ChangelogEntry["badge"];
  items: ChangelogEntry["items"];
}

const groupedChangelog = computed<GroupedEntry[]>(() => {
  const groups: GroupedEntry[] = [];
  for (const entry of CHANGELOG) {
    const existing = groups.find((g) => g.date === entry.date);
    if (existing) {
      existing.items = [...existing.items, ...entry.items];
    } else {
      groups.push({ date: entry.date, version: entry.version, badge: entry.badge, items: [...entry.items] });
    }
  }
  return groups;
});

// Accordion — latest date open by default
const openDate = ref<string>(groupedChangelog.value[0]?.date ?? "");

const toggle = (date: string) => {
  openDate.value = openDate.value === date ? "" : date;
};

const badgeLabel: Record<string, string> = {
  new: "New",
  improved: "Update",
  fix: "Patch",
};

const badgeColor: Record<string, string> = {
  new: "bg-primary-500/15 text-primary-400 border-primary-500/30",
  improved: "bg-info-500/15 text-info-400 border-info-500/30",
  fix: "bg-success-500/15 text-success-600 border-success-500/30",
};

const typeMeta: Record<string, { label: string; color: string }> = {
  feature: {
    label: "New",
    color: "text-primary-400 bg-primary-500/10 border-primary-500/20",
  },
  improvement: {
    label: "Improved",
    color: "text-info-400 bg-info-500/10 border-info-500/20",
  },
  fix: {
    label: "Fix",
    color: "text-success-600 bg-success-500/15 border-success-500/30",
  },
};

useModalKeyboard(toRef(props, "isOpen"), {
  onEsc: () => emit("close"),
  modalRef,
  onOpen: () => closeBtnRef.value?.focus(),
});

watch(
  () => props.isOpen,
  (open) => { if (open) openDate.value = groupedChangelog.value[0]?.date ?? ""; },
);
</script>

<template>
  <ModalShell :is-open="isOpen" max-width="max-w-2xl" @close="emit('close')">
      <div
        ref="modalRef"
        class="w-full max-h-[88vh] flex flex-col rounded-3xl overflow-hidden border border-secondary-800 bg-secondary-900"
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
                      class="text-xl font-black text-secondary-50 tracking-tight leading-none"
                    >
                      What's New
                    </h2>
                    <p
                      class="text-[10px] font-bold text-secondary-400 uppercase tracking-[0.18em] mt-1"
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
                v-for="(entry, idx) in groupedChangelog"
                :key="entry.date"
                class="rounded-2xl border overflow-hidden transition-all duration-200"
                :class="
                  openDate === entry.date
                    ? 'border-secondary-600 bg-secondary-800/40 shadow-sm'
                    : 'border-secondary-800 bg-secondary-800/20 hover:border-secondary-700'
                "
              >
                <!-- Accordion trigger -->
                <button
                  class="w-full flex items-center justify-between gap-3 px-5 py-4 text-left focus:outline-none"
                  :aria-expanded="openDate === entry.date"
                  @click="toggle(entry.date)"
                >
                  <div class="flex items-center gap-3 min-w-0">
                    <!-- "Latest" dot on the first entry -->
                    <span
                      v-if="idx === 0"
                      class="w-2 h-2 rounded-full bg-primary-400 shadow-md shadow-primary-500/50 shrink-0 animate-pulse"
                    />

                    <!-- Version badge -->
                    <span
                      class="text-sm font-black font-mono text-secondary-200 shrink-0"
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
                      class="text-[10px] text-secondary-600 font-medium truncate"
                    >
                      {{ entry.date }}
                    </span>
                  </div>

                  <!-- Chevron -->
                  <svg
                    class="w-4 h-4 text-secondary-500 shrink-0 transition-transform duration-200"
                    :class="openDate === entry.date ? 'rotate-180' : ''"
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
                    v-if="openDate === entry.date"
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
                            ? 'text-secondary-50 font-medium'
                            : 'text-secondary-400'
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
              class="px-8 py-5 border-t border-secondary-800 bg-secondary-950/40 shrink-0 flex items-center justify-between"
            >
              <span
                class="text-xs text-secondary-600 font-mono"
                >SchemaViz · v{{ APP_VERSION }}</span
              >
              <button
                class="px-8 py-2.5 bg-linear-to-r from-primary-500 to-primary-700 hover:from-primary-400 hover:to-primary-600 text-white text-sm font-bold rounded-xl transition-all active:scale-[0.97] focus:outline-none focus:ring-2 focus:ring-primary-500 shadow-lg shadow-primary-500/20"
                @click="emit('close')"
              >
                Got it 🎉
              </button>
            </div>
      </div>
  </ModalShell>
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
