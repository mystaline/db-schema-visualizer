<script setup lang="ts">
import { computed, ref } from "vue";
import { useSchemaStore } from "../stores/schemaStore";
import { useToast } from "../composables/useToast";
import ColumnEditor from "./ColumnEditor.vue";
import ForeignKeyEditor from "./ForeignKeyEditor.vue";
import IndexEditor from "./IndexEditor.vue";
import ConstraintEditor from "./ConstraintEditor.vue";
import ConfirmModal from "./ConfirmModal.vue";

const schemaStore = useSchemaStore();
const { toast } = useToast();
const activeTab = ref<"none" | "columns" | "fk" | "index" | "constraint">(
  "none",
);

const selectedTable = computed(() =>
  schemaStore.tables.find((t) => t.id === schemaStore.selectedTableId),
);

const pendingDelete = ref(false);

const handleDelete = () => {
  pendingDelete.value = true;
};

const confirmDelete = () => {
  if (!selectedTable.value) {
    toast("No table selected to delete", "error");
    pendingDelete.value = false;
    return;
  }
  const id = selectedTable.value.id;
  try {
    schemaStore.removeTable(id);
  } catch (e) {
    console.error("[MobileSelectedTableUI] removeTable threw unexpectedly", e);
    toast("Failed to delete the table. Please try again.", "error");
  } finally {
    activeTab.value = "none";
    pendingDelete.value = false;
  }
};

const closeSheet = () => {
  activeTab.value = "none";
};

const tabs = [
  { id: "columns", label: "Columns", icon: "M4 6h16M4 12h16M4 18h16" },
  {
    id: "fk",
    label: "Relations",
    icon: "M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4-4m-4 4l4 4",
  },
  { id: "index", label: "Indexes", icon: "M13 10V3L4 14h7v7l9-11h-7z" },
  {
    id: "constraint",
    label: "Checks",
    icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
  },
];
</script>

<template>
  <div
    v-if="selectedTable"
    class="fixed inset-x-0 bottom-0 z-99902 pointer-events-none flex flex-col items-center lg:hidden"
  >
    <!-- Blocking Backdrop -->
    <div
      v-if="activeTab !== 'none'"
      class="fixed inset-0 bg-secondary-950/60 backdrop-blur-sm pointer-events-auto z-[-1]"
      @click="closeSheet"
    />

    <!-- Mobile Sheet -->
    <div
      class="w-full max-w-2xl bg-secondary-950 border-t border-secondary-700 rounded-t-2xl shadow-[0_-12px_40px_rgba(0,0,0,0.4)] transition-transform duration-300 pointer-events-auto overflow-hidden flex flex-col"
      :class="
        activeTab === 'none' ? 'translate-y-full' : 'translate-y-0 h-[70vh]'
      "
    >
      <!-- Handle -->
      <div
        class="h-7 flex items-center justify-center shrink-0 cursor-pointer"
        @click="closeSheet"
      >
        <div class="w-10 h-1 bg-secondary-700 rounded-full" />
      </div>

      <!-- Header -->
      <div
        class="px-5 py-2.5 border-b border-secondary-700 flex items-center justify-between shrink-0"
      >
        <div class="flex items-center gap-2">
          <h3
            class="text-sm font-semibold text-secondary-50 font-mono tracking-tight"
          >
            {{ selectedTable.name }}
          </h3>
          <span class="text-[10px] text-secondary-500 font-mono"
            >/ {{ activeTab }}</span
          >
        </div>
        <button
          @click="closeSheet"
          class="p-1.5 text-secondary-500 hover:text-secondary-200 transition-colors"
        >
          <svg
            class="w-4 h-4"
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

      <!-- Content -->
      <div class="flex-1 overflow-y-auto p-5 custom-scrollbar">
        <ColumnEditor v-if="activeTab === 'columns'" />
        <ForeignKeyEditor v-if="activeTab === 'fk'" />
        <IndexEditor v-if="activeTab === 'index'" />
        <ConstraintEditor v-if="activeTab === 'constraint'" />
      </div>
    </div>

    <!-- Bottom Nav Bar -->
    <div
      class="mb-6 mx-4 w-[calc(100%-2rem)] max-w-md bg-secondary-950/95 backdrop-blur-xl border border-secondary-700 rounded-xl shadow-lg pointer-events-auto flex items-stretch p-1 transition-all"
      :class="
        activeTab !== 'none'
          ? 'opacity-0 scale-95 pointer-events-none'
          : 'opacity-100 scale-100'
      "
    >
      <button
        v-for="tab in tabs"
        :key="tab.id"
        class="flex-1 flex flex-col items-center justify-center gap-1 py-2 rounded-lg transition-all active:scale-90"
        :class="
          activeTab === tab.id
            ? 'bg-primary-500/15 text-primary-400'
            : 'text-secondary-500 hover:bg-secondary-800 hover:text-secondary-300'
        "
        @click="activeTab = tab.id as any"
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
            :d="tab.icon"
          />
        </svg>
        <span class="text-[9px] font-bold uppercase tracking-tighter">{{
          tab.label
        }}</span>
      </button>

      <div class="w-px bg-secondary-700 mx-0.5 self-stretch" />

      <button
        class="flex-1 flex flex-col items-center justify-center gap-1 py-2 rounded-xl transition-all duration-300 active:scale-90 text-danger-500 hover:bg-danger-500/10"
        @click="handleDelete"
      >
        <svg
          class="w-5 h-5 font-bold"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
          />
        </svg>
        <span class="text-[9px] font-bold uppercase tracking-tighter">Delete</span>
      </button>
    </div>
  </div>

  <ConfirmModal
    :is-open="pendingDelete"
    title="Delete Table"
    :message="selectedTable ? `'${selectedTable.name}' and all its columns, indexes, and foreign keys will be permanently removed.` : ''"
    @confirm="confirmDelete"
    @cancel="pendingDelete = false"
  />
</template>

<style scoped>
.z-99902 {
  z-index: 99902;
}
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #334155;
  border-radius: 10px;
}
</style>
