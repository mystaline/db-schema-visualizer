<script setup lang="ts">
import { ref, watch, nextTick, onUnmounted } from "vue";
import { useSchemaStore } from "../stores/schemaStore";
import { useToast } from "../composables/useToast";

const props = defineProps<{
  isOpen: boolean;
}>();

const emit = defineEmits(["close"]);

const schemaStore = useSchemaStore();
const { toast } = useToast();

const modalRef = ref<HTMLElement | null>(null);
const fileInputRef = ref<HTMLInputElement | null>(null);
const importInput = ref("");
const isDragging = ref(false);

const handleImport = async () => {
  if (!importInput.value.trim()) {
    toast("Please paste some SQL or upload a file first", "error");
    return;
  }

  try {
    if (schemaStore.tables.length > 0) {
      if (!window.confirm("This will overwrite your current schema. Are you sure you want to proceed?")) {
        return;
      }
    }
    await schemaStore.importFromSql(importInput.value);
    toast("Schema imported successfully!");
    emit("close");
    importInput.value = "";
  } catch (err) {
    console.error("Import failed", err);
    toast("Failed to parse SQL. Check your syntax.", "error");
  }
};

const handleFileUpload = (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (file) {
    readFile(file);
  }
};

const handleDrop = (event: DragEvent) => {
  isDragging.value = false;
  const file = event.dataTransfer?.files?.[0];
  if (file) {
    readFile(file);
  }
};

const readFile = (file: File) => {
  if (!file.name.endsWith(".sql") && !file.name.endsWith(".txt")) {
    toast("Please upload a .sql or .txt file", "warning");
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    importInput.value = (e.target?.result as string) || "";
    toast(`Loaded ${file.name}`);
  };
  reader.readAsText(file);
};

const triggerFileSelect = () => {
  fileInputRef.value?.click();
};

// ESC + focus trap
const onKeyDown = (e: KeyboardEvent) => {
  if (!props.isOpen) return;
  if (e.key === "Escape") {
    emit("close");
    return;
  }
  
  if (e.key === "Tab") {
    const focusables = modalRef.value?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]):not([readonly]), [tabindex]:not([tabindex="-1"])',
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
  async (isOpen) => {
    if (isOpen) {
      document.addEventListener("keydown", onKeyDown);
      await nextTick();
      (modalRef.value?.querySelector("textarea") as HTMLElement)?.focus();
    } else {
      document.removeEventListener("keydown", onKeyDown);
    }
  },
);

onUnmounted(() => document.removeEventListener("keydown", onKeyDown));
</script>

<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      class="fixed inset-0 z-99901 flex items-center justify-center p-4 md:p-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-title"
    >
      <!-- Backdrop -->
      <div
        class="absolute inset-0 bg-secondary-950/90 backdrop-blur-xl"
        @click="emit('close')"
      />

      <!-- Modal Inner -->
      <div
        ref="modalRef"
        class="relative w-full max-w-4xl max-h-[85vh] bg-secondary-900 border border-secondary-800 rounded-3xl shadow-[0_0_80px_rgba(0,0,0,1)] overflow-hidden flex flex-col"
      >
        <!-- Header -->
        <div
          class="px-8 py-6 border-b border-secondary-800 flex items-center justify-between bg-secondary-950/30 shrink-0"
        >
          <div class="flex items-center gap-4">
            <div
              class="w-10 h-10 rounded-2xl bg-primary-500/10 border border-primary-500/20 flex items-center justify-center"
            >
              <svg
                aria-hidden="true"
                class="w-6 h-6 text-primary-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
                />
              </svg>
            </div>
            <div>
              <h3
                id="import-title"
                class="text-xl font-bold text-secondary-50 tracking-tight"
              >
                Import DDL Schema
              </h3>
              <p
                class="text-xs text-secondary-400 font-medium font-mono uppercase tracking-widest mt-0.5"
              >
                Supports SQL Paste or File Upload
              </p>
            </div>
          </div>
          <button
            class="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-secondary-800 text-secondary-500 hover:text-secondary-50 transition-all focus:ring-2 focus:ring-primary-500 focus:outline-none"
            aria-label="Close modal"
            @click="emit('close')"
          >
            <svg
              class="w-6 h-6"
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

        <!-- Body -->
        <div class="flex-1 overflow-hidden p-8 flex flex-col gap-6">
          <!-- Warning Banner -->
          <div class="flex items-start gap-4 p-4 rounded-2xl bg-warning-500/10 border border-warning-500/20 text-warning-400">
            <svg class="w-5 h-5 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div class="text-[11px] font-medium leading-relaxed">
              <p class="font-bold uppercase tracking-wider mb-1">Warning: Destructive Action</p>
              <p class="opacity-80">Importing a new DDL will <span class="text-warning-300 font-bold underline">replace your current workspace</span>. Multi-project support is not yet active, so ensure you've exported your current work as a SQL file or Shared URL first.</p>
            </div>
          </div>

          <!-- Dropzone area (condensed) -->
          <div
            class="relative h-24 rounded-2xl border-2 border-dashed transition-all flex items-center justify-center cursor-pointer group"
            :class="[
              isDragging
                ? 'border-primary-500 bg-primary-500/10 ring-4 ring-primary-500/20'
                : 'border-secondary-700 bg-secondary-800/50 hover:bg-secondary-800 hover:border-secondary-600',
            ]"
            @dragover.prevent="isDragging = true"
            @dragleave.prevent="isDragging = false"
            @drop.prevent="handleDrop"
            @click="triggerFileSelect"
          >
            <input
              ref="fileInputRef"
              type="file"
              accept=".sql,.txt"
              class="hidden"
              @change="handleFileUpload"
            />
            <div class="flex items-center gap-4 text-secondary-400 group-hover:text-secondary-200 transition-colors">
              <div class="w-10 h-10 rounded-xl bg-secondary-700 flex items-center justify-center group-hover:bg-secondary-600 transition-colors">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <div class="text-left">
                <p class="text-xs font-bold uppercase tracking-widest leading-none mb-1">Upload SQL File</p>
                <p class="text-[10px] font-medium opacity-60">Drag & drop or click to select (.sql, .txt)</p>
              </div>
            </div>
          </div>

          <div
            class="flex items-center gap-4 before:h-px before:flex-1 before:bg-secondary-800 after:h-px after:flex-1 after:bg-secondary-800"
          >
            <span class="text-[10px] font-bold text-secondary-600 uppercase tracking-widest">OR PASTE BELOW</span>
          </div>

          <div class="flex-1 relative group">
            <div
               class="absolute -inset-1 bg-linear-to-r from-primary-500/20 to-secondary-500/20 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"
            />
            <textarea
              v-model="importInput"
              placeholder="CREATE TABLE users ( id UUID PRIMARY KEY, ... );"
              class="relative w-full h-full bg-secondary-950 border border-secondary-800 rounded-2xl p-6 text-sm font-mono text-secondary-300 focus:outline-none focus:border-primary-500/50 resize-none leading-relaxed selection:bg-primary-500/30 custom-scrollbar"
            />
          </div>
        </div>

        <!-- Footer -->
        <div
          class="px-8 py-6 border-t border-secondary-800 bg-secondary-950/30 shrink-0 flex gap-4"
        >
          <button
            class="flex-1 bg-secondary-800 hover:bg-secondary-700 text-secondary-50 font-bold py-4 rounded-xl transition-all shadow-lg active:scale-[0.98] focus:ring-2 focus:ring-secondary-500 focus:outline-none"
            @click="emit('close')"
          >
            Cancel
          </button>
          <button
            class="px-12 bg-linear-to-r from-primary-500 to-primary-700 hover:from-primary-400 hover:to-primary-600 text-white font-bold py-4 rounded-xl transition-all shadow-xl active:scale-[0.98] flex items-center justify-center gap-3 focus:ring-2 focus:ring-primary-500 focus:outline-none"
            @click="handleImport"
          >
            <svg
              aria-hidden="true"
              class="w-5 h-5 font-bold"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="3"
                d="M5 13l4 4L19 7"
              />
            </svg>
            Complete Import
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 8px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: rgba(15, 23, 42, 0.5);
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #334155;
  border-radius: 10px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #475569;
}
</style>
