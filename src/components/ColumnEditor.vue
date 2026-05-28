<script setup lang="ts">
import { nextTick, ref, computed } from "vue";
import { useSchemaStore, type Column } from "../stores/schemaStore";
import TypeSelector from "./TypeSelector.vue";
import ConfirmModal from "./ConfirmModal.vue";

const schemaStore = useSchemaStore();
const nameInputs = ref<HTMLInputElement[]>([]);
const pendingDeleteId = ref<string | null>(null);
const dragIndex = ref<number | null>(null);
const dragOverIndex = ref<number | null>(null);

const IDENTIFIER_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

// Returns a set of column IDs that have invalid or duplicate names
const invalidColumnIds = computed(() => {
  const cols = schemaStore.selectedTable?.columns ?? [];
  const invalid = new Set<string>();
  const seen = new Map<string, string>(); // lowercase name -> first id
  for (const col of cols) {
    const key = col.name.toLowerCase();
    if (!col.name || !IDENTIFIER_RE.test(col.name)) {
      invalid.add(col.id);
    } else if (seen.has(key)) {
      invalid.add(col.id);
      invalid.add(seen.get(key)!); // also flag the first occurrence
    } else {
      seen.set(key, col.id);
    }
  }
  return invalid;
});

const addColumn = async () => {
  if (schemaStore.selectedTableId) {
    schemaStore.addColumn(schemaStore.selectedTableId);
    await nextTick();
    const lastInput = nameInputs.value[nameInputs.value.length - 1];
    lastInput?.focus();
  }
};

const updateColumn = (columnId: string, updates: Partial<Column>) => {
  if (schemaStore.selectedTableId) {
    schemaStore.updateColumn(schemaStore.selectedTableId, columnId, updates);
  }
};

const updateColumnName = (columnId: string, raw: string) => {
  // Strip any char that isn't a letter, digit, or underscore
  let sanitized = raw.replace(/[^a-zA-Z0-9_]/g, "");
  // If it starts with a digit, prepend underscore
  if (sanitized && /^\d/.test(sanitized)) sanitized = "_" + sanitized;
  updateColumn(columnId, { name: sanitized });
};

const requestDelete = (columnId: string) => {
  pendingDeleteId.value = columnId;
};

const confirmDelete = () => {
  if (pendingDeleteId.value && schemaStore.selectedTableId) {
    schemaStore.removeColumn(
      schemaStore.selectedTableId,
      pendingDeleteId.value,
    );
    pendingDeleteId.value = null;
  }
};

const cancelDelete = () => {
  pendingDeleteId.value = null;
};

const onDragStart = (idx: number) => {
  dragIndex.value = idx;
};
const onDragOver = (idx: number, e: DragEvent) => {
  e.preventDefault();
  dragOverIndex.value = idx;
};
const onDrop = (idx: number) => {
  if (dragIndex.value !== null && schemaStore.selectedTableId) {
    schemaStore.reorderColumns(
      schemaStore.selectedTableId,
      dragIndex.value,
      idx,
    );
  }
  dragIndex.value = null;
  dragOverIndex.value = null;
};
const onDragEnd = () => {
  dragIndex.value = null;
  dragOverIndex.value = null;
};
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-start justify-between">
      <div>
        <h4
          class="text-[10px] font-bold text-secondary-400 uppercase tracking-widest"
        >
          Schema
        </h4>
        <div class="text-sm mt-1">
          <span class="font-semibold text-secondary-100"
            >{{ schemaStore.selectedTable?.columns.length }} columns</span
          >
          <span class="text-secondary-500"> · drag to reorder</span>
        </div>
      </div>
    </div>

    <!-- Column Rows -->
    <div class="space-y-2 mt-2 pb-1">
      <div
        v-for="(col, colIdx) in schemaStore.selectedTable?.columns"
        :key="col.id"
        :class="[
          invalidColumnIds.has(col.id)
            ? 'border-danger-500/50 hover:border-danger-500/70'
            : col.defaultValue
              ? 'border-secondary-800/50 border-l-success-500/60 hover:border-secondary-700/50 hover:border-l-success-500/80'
              : 'border-secondary-800/50 hover:border-secondary-700/50',
          dragOverIndex === colIdx && dragIndex !== colIdx
            ? 'border-t-primary-500 border-t-2'
            : '',
          col.defaultValue ? 'border-l-2' : '',
        ]"
        class="group relative bg-secondary-900/40 rounded-lg border transition-colors overflow-hidden"
        :draggable="schemaStore.viewMode === 'full'"
        @dragstart="onDragStart(colIdx)"
        @dragover="onDragOver(colIdx, $event)"
        @drop="onDrop(colIdx)"
        @dragend="onDragEnd"
      >
        <template v-if="true">
          <!-- Row 1: drag handle + name + delete -->
          <div
            class="grid items-center px-2 pt-2 pb-1"
            :class="
              schemaStore.viewMode === 'full'
                ? 'grid-cols-[16px_1fr_24px] gap-1.5'
                : 'grid-cols-[1fr] gap-1.5'
            "
          >
            <div
              v-if="schemaStore.viewMode === 'full'"
              class="flex items-center justify-center cursor-grab text-secondary-600 hover:text-secondary-400"
            >
              <svg class="w-2.5 h-3.5" viewBox="0 0 10 14" fill="currentColor">
                <circle cx="2.5" cy="2.5" r="1.2" />
                <circle cx="7.5" cy="2.5" r="1.2" />
                <circle cx="2.5" cy="7" r="1.2" />
                <circle cx="7.5" cy="7" r="1.2" />
                <circle cx="2.5" cy="11.5" r="1.2" />
                <circle cx="7.5" cy="11.5" r="1.2" />
              </svg>
            </div>
            <!-- Name Input -->
            <input
              ref="nameInputs"
              :value="col.name"
              class="min-w-0 w-full bg-transparent text-[12.5px] font-mono focus:outline-none transition-colors placeholder:text-secondary-500"
              :class="[
                invalidColumnIds.has(col.id)
                  ? 'text-danger-400 focus:text-danger-300'
                  : 'text-secondary-100 focus:text-primary-400',
                col.isPrimaryKey ? 'font-bold' : 'font-medium',
              ]"
              placeholder="col_name"
              :aria-label="`Column name: ${col.name}`"
              :readonly="schemaStore.viewMode === 'read'"
              :title="
                invalidColumnIds.has(col.id)
                  ? 'Invalid: use letters, digits, underscores only; no duplicates'
                  : undefined
              "
              @click.stop
              @input="
                (e) =>
                  updateColumnName(col.id, (e.target as HTMLInputElement).value)
              "
            />
            <button
              v-if="schemaStore.viewMode === 'full'"
              class="flex items-center justify-center text-secondary-600 hover:text-danger-500 transition-colors p-0.5"
              :aria-label="`Delete column ${col.name}`"
              @click="requestDelete(col.id)"
            >
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
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </button>
          </div>

          <!-- Row 2: type selector (full width) -->
          <div
            class="px-2 pb-1"
            :class="schemaStore.viewMode === 'full' ? 'pl-[34px]' : 'pl-2'"
          >
            <TypeSelector
              :model-value="col.type"
              :disabled="schemaStore.viewMode === 'read'"
              @update:model-value="(val) => updateColumn(col.id, { type: val })"
            />
          </div>

          <!-- Row 3: PK / NULL / UNQ pill toggles -->
          <div
            class="flex items-center gap-1.5 px-2 pb-1.5"
            :class="schemaStore.viewMode === 'full' ? 'pl-[34px]' : 'pl-2'"
          >
            <!-- PK pill toggle -->
            <button
              class="h-6 flex-1 px-2 rounded-md text-[10px] font-bold font-mono tracking-wide border transition-all"
              :class="
                col.isPrimaryKey
                  ? 'bg-primary-500/10 border-primary-500 text-primary-400'
                  : 'bg-transparent border-secondary-700 text-secondary-500 hover:border-secondary-500 hover:text-secondary-300'
              "
              :disabled="schemaStore.viewMode === 'read'"
              :aria-label="`${col.name} is primary key`"
              @click="updateColumn(col.id, { isPrimaryKey: !col.isPrimaryKey })"
            >
              PK
            </button>
            <!-- NULL pill toggle -->
            <button
              class="h-6 flex-1 px-2 rounded-md text-[10px] font-bold font-mono tracking-wide border transition-all"
              :class="
                col.isNullable && !col.isPrimaryKey
                  ? 'bg-secondary-500/10 border-secondary-500 text-secondary-300'
                  : 'bg-transparent border-secondary-700 text-secondary-500 hover:border-secondary-500 hover:text-secondary-300'
              "
              :disabled="col.isPrimaryKey || schemaStore.viewMode === 'read'"
              :aria-label="`${col.name} is nullable`"
              @click="updateColumn(col.id, { isNullable: !col.isNullable })"
            >
              NULL
            </button>
            <!-- UNQ pill toggle -->
            <button
              class="h-6 flex-1 px-2 rounded-md text-[10px] font-bold font-mono tracking-wide border transition-all"
              :class="
                col.isUnique
                  ? 'bg-danger-400/10 border-danger-400 text-danger-400'
                  : 'bg-transparent border-secondary-700 text-secondary-500 hover:border-secondary-500 hover:text-secondary-300'
              "
              :disabled="schemaStore.viewMode === 'read'"
              :aria-label="`${col.name} is unique`"
              @click="updateColumn(col.id, { isUnique: !col.isUnique })"
            >
              UNQ
            </button>
          </div>

          <!-- Row 3: default value (always visible) -->
          <div
            class="flex items-center gap-2 px-2 pb-2"
            :class="schemaStore.viewMode === 'full' ? 'pl-[34px]' : 'pl-2'"
            @click.stop
          >
            <span
              class="text-[9px] font-bold text-secondary-500 uppercase tracking-wider shrink-0"
              >DEFAULT</span
            >
            <input
              :value="col.defaultValue ?? ''"
              type="text"
              placeholder="e.g. now(), gen_random_uuid(), 'active'"
              class="flex-1 min-w-0 bg-secondary-950 border border-secondary-800 rounded px-2 py-0.5 text-[10px] font-mono text-secondary-200 focus:border-primary-500 focus:outline-none transition-colors placeholder:text-secondary-600"
              :readonly="schemaStore.viewMode === 'read'"
              @input="
                (e) =>
                  updateColumn(col.id, {
                    defaultValue: (e.target as HTMLInputElement).value || null,
                  })
              "
            />
            <!-- Green dot marker when default is set -->
            <span
              v-if="col.defaultValue"
              class="w-2 h-2 rounded-full bg-success-500 shrink-0"
              title="Has default value"
            />
          </div>
        </template>
      </div>
    </div>

    <!-- Add Column Button (edit mode only) -->
    <button
      v-if="schemaStore.viewMode === 'full'"
      class="w-full flex items-center justify-center gap-2 py-2.5 border border-dashed border-secondary-700 bg-secondary-900/40 hover:bg-secondary-800/60 hover:border-secondary-500 rounded-lg text-secondary-400 hover:text-secondary-200 text-xs font-medium transition-all group focus:outline-none focus:ring-1 focus:ring-primary-500"
      @click="addColumn"
    >
      <svg
        class="w-4 h-4 group-hover:scale-110 transition-transform"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M12 4v16m8-8H4"
        />
      </svg>
      Add column
    </button>
  </div>

  <!-- Delete column confirmation modal -->
  <ConfirmModal
    :is-open="!!pendingDeleteId"
    :title="`Delete column?`"
    :message="pendingDeleteId ? `'${schemaStore.selectedTable?.columns.find(c => c.id === pendingDeleteId)?.name}' will be permanently removed.` : undefined"
    @confirm="confirmDelete"
    @cancel="cancelDelete"
  />
</template>
