<script setup lang="ts">
import { ref, nextTick } from "vue";
import { useSchemaStore } from "../stores/schemaStore";
import ColumnEditor from "./ColumnEditor.vue";
import ForeignKeyEditor from "./ForeignKeyEditor.vue";
import IndexEditor from "./IndexEditor.vue";
import ConstraintEditor from "./ConstraintEditor.vue";

const schemaStore = useSchemaStore();
const activeTab = ref("columns");

const isRenamingTable = ref(false);
const renameValue = ref("");
const renameInput = ref<HTMLInputElement | null>(null);

const IDENTIFIER_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

const startRename = async () => {
  if (schemaStore.viewMode !== "full" || !schemaStore.selectedTable) return;
  renameValue.value = schemaStore.selectedTable.name;
  isRenamingTable.value = true;
  await nextTick();
  renameInput.value?.focus();
  renameInput.value?.select();
};

const commitRename = () => {
  let sanitized = renameValue.value.replace(/[^a-zA-Z0-9_]/g, "");
  if (sanitized && /^\d/.test(sanitized)) sanitized = "_" + sanitized;
  if (
    sanitized &&
    IDENTIFIER_RE.test(sanitized) &&
    schemaStore.selectedTableId
  ) {
    schemaStore.updateTable(schemaStore.selectedTableId, { name: sanitized });
  }
  isRenamingTable.value = false;
};

const cancelRename = () => {
  isRenamingTable.value = false;
};

const tabs = [
  { id: "columns", name: "Columns" },
  { id: "relations", name: "Foreign Keys" },
  { id: "indexes", name: "Indexes" },
  { id: "constraints", name: "Constraints" },
  { id: "notes", name: "Notes" },
];

const updateNotes = (e: Event) => {
  if (!schemaStore.selectedTableId) return;
  schemaStore.updateTable(schemaStore.selectedTableId, {
    notes: (e.target as HTMLTextAreaElement).value,
  });
};
</script>

<template>
  <section
    class="flex flex-col h-full bg-secondary-950 border-l border-secondary-700"
  >
    <!-- Header -->
    <div
      class="px-5 py-4 border-b border-secondary-700 flex justify-between items-center"
    >
      <div
        v-if="schemaStore.selectedTable"
        class="flex flex-col gap-0.5 min-w-0"
      >
        <!-- Inline rename input -->
        <input
          v-if="isRenamingTable"
          ref="renameInput"
          v-model="renameValue"
          class="text-sm font-semibold text-secondary-50 font-mono tracking-tight bg-transparent border-b border-primary-500 focus:outline-none w-full"
          @blur="commitRename"
          @keydown.enter="commitRename"
          @keydown.escape="cancelRename"
        />
        <!-- Clickable table name -->
        <h3
          v-else
          class="text-sm font-semibold text-secondary-50 font-mono tracking-tight truncate"
          :class="
            schemaStore.viewMode === 'full'
              ? 'cursor-text hover:text-primary-400 transition-colors'
              : ''
          "
          :title="
            schemaStore.viewMode === 'full' ? 'Click to rename' : undefined
          "
          @click="startRename"
        >
          {{ schemaStore.selectedTable.name }}
        </h3>
        <p class="text-[10px] text-secondary-500 font-medium font-mono">
          {{ schemaStore.selectedTable.id.split("-")[0] }}
        </p>
      </div>
      <div v-else>
        <h3 class="text-sm font-semibold text-secondary-400">Table Details</h3>
      </div>
      <span
        v-if="schemaStore.selectedTable"
        class="text-[10px] font-semibold font-mono px-2 py-0.5 rounded-md bg-secondary-800 border border-secondary-700 text-secondary-300"
      >
        {{ schemaStore.selectedTable.columns.length }} col
      </span>
    </div>

    <template v-if="schemaStore.selectedTable">
      <!-- Tabs Navigation -->
      <nav
        class="flex border-b border-secondary-700 text-xs font-semibold overflow-x-auto no-scrollbar"
      >
        <button
          v-for="tab in tabs"
          :key="tab.id"
          class="px-4 py-2.5 border-b-2 transition-all whitespace-nowrap"
          :class="[
            activeTab === tab.id
              ? 'border-primary-500 text-primary-400'
              : 'border-transparent text-secondary-500 hover:text-secondary-200',
          ]"
          @click="activeTab = tab.id"
        >
          {{ tab.name }}
        </button>
      </nav>

      <!-- Tab Content -->
      <div class="flex-1 overflow-y-auto no-scrollbar p-5">
        <ColumnEditor v-if="activeTab === 'columns'" />
        <ForeignKeyEditor v-else-if="activeTab === 'relations'" />
        <IndexEditor v-else-if="activeTab === 'indexes'" />
        <ConstraintEditor v-else-if="activeTab === 'constraints'" />

        <!-- Notes Tab -->
        <div v-else-if="activeTab === 'notes'" class="space-y-4">
          <div class="flex items-center justify-between">
            <h4
              class="text-xs font-bold text-secondary-400 uppercase tracking-widest"
            >
              Table Notes
            </h4>
          </div>
          <textarea
            :value="schemaStore.selectedTable?.notes ?? ''"
            :readonly="schemaStore.viewMode !== 'full'"
            rows="12"
            placeholder="Add notes, documentation, or context about this table..."
            class="w-full bg-secondary-950 border border-secondary-800 rounded-lg px-4 py-3 text-xs focus:border-primary-500 focus:outline-none text-secondary-200 placeholder:text-secondary-500 resize-none leading-relaxed"
            :class="
              schemaStore.viewMode !== 'full' ? 'cursor-default opacity-70' : ''
            "
            @input="updateNotes"
          />
          <p class="text-[10px] text-secondary-500 italic">
            Notes are included in the SQL export as comments above the table
            definition.
          </p>
        </div>
      </div>
    </template>

    <div
      v-else
      class="flex-1 flex items-center justify-center p-12 text-center select-none"
    >
      <div class="space-y-6 max-w-xs animate-in fade-in zoom-in duration-700">
        <div
          class="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-secondary-800/30 border-2 border-dashed border-secondary-800 mb-8 opacity-40 shadow-inner"
        >
          <svg
            class="w-10 h-10 text-secondary-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.5"
              d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122"
            />
          </svg>
        </div>
        <h4 class="text-lg font-bold text-secondary-400 tracking-tight">
          No Entity Selected
        </h4>
        <p class="text-sm text-secondary-400 leading-relaxed font-medium">
          Select a table from the system entity list to architecturalize its
          structure, constraints, and relationships.
        </p>
      </div>
    </div>
  </section>
</template>

<style scoped>
.no-scrollbar::-webkit-scrollbar {
  display: none;
}
.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
