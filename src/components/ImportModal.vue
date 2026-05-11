<script setup lang="ts">
import { ref, computed, watch, nextTick, onUnmounted } from "vue";
import { useSchemaStore } from "../stores/schemaStore";
import { useToast } from "../composables/useToast";
import { useHistory } from "../composables/useHistory";
import ModalShell from "./ModalShell.vue";
import ConfirmModal from "./ConfirmModal.vue";

const props = defineProps<{
  isOpen: boolean;
}>();

const emit = defineEmits(["close"]);

const schemaStore = useSchemaStore();
const { toast } = useToast();
const { clearHistory } = useHistory();

const modalRef = ref<HTMLElement | null>(null);
const fileInputRef = ref<HTMLInputElement | null>(null);
const isDragging = ref(false);

type ImportTab = "sql" | "json";
const activeTab = ref<ImportTab>("sql");

const sqlInput = ref("");
const jsonInput = ref("");
const importInput = computed({
  get: () => (activeTab.value === "sql" ? sqlInput.value : jsonInput.value),
  set: (v: string) => {
    if (activeTab.value === "sql") sqlInput.value = v;
    else jsonInput.value = v;
  },
});

const textareaPlaceholder = computed(() =>
  activeTab.value === "sql"
    ? "CREATE TABLE users ( id UUID PRIMARY KEY, ... );"
    : '{ "version": 1, "tables": [...], "foreignKeys": [...] }',
);

const pendingImportConfirm = ref(false);

const handleImport = async () => {
  if (!importInput.value.trim()) {
    toast(
      activeTab.value === "sql"
        ? "Please paste some SQL or upload a file first"
        : "Please paste some JSON or upload a file first",
      "error",
    );
    return;
  }
  if (schemaStore.tables.length > 0) {
    pendingImportConfirm.value = true;
    return;
  }
  await doImport();
};

const doImport = async () => {
  pendingImportConfirm.value = false;
  try {
    if (activeTab.value === "sql") {
      await schemaStore.importFromSql(importInput.value);
    } else {
      await schemaStore.importFromJson(importInput.value);
    }
    clearHistory();
    toast("Schema imported successfully!");
    emit("close");
    sqlInput.value = "";
    jsonInput.value = "";
  } catch (err) {
    console.error("Import failed", err);
    const detail = err instanceof Error ? err.message : String(err);
    toast(
      activeTab.value === "sql"
        ? `SQL import failed: ${detail}`
        : `JSON import failed: ${detail}`,
      "error",
    );
  }
};

let tabWhenFileDialogOpened: ImportTab = "sql";

const handleFileUpload = (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (file) {
    readFile(file, tabWhenFileDialogOpened);
  }
};

const handleDrop = (event: DragEvent) => {
  isDragging.value = false;
  const file = event.dataTransfer?.files?.[0];
  if (file) {
    readFile(file);
  }
};

const readFile = (file: File, tabAtReadTime: ImportTab = activeTab.value) => {
  const expectedExts = tabAtReadTime === "sql" ? [".sql", ".txt"] : [".json"];
  const hasValidExt = expectedExts.some((ext) => file.name.endsWith(ext));
  if (!hasValidExt) {
    toast(`Please upload a ${expectedExts.join(" or ")} file`, "warning");
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    const content = e.target?.result;
    if (fileInputRef.value) fileInputRef.value.value = "";
    if (typeof content !== "string" || !content.trim()) {
      toast(`${file.name} appears to be empty or unreadable`, "error");
      return;
    }
    if (tabAtReadTime === "sql") sqlInput.value = content;
    else jsonInput.value = content;
    toast(`Loaded ${file.name}`);
  };
  reader.onerror = () => {
    if (fileInputRef.value) fileInputRef.value.value = "";
    toast(`Failed to read ${file.name}`, "error");
  };
  reader.onabort = () => {
    if (fileInputRef.value) fileInputRef.value.value = "";
    toast("File read was cancelled", "warning");
  };
  reader.readAsText(file);
};

const triggerFileSelect = () => {
  tabWhenFileDialogOpened = activeTab.value;
  fileInputRef.value?.click();
};

// ESC + focus trap
const onKeyDown = (e: KeyboardEvent) => {
  if (!props.isOpen) return;
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
      pendingImportConfirm.value = false;
    }
  },
);

onUnmounted(() => document.removeEventListener("keydown", onKeyDown));
</script>

<template>
  <ModalShell :is-open="isOpen" :closable="!pendingImportConfirm" @close="emit('close')">
      <div
        ref="modalRef"
        class="w-full max-h-[85vh] bg-secondary-900 border border-secondary-800 rounded-3xl overflow-hidden flex flex-col"
      >
        <!-- Header -->
        <div
          class="px-8 py-6 border-b border-secondary-800 flex items-center justify-between bg-secondary-950/30 shrink-0"
        >
          <div class="flex items-center gap-4">
            <div
              class="w-10 h-10 rounded-2xl border flex items-center justify-center transition-colors"
              :class="
                activeTab === 'sql'
                  ? 'bg-primary-500/10 border-primary-500/20'
                  : 'bg-info-500/10 border-info-500/20'
              "
            >
              <svg
                aria-hidden="true"
                class="w-6 h-6 transition-colors"
                :class="
                  activeTab === 'sql' ? 'text-primary-400' : 'text-info-400'
                "
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
                id="import-modal-title"
                class="text-xl font-bold text-secondary-50 tracking-tight"
              >
                Import Schema
              </h3>
              <p
                class="text-xs text-secondary-400 font-medium font-mono uppercase tracking-widest mt-0.5"
              >
                SQL DDL · JSON Snapshot
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

        <!-- Tab Switcher -->
        <div
          class="px-8 pt-5 pb-0 shrink-0 flex items-center gap-1 border-b border-secondary-800 bg-secondary-950/20"
        >
          <button
            id="import-tab-sql"
            class="relative px-5 py-2.5 text-xs font-bold uppercase tracking-widest rounded-t-xl transition-all focus:outline-none"
            :class="
              activeTab === 'sql'
                ? 'text-primary-400 bg-secondary-900 border border-b-0 border-secondary-700'
                : 'text-secondary-500 hover:text-secondary-300 border border-transparent'
            "
            @click="activeTab = 'sql'"
          >
            <span class="flex items-center gap-2">
              <svg
                class="w-3.5 h-3.5"
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
              SQL
            </span>
          </button>
          <button
            id="import-tab-json"
            class="relative px-5 py-2.5 text-xs font-bold uppercase tracking-widest rounded-t-xl transition-all focus:outline-none"
            :class="
              activeTab === 'json'
                ? 'bg-info-500/10 text-info-400 border-info-500/30'
                : 'text-secondary-400 border-transparent hover:bg-secondary-800'
            "
            @click="activeTab = 'json'"
          >
            <span class="flex items-center gap-2">
              <svg
                class="w-3.5 h-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2zM9 7h6m-6 4h6m-6 4h4"
                />
              </svg>
              JSON
            </span>
          </button>
        </div>

        <!-- Body -->
        <div class="flex-1 overflow-hidden p-8 flex flex-col gap-6">
          <!-- Warning Banner -->
          <div
            class="flex items-start gap-4 p-4 rounded-2xl bg-warning-500/10 border border-warning-500/20 text-warning-400"
          >
            <svg
              class="w-5 h-5 shrink-0 mt-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <div class="text-[11px] font-medium leading-relaxed">
              <p class="font-bold uppercase tracking-wider mb-1">
                Warning: Destructive Action
              </p>
              <p class="opacity-80">
                Importing will
                <span class="text-warning-300 font-bold underline"
                  >replace your current workspace</span
                >. Export your work first as SQL or JSON if you need to keep it.
              </p>
            </div>
          </div>

          <!-- Dropzone area -->
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
              :accept="activeTab === 'sql' ? '.sql,.txt' : '.json'"
              class="hidden"
              @change="handleFileUpload"
            />
            <div
              class="flex items-center gap-4 text-secondary-400 group-hover:text-secondary-200 transition-colors"
            >
              <div
                class="w-10 h-10 rounded-xl bg-secondary-700 flex items-center justify-center group-hover:bg-secondary-600 transition-colors"
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
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
              </div>
              <div class="text-left">
                <p class="text-xs font-bold uppercase tracking-widest leading-none mb-1">
                  Upload {{ activeTab === "sql" ? "SQL" : "JSON" }} File
                </p>
                <p class="text-[10px] font-medium opacity-60">
                  {{
                    activeTab === "sql"
                      ? "Drag & drop or click to select (.sql, .txt)"
                      : "Drag & drop or click to select (.json)"
                  }}
                </p>
              </div>
            </div>
          </div>

          <div
            class="flex items-center gap-4 before:h-px before:flex-1 before:bg-secondary-800 after:h-px after:flex-1 after:bg-secondary-800"
          >
            <span
              class="text-[10px] font-bold text-secondary-600 uppercase tracking-widest"
              >OR PASTE BELOW</span
            >
          </div>

          <div class="flex-1 relative group">
            <div
              class="absolute -inset-1 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"
              :class="
                activeTab === 'sql'
                  ? 'bg-linear-to-r from-primary-500/20 to-secondary-500/20'
                  : 'bg-linear-to-r from-info-500/20 to-secondary-500/20'
              "
            />
            <textarea
              v-model="importInput"
              :placeholder="textareaPlaceholder"
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
            class="px-12 text-white font-bold py-4 rounded-xl transition-all shadow-xl active:scale-[0.98] flex items-center justify-center gap-3 focus:ring-2 focus:ring-primary-500 focus:outline-none"
            :class="
              activeTab === 'sql'
                ? 'bg-linear-to-r from-primary-500 to-primary-700 hover:from-primary-400 hover:to-primary-600'
                : 'bg-linear-to-r from-info-500 to-info-700 hover:from-info-400 hover:to-info-600'
            "
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
  </ModalShell>

  <ConfirmModal
    :is-open="pendingImportConfirm"
    title="Overwrite Schema?"
    message="This will replace your current workspace. Export your work first as SQL or JSON if you need to keep it."
    confirm-label="Overwrite"
    @confirm="doImport"
    @cancel="pendingImportConfirm = false"
  />
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
