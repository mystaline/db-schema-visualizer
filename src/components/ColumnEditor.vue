<script setup lang="ts">
import { nextTick, ref, computed } from "vue";
import { useSchemaStore, type Column } from "../stores/schemaStore";

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

const dataTypes = [
  {
    group: "Numeric",
    types: [
      "smallint",
      "int",
      "bigint",
      "smallserial",
      "serial",
      "bigserial",
      "numeric",
      "decimal",
      "real",
      "double precision",
    ],
  },
  { group: "Text", types: ["varchar", "text", "char", "citext", "name"] },
  {
    group: "Date/Time",
    types: ["timestamp", "timestamptz", "date", "time", "interval"],
  },
  {
    group: "JSON/NoSQL",
    types: ["jsonb", "json", "xml", "hstore"],
  },
  {
    group: "Network",
    types: ["inet", "cidr", "macaddr", "macaddr8"],
  },
  {
    group: "Geometric",
    types: ["point", "line", "lseg", "box", "path", "polygon", "circle"],
  },
  {
    group: "GIS (PostGIS)",
    types: ["geometry", "geography"],
  },
  {
    group: "Arrays",
    types: [
      "text[]",
      "int[]",
      "bigint[]",
      "numeric[]",
      "decimal[]",
      "real[]",
      "double precision[]",
      "boolean[]",
      "uuid[]",
      "jsonb[]",
      "json[]",
      "inet[]",
      "macaddr[]",
      "cidr[]",
    ],
  },
  {
    group: "Miscellaneous",
    types: [
      "boolean",
      "uuid",
      "bytea",
      "money",
      "bit",
      "varbit",
      "tsvector",
      "tsquery",
    ],
  },
];

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
    <div class="flex items-center justify-between">
      <h4
        class="text-xs font-bold text-secondary-400 uppercase tracking-widest"
      >
        Entity Schema
      </h4>
      <span class="text-xs text-secondary-400 font-medium"
        >DEFINED COLUMNS: {{ schemaStore.selectedTable?.columns.length }}</span
      >
    </div>

    <!-- Column Headers: 5-col grid (delete is absolute overlay, not in grid) -->
    <div
      class="grid grid-cols-[1fr_80px_28px_28px_28px] gap-1.5 px-2 text-[10px] font-bold uppercase tracking-wider text-secondary-400 border-b border-secondary-600 pb-2"
    >
      <div>Name</div>
      <div>Type</div>
      <div class="text-center">PK</div>
      <div class="text-center">NULL</div>
      <div class="text-center">UNQ</div>
    </div>
    <p class="text-[10px] text-secondary-400 px-2 flex items-center gap-1.5">
      <span class="inline-block w-1 h-3 bg-success-500 rounded-full" /> has
      default value
    </p>

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
        <!-- Normal Row -->
        <div
          v-if="pendingDeleteId !== col.id"
          class="grid items-center px-2 py-1.5"
          :class="
            schemaStore.viewMode === 'full'
              ? 'grid-cols-[16px_1fr_80px_28px_28px_28px] gap-1'
              : 'grid-cols-[1fr_80px_28px_28px_28px] gap-1.5'
          "
        >
          <!-- Drag Handle (edit mode only) -->
          <div
            v-if="schemaStore.viewMode === 'full'"
            class="flex items-center justify-center cursor-grab text-secondary-600 hover:text-secondary-400"
          >
            <svg class="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="9" cy="6" r="1.5" />
              <circle cx="15" cy="6" r="1.5" />
              <circle cx="9" cy="12" r="1.5" />
              <circle cx="15" cy="12" r="1.5" />
              <circle cx="9" cy="18" r="1.5" />
              <circle cx="15" cy="18" r="1.5" />
            </svg>
          </div>
          <!-- Name Input -->
          <input
            ref="nameInputs"
            :value="col.name"
            class="min-w-0 w-full bg-transparent text-sm focus:outline-none transition-colors placeholder:text-secondary-500"
            :class="
              invalidColumnIds.has(col.id)
                ? 'text-danger-400 focus:text-danger-300'
                : 'text-secondary-100 focus:text-primary-400'
            "
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

          <!-- Type Select -->
          <select
            :value="col.type"
            :disabled="schemaStore.viewMode === 'read'"
            class="w-full bg-secondary-950 border border-secondary-800 text-[10px] rounded px-1 py-0.5 text-secondary-300 focus:border-primary-500 focus:outline-none focus:text-secondary-50 transition-colors disabled:opacity-60 disabled:cursor-default"
            :aria-label="`Column type for ${col.name}`"
            @click.stop
            @change="
              (e) =>
                updateColumn(col.id, {
                  type: (e.target as HTMLSelectElement).value,
                })
            "
          >
            <optgroup
              v-for="group in dataTypes"
              :key="group.group"
              :label="group.group"
            >
              <option v-for="type in group.types" :key="type" :value="type">
                {{ type }}
              </option>
            </optgroup>
          </select>

          <!-- PK Toggle -->
          <div class="flex justify-center">
            <input
              type="checkbox"
              :checked="col.isPrimaryKey"
              :disabled="schemaStore.viewMode === 'read'"
              class="w-4 h-4 rounded bg-secondary-950 border-secondary-800 text-primary-500 focus:ring-primary-500 focus:ring-offset-secondary-950 cursor-pointer disabled:opacity-60 disabled:cursor-default accent-primary-500"
              :aria-label="`${col.name} is primary key`"
              @change="
                (e) =>
                  updateColumn(col.id, {
                    isPrimaryKey: (e.target as HTMLInputElement).checked,
                  })
              "
            />
          </div>

          <!-- Nullable Toggle -->
          <div class="flex justify-center">
            <input
              type="checkbox"
              :checked="col.isNullable"
              :disabled="col.isPrimaryKey || schemaStore.viewMode === 'read'"
              class="w-4 h-4 rounded bg-secondary-950 border-secondary-800 text-primary-500 focus:ring-primary-500 focus:ring-offset-secondary-950 cursor-pointer disabled:opacity-20 accent-primary-500"
              :aria-label="`${col.name} is nullable`"
              @change="
                (e) =>
                  updateColumn(col.id, {
                    isNullable: (e.target as HTMLInputElement).checked,
                  })
              "
            />
          </div>

          <!-- Unique Toggle -->
          <div class="flex justify-center">
            <input
              type="checkbox"
              :checked="col.isUnique"
              :disabled="schemaStore.viewMode === 'read'"
              class="w-4 h-4 rounded bg-secondary-950 border-secondary-800 text-primary-500 focus:ring-primary-500 focus:ring-offset-secondary-950 cursor-pointer disabled:opacity-60 disabled:cursor-default accent-primary-500"
              :aria-label="`${col.name} is unique`"
              @change="
                (e) =>
                  updateColumn(col.id, {
                    isUnique: (e.target as HTMLInputElement).checked,
                  })
              "
            />
          </div>
        </div>

        <!-- Delete Confirmation Row -->
        <div
          v-if="pendingDeleteId === col.id"
          class="flex items-center justify-between px-3 py-2 bg-danger-500/5 border-danger-500/20"
          role="alert"
        >
          <span class="text-xs text-danger-400 font-medium"
            >Delete <span class="font-bold text-danger-300">{{ col.name }}</span
            >?</span
          >
          <div class="flex gap-2">
            <button
              class="px-3 py-1 text-[10px] font-bold bg-danger-500/20 hover:bg-danger-500/40 text-danger-300 rounded-lg transition-colors focus:outline-none focus:ring-1 focus:ring-danger-500"
              @click="confirmDelete"
            >
              Delete
            </button>
            <button
              class="px-3 py-1 text-[10px] font-bold bg-secondary-800 hover:bg-secondary-700 text-secondary-300 rounded-lg transition-colors focus:outline-none focus:ring-1 focus:ring-secondary-500"
              @click="cancelDelete"
            >
              Cancel
            </button>
          </div>
        </div>

        <!-- Expanded Row: Default Value + Delete -->
        <div
          v-if="pendingDeleteId !== col.id"
          class="px-2 pb-1.5 flex items-center gap-1.5"
          @click.stop
        >
          <span
            class="text-[9px] font-bold text-secondary-500 uppercase shrink-0"
            >DEFAULT</span
          >
          <input
            :value="col.defaultValue ?? ''"
            type="text"
            placeholder="e.g. now(), gen_random_uuid(), 'active'"
            class="flex-1 min-w-0 bg-secondary-950 border border-secondary-800 rounded px-2 py-0.5 text-[10px] text-secondary-200 focus:border-primary-500 focus:outline-none transition-colors"
            :readonly="schemaStore.viewMode === 'read'"
            @input="
              (e) =>
                updateColumn(col.id, {
                  defaultValue: (e.target as HTMLInputElement).value || null,
                })
            "
          />
          <button
            v-if="schemaStore.viewMode === 'full'"
            class="shrink-0 text-secondary-400 hover:text-danger-500 transition-colors p-1 rounded cursor-pointer"
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
      </div>
    </div>

    <!-- Add Column Button (edit mode only) -->
    <button
      v-if="schemaStore.viewMode === 'full'"
      class="w-full flex items-center justify-center gap-2 p-3 border border-secondary-800 bg-secondary-900/50 hover:bg-secondary-800 rounded-xl text-secondary-300 hover:text-secondary-100 text-xs font-bold transition-all group focus:outline-none focus:ring-2 focus:ring-primary-500"
      @click="addColumn"
    >
      <svg
        class="w-4 h-4 group-hover:scale-110 transition-transform text-primary-500"
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
      Insert New Attribute
    </button>
  </div>
</template>
