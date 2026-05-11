<script setup lang="ts">
import { ref, computed, watch, nextTick } from "vue";
import { useSchemaStore } from "../stores/schemaStore";
import { useCreateTableModal } from "../composables/useCreateTableModal";
import { useImportModal } from "../composables/useImportModal";
import ModalShell from "./ModalShell.vue";

const schemaStore = useSchemaStore();
const { isOpen, closable, close } = useCreateTableModal();
const { openImport } = useImportModal();

const tableName = ref("");
const touched = ref(false);
const inputRef = ref<HTMLInputElement | null>(null);

const IDENTIFIER_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

// Sanitize as user types
watch(tableName, (val) => {
  let v = val.replace(/[^a-zA-Z0-9_]/g, "");
  if (v && /^\d/.test(v)) v = "_" + v;
  if (v !== val) {
    tableName.value = v;
    if (inputRef.value) inputRef.value.value = v;
  }
});

const identifierError = computed(() => {
  const name = tableName.value.trim();
  if (!name) return null;
  if (!IDENTIFIER_RE.test(name))
    return "Only letters, digits, underscores. Cannot start with a digit.";
  if (schemaStore.tables.some((t) => t.name.toLowerCase() === name.toLowerCase()))
    return `"${name}" already exists.`;
  return null;
});

watch(isOpen, (val) => {
  if (val) {
    tableName.value = "";
    touched.value = false;
    nextTick(() => inputRef.value?.focus());
  }
});

const handleSubmit = () => {
  touched.value = true;
  const name = tableName.value.trim();
  if (!name || identifierError.value) return;
  schemaStore.addTable(name);
  close();
};
</script>

<template>
  <ModalShell :is-open="isOpen" max-width="max-w-sm" :closable="closable" @close="close">
        <div class="bg-secondary-900 border border-secondary-700 rounded-3xl shadow-2xl p-8 space-y-6">
          <div class="space-y-1">
            <h2 class="text-lg font-black uppercase tracking-tight text-secondary-50">
              New Table
            </h2>
            <p class="text-xs text-secondary-500 font-mono">
              Name it like a PostgreSQL identifier.
            </p>
          </div>

          <!-- Import shortcut — only shown on empty canvas -->
          <button
            v-if="!closable"
            type="button"
            class="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-secondary-700 text-secondary-500 text-xs font-bold hover:border-primary-500/50 hover:text-primary-400 hover:bg-primary-500/5 transition-all active:scale-95"
            @click="close(); openImport()"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 11l3 3m0 0l3-3m-3 3V4" />
            </svg>
            Import existing schema instead
          </button>

          <form class="space-y-4" @submit.prevent="handleSubmit">
            <div class="space-y-1.5">
              <div class="relative group">
                <input
                  ref="inputRef"
                  v-model="tableName"
                  type="text"
                  placeholder="e.g. user_profiles"
                  class="w-full bg-secondary-950 border rounded-xl px-4 py-3 text-sm focus:outline-none transition-all placeholder:text-secondary-500 focus:ring-4"
                  :class="
                    touched && identifierError
                      ? 'border-danger-500/70 focus:border-danger-500 focus:ring-danger-500/10 text-danger-500'
                      : 'border-secondary-700 focus:border-primary-500 focus:ring-primary-500/10'
                  "
                  @blur="touched = true"
                />
                <div class="absolute right-3 top-3 text-secondary-500 text-[10px] font-mono group-focus-within:text-primary-500 transition-colors">
                  /
                </div>
              </div>
              <p v-if="touched && identifierError" class="text-[10px] text-danger-500 ml-1">
                {{ identifierError }}
              </p>
            </div>

            <div class="flex gap-3">
              <button
                v-if="closable"
                type="button"
                class="flex-1 py-3 rounded-xl border border-secondary-700 text-secondary-400 text-sm font-bold hover:bg-secondary-800 transition-all active:scale-95 cursor-pointer"
                @click="close"
              >
                Cancel
              </button>
              <button
                type="submit"
                :disabled="!tableName.trim() || !!identifierError"
                class="py-3 rounded-xl bg-primary-500 hover:bg-primary-600 text-white text-sm font-bold transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer shadow-lg shadow-primary-500/20"
                :class="closable ? 'flex-1' : 'w-full'"
              >
                Create
              </button>
            </div>
          </form>
        </div>
  </ModalShell>
</template>
