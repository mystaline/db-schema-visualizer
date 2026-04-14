<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useSchemaStore, type ForeignKey } from "../stores/schemaStore";

const schemaStore = useSchemaStore();

// --- Create form state ---
const newFk = ref({
  sourceColumnId: "",
  targetTableId: "",
  targetColumnId: "",
  onDelete: "NO ACTION" as ForeignKey["onDelete"],
  onUpdate: "NO ACTION" as ForeignKey["onUpdate"],
});

// --- Edit state ---
const editingFkId = ref<string | null>(null);
const editFk = ref({
  sourceColumnId: "",
  targetTableId: "",
  targetColumnId: "",
  onDelete: "NO ACTION" as ForeignKey["onDelete"],
  onUpdate: "NO ACTION" as ForeignKey["onUpdate"],
});

// FKs originating from this table
const outgoingFks = computed(() =>
  schemaStore.foreignKeys.filter(
    (fk) => fk.sourceTableId === schemaStore.selectedTableId,
  ),
);

// FKs from other tables that reference this table
const incomingFks = computed(() =>
  schemaStore.foreignKeys.filter(
    (fk) => fk.targetTableId === schemaStore.selectedTableId,
  ),
);

// Keep for DEFINED count in header
const currentTableFks = computed(() => outgoingFks.value);

// Columns of current table
const sourceColumns = computed(() => schemaStore.selectedTable?.columns || []);

// Target tables (can include self)
const targetTables = computed(() => schemaStore.tables);

// Columns of selected target table for the CREATE form (filtered by PK or Unique)
const targetColumns = computed(() => {
  const targetTable = schemaStore.tables.find(
    (t) => t.id === newFk.value.targetTableId,
  );
  if (!targetTable) return [];
  return targetTable.columns.filter((c) => c.isPrimaryKey || c.isUnique);
});

// Columns of selected target table for the EDIT form (filtered by PK or Unique)
const editTargetColumns = computed(() => {
  const targetTable = schemaStore.tables.find(
    (t) => t.id === editFk.value.targetTableId,
  );
  if (!targetTable) return [];
  return targetTable.columns.filter((c) => c.isPrimaryKey || c.isUnique);
});

const addFk = () => {
  if (
    !schemaStore.selectedTableId ||
    !newFk.value.sourceColumnId ||
    !newFk.value.targetTableId ||
    !newFk.value.targetColumnId
  )
    return;

  schemaStore.addForeignKey({
    sourceTableId: schemaStore.selectedTableId,
    sourceColumnId: newFk.value.sourceColumnId,
    targetTableId: newFk.value.targetTableId,
    targetColumnId: newFk.value.targetColumnId,
    onDelete: newFk.value.onDelete,
    onUpdate: newFk.value.onUpdate,
  });

  // Reset form
  newFk.value = {
    sourceColumnId: "",
    targetTableId: "",
    targetColumnId: "",
    onDelete: "NO ACTION",
    onUpdate: "NO ACTION",
  };
};

// --- Edit helpers ---
const startEdit = (fk: ForeignKey) => {
  editingFkId.value = fk.id;
  editFk.value = {
    sourceColumnId: fk.sourceColumnId,
    targetTableId: fk.targetTableId,
    targetColumnId: fk.targetColumnId,
    onDelete: fk.onDelete,
    onUpdate: fk.onUpdate,
  };
};

const cancelEdit = () => {
  editingFkId.value = null;
};

const commitEdit = () => {
  if (
    !editingFkId.value ||
    !editFk.value.sourceColumnId ||
    !editFk.value.targetTableId ||
    !editFk.value.targetColumnId
  )
    return;

  schemaStore.updateForeignKey(editingFkId.value, {
    sourceColumnId: editFk.value.sourceColumnId,
    targetTableId: editFk.value.targetTableId,
    targetColumnId: editFk.value.targetColumnId,
    onDelete: editFk.value.onDelete,
    onUpdate: editFk.value.onUpdate,
  });

  editingFkId.value = null;
};

// When switching edit target table, clear the target columns
watch(
  () => editFk.value.targetTableId,
  () => {
    editFk.value.targetColumnId = "";
  },
);

const getTableName = (id: string) =>
  schemaStore.tables.find((t) => t.id === id)?.name || "Unknown";

const getColumnName = (tableId: string, colId: string) => {
  const table = schemaStore.tables.find((t) => t.id === tableId);
  return table?.columns.find((c) => c.id === colId)?.name || "Unknown";
};

const actionOptions: ForeignKey["onDelete"][] = [
  "CASCADE",
  "SET NULL",
  "RESTRICT",
  "NO ACTION",
];
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h4
        class="text-xs font-bold text-secondary-400 uppercase tracking-widest"
      >
        Foreign Key Relations
      </h4>
      <span class="text-xs text-secondary-400 font-medium"
        >DEFINED: {{ currentTableFks.length }}</span
      >
    </div>

    <!-- Outgoing FKs (this table -> other) -->
    <div class="space-y-2">
      <div class="flex items-center gap-2 py-1">
        <div class="h-px flex-1 bg-secondary-600" />
        <span
          class="text-[9px] font-bold text-secondary-500 uppercase tracking-[0.2em]"
          >Outgoing</span
        >
        <div class="h-px flex-1 bg-secondary-600" />
      </div>
      <p
        v-if="outgoingFks.length === 0"
        class="text-[11px] text-secondary-500 italic px-1"
      >
        No foreign keys originating from this table.
      </p>
      <div
        v-for="fk in outgoingFks"
        :key="fk.id"
        class="bg-secondary-900/40 rounded-xl border border-secondary-800/50 overflow-hidden group transition-colors"
        :class="editingFkId === fk.id ? 'border-primary-500/40' : ''"
      >
        <!-- Display mode -->
        <template v-if="editingFkId !== fk.id">
          <div class="p-4 space-y-3">
            <div class="flex items-start justify-between gap-2">
              <div class="flex items-center gap-2 text-sm flex-wrap">
                <span class="font-mono text-primary-400 break-words">{{
                  getColumnName(fk.sourceTableId, fk.sourceColumnId)
                }}</span>
                <svg
                  class="w-3 h-3 text-secondary-600 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M14 5l7 7m0 0l-7 7m7-7H3"
                  />
                </svg>
                <span class="text-secondary-400 font-mono break-words"
                  >{{ getTableName(fk.targetTableId) }}.</span
                ><span class="font-mono text-success-400 break-words">{{
                  getColumnName(fk.targetTableId, fk.targetColumnId)
                }}</span>
              </div>
              <div
                v-if="schemaStore.viewMode === 'full'"
                class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
              >
                <!-- Edit -->
                <button
                  class="text-secondary-500 hover:text-primary-400 transition-colors p-1 rounded"
                  aria-label="Edit foreign key"
                  @click="startEdit(fk)"
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
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                    />
                  </svg>
                </button>
                <!-- Delete -->
                <button
                  class="text-secondary-500 hover:text-danger-500 transition-colors p-1 rounded"
                  aria-label="Delete foreign key"
                  @click="schemaStore.removeForeignKey(fk.id)"
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
            <div
              class="flex gap-4 text-[10px] font-bold uppercase tracking-wider"
            >
              <div
                class="flex items-center gap-1.5 px-2 py-1 bg-secondary-950 rounded border border-secondary-800 text-secondary-500"
              >
                ON DELETE:
                <span class="text-primary-500">{{ fk.onDelete }}</span>
              </div>
              <div
                class="flex items-center gap-1.5 px-2 py-1 bg-secondary-950 rounded border border-secondary-800 text-secondary-500"
              >
                ON UPDATE:
                <span class="text-primary-500">{{ fk.onUpdate }}</span>
              </div>
            </div>
          </div>
        </template>

        <!-- Edit mode -->
        <template v-else>
          <div class="p-4 space-y-4 bg-primary-500/5">
            <div class="flex items-center justify-between">
              <span
                class="text-[9px] font-bold text-primary-400 uppercase tracking-[0.15em]"
                >Editing Foreign Key</span
              >
              <button
                class="text-secondary-500 hover:text-secondary-300 transition-colors text-[10px] font-bold uppercase tracking-wider"
                @click="cancelEdit"
              >
                Cancel
              </button>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <!-- Source Column -->
              <div class="space-y-1.5">
                <label
                  class="text-[10px] font-bold text-secondary-300 uppercase ml-1"
                  >Source Column</label
                >
                <select
                  v-model="editFk.sourceColumnId"
                  class="w-full bg-secondary-950 border border-secondary-800 rounded-lg px-3 py-2 text-xs focus:border-primary-500 focus:outline-none text-secondary-200"
                >
                  <option value="" disabled>Select column</option>
                  <option
                    v-for="col in sourceColumns"
                    :key="col.id"
                    :value="col.id"
                  >
                    {{ col.name }}
                  </option>
                </select>
              </div>

              <!-- Target Table -->
              <div class="space-y-1.5">
                <label
                  class="text-[10px] font-bold text-secondary-300 uppercase ml-1"
                  >Target Table</label
                >
                <select
                  v-model="editFk.targetTableId"
                  class="w-full bg-secondary-950 border border-secondary-800 rounded-lg px-3 py-2 text-xs focus:border-primary-500 focus:outline-none text-secondary-200"
                >
                  <option value="" disabled>Select table</option>
                  <option v-for="t in targetTables" :key="t.id" :value="t.id">
                    {{ t.name }}
                  </option>
                </select>
              </div>
            </div>

            <!-- Target Column -->
            <div class="space-y-1.5">
              <label
                class="text-[10px] font-bold text-secondary-300 uppercase ml-1"
                >Target Reference (PK/Unique)</label
              >
              <select
                v-model="editFk.targetColumnId"
                :disabled="!editFk.targetTableId"
                class="w-full bg-secondary-950 border border-secondary-800 rounded-lg px-3 py-2 text-xs focus:border-primary-500 focus:outline-none text-secondary-200 disabled:opacity-30"
              >
                <option value="" disabled>Select target attribute</option>
                <option
                  v-for="col in editTargetColumns"
                  :key="col.id"
                  :value="col.id"
                >
                  {{ col.name }} ({{ col.isPrimaryKey ? "PK" : "UNQ" }})
                </option>
              </select>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div class="space-y-1.5">
                <label
                  class="text-[10px] font-bold text-secondary-300 uppercase ml-1"
                  >On Delete</label
                >
                <select
                  v-model="editFk.onDelete"
                  class="w-full bg-secondary-950 border border-secondary-800 rounded-lg px-3 py-2 text-[10px] focus:border-primary-500 focus:outline-none text-secondary-300"
                >
                  <option
                    v-for="action in actionOptions"
                    :key="action"
                    :value="action"
                  >
                    {{ action }}
                  </option>
                </select>
              </div>
              <div class="space-y-1.5">
                <label
                  class="text-[10px] font-bold text-secondary-300 uppercase ml-1"
                  >On Update</label
                >
                <select
                  v-model="editFk.onUpdate"
                  class="w-full bg-secondary-950 border border-secondary-800 rounded-lg px-3 py-2 text-[10px] focus:border-primary-500 focus:outline-none text-secondary-300"
                >
                  <option
                    v-for="action in actionOptions"
                    :key="action"
                    :value="action"
                  >
                    {{ action }}
                  </option>
                </select>
              </div>
            </div>

            <div class="flex gap-2">
              <button
                :disabled="
                  !editFk.sourceColumnId ||
                  !editFk.targetTableId ||
                  !editFk.targetColumnId
                "
                class="flex-1 flex items-center justify-center gap-2 p-3 bg-primary-600 hover:bg-primary-500 rounded-xl text-white text-xs font-bold transition-all disabled:opacity-20 shadow-lg active:scale-95"
                @click="commitEdit"
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
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                Save Changes
              </button>
              <button
                class="px-4 p-3 bg-secondary-800 hover:bg-secondary-700 rounded-xl text-secondary-300 text-xs font-bold transition-all active:scale-95"
                @click="cancelEdit"
              >
                Discard
              </button>
            </div>
          </div>
        </template>
      </div>
    </div>

    <!-- Incoming FKs (other tables -> this) -->
    <div class="space-y-2">
      <div class="flex items-center gap-2 py-1">
        <div class="h-px flex-1 bg-secondary-600" />
        <span
          class="text-[9px] font-bold text-secondary-500 uppercase tracking-[0.2em]"
          >Incoming References</span
        >
        <div class="h-px flex-1 bg-secondary-600" />
      </div>
      <p
        v-if="incomingFks.length === 0"
        class="text-[11px] text-secondary-500 italic px-1"
      >
        No other tables reference this table.
      </p>
      <div
        v-for="fk in incomingFks"
        :key="fk.id"
        class="bg-secondary-900/40 px-4 py-3 rounded-xl border border-secondary-800/50 flex items-center gap-2 text-sm"
      >
        <span class="font-mono text-secondary-400"
          >{{ getTableName(fk.sourceTableId) }}.</span
        ><span class="font-mono text-primary-400">{{
          getColumnName(fk.sourceTableId, fk.sourceColumnId)
        }}</span>
        <svg
          class="w-3 h-3 text-secondary-600 shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M14 5l7 7m0 0l-7 7m7-7H3"
          />
        </svg>
        <span class="font-mono text-success-400">{{
          getColumnName(fk.targetTableId, fk.targetColumnId)
        }}</span>
      </div>
    </div>

    <!-- New FK Form (edit mode only) -->
    <div v-if="schemaStore.viewMode === 'full'" class="space-y-4">
      <div class="flex items-center gap-2 py-1">
        <div class="h-px flex-1 bg-secondary-600" />
        <span
          class="text-[9px] font-bold text-secondary-500 uppercase tracking-[0.2em]"
          >Establish Link</span
        >
        <div class="h-px flex-1 bg-secondary-600" />
      </div>
      <h5 class="sr-only">Establish Link</h5>

      <div class="grid grid-cols-2 gap-3">
        <!-- Source Column -->
        <div class="space-y-1.5">
          <label class="text-[10px] font-bold text-secondary-300 uppercase ml-1"
            >Source Column</label
          >
          <select
            v-model="newFk.sourceColumnId"
            class="w-full bg-secondary-950 border border-secondary-800 rounded-lg px-3 py-2 text-xs focus:border-primary-500 focus:outline-none text-secondary-200"
          >
            <option value="" disabled>Select column</option>
            <option v-for="col in sourceColumns" :key="col.id" :value="col.id">
              {{ col.name }}
            </option>
          </select>
        </div>

        <!-- Target Table -->
        <div class="space-y-1.5">
          <label class="text-[10px] font-bold text-secondary-300 uppercase ml-1"
            >Target Table</label
          >
          <select
            v-model="newFk.targetTableId"
            class="w-full bg-secondary-950 border border-secondary-800 rounded-lg px-3 py-2 text-xs focus:border-primary-500 focus:outline-none text-secondary-200"
            @change="newFk.targetColumnId = ''"
          >
            <option value="" disabled>Select table</option>
            <option v-for="t in targetTables" :key="t.id" :value="t.id">
              {{ t.name }}
            </option>
          </select>
        </div>
      </div>

      <!-- Target Column (Only PK/Unique) -->
      <div class="space-y-1.5">
        <label class="text-[10px] font-bold text-secondary-300 uppercase ml-1"
          >Target Reference (PK/Unique)</label
        >
        <select
          v-model="newFk.targetColumnId"
          :disabled="!newFk.targetTableId"
          class="w-full bg-secondary-950 border border-secondary-800 rounded-lg px-3 py-2 text-xs focus:border-primary-500 focus:outline-none text-secondary-200 disabled:opacity-30"
        >
          <option value="" disabled>Select target attribute</option>
          <option v-for="col in targetColumns" :key="col.id" :value="col.id">
            {{ col.name }} ({{ col.isPrimaryKey ? "PK" : "UNQ" }})
          </option>
        </select>
      </div>

      <div class="grid grid-cols-2 gap-3">
        <div class="space-y-1.5">
          <label class="text-[10px] font-bold text-secondary-300 uppercase ml-1"
            >On Delete</label
          >
          <select
            v-model="newFk.onDelete"
            class="w-full bg-secondary-950 border border-secondary-800 rounded-lg px-3 py-2 text-[10px] focus:border-primary-500 focus:outline-none text-secondary-300"
          >
            <option
              v-for="action in actionOptions"
              :key="action"
              :value="action"
            >
              {{ action }}
            </option>
          </select>
        </div>
        <div class="space-y-1.5">
          <label class="text-[10px] font-bold text-secondary-300 uppercase ml-1"
            >On Update</label
          >
          <select
            v-model="newFk.onUpdate"
            class="w-full bg-secondary-950 border border-secondary-800 rounded-lg px-3 py-2 text-[10px] focus:border-primary-500 focus:outline-none text-secondary-300"
          >
            <option
              v-for="action in actionOptions"
              :key="action"
              :value="action"
            >
              {{ action }}
            </option>
          </select>
        </div>
      </div>

      <button
        :disabled="
          !newFk.sourceColumnId ||
          !newFk.targetTableId ||
          !newFk.targetColumnId
        "
        class="w-full flex items-center justify-center gap-2 p-3 bg-secondary-800 hover:bg-primary-600 rounded-xl text-secondary-50 hover:text-white text-xs font-bold transition-all disabled:opacity-20 shadow-lg group active:scale-95"
        @click="addFk"
      >
        <svg
          class="w-4 h-4 group-hover:rotate-12 transition-transform"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101"
          />
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M14.828 14.828a4 4 0 015.656 0l4 4a4 4 0 01-5.656 5.656l-1.102-1.101"
          />
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M14.828 9.172a4 4 0 010 5.656L10.172 19.44a4 4 0 01-5.656 0 4 4 0 010-5.656l4.656-4.656a4 4 0 015.656 0"
          />
        </svg>
        Link Attributes
      </button>
    </div>
  </div>
</template>
