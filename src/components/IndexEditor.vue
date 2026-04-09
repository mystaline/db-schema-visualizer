<script setup lang="ts">
import { ref, watch, computed } from "vue";
import { useSchemaStore, type IndexColumn } from "../stores/schemaStore";

const schemaStore = useSchemaStore();
const newIndex = ref({
  name: "",
  type: "normal" as "unique" | "normal",
  columns: [] as IndexColumn[],
  expressions: [] as string[],
  filter: "",
});
const newExpression = ref("");

// Auto-generate index name
watch(
  () => [newIndex.value.columns, newIndex.value.expressions, newIndex.value.type],
  () => {
    if (schemaStore.selectedTable) {
      const colNames = newIndex.value.columns
        .map((c) => schemaStore.selectedTable?.columns.find((col) => col.id === c.columnId)?.name)
        .filter(Boolean);
      const exprNames = newIndex.value.expressions.map((e) => e.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 15));
      const allNames = [...colNames, ...exprNames].join("_");

      if (allNames) {
        const prefix = newIndex.value.type === "unique" ? "unq" : "idx";
        newIndex.value.name = `${prefix}_${schemaStore.selectedTable.name}_${allNames}`;
        return;
      }

      newIndex.value.name = "";
    }
  },
  { deep: true },
);

const addIndex = () => {
  if (
    !schemaStore.selectedTableId ||
    !newIndex.value.name ||
    (newIndex.value.columns.length === 0 && newIndex.value.expressions.length === 0)
  )
    return;

  schemaStore.addIndex(schemaStore.selectedTableId, {
    name: newIndex.value.name,
    type: newIndex.value.type,
    columns: [...newIndex.value.columns],
    expressions: [...newIndex.value.expressions],
    filter: newIndex.value.filter,
  });

  newIndex.value = { name: "", type: "normal", columns: [], expressions: [], filter: "" };
};

const IDENTIFIER_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

const indexNameError = computed(() => {
  const name = newIndex.value.name.trim();
  if (!name) return null;
  if (!IDENTIFIER_RE.test(name)) return "Only letters, digits, underscores. Cannot start with a digit.";
  const duplicate = schemaStore.selectedTable?.indexes.some(
    (i) => i.name.toLowerCase() === name.toLowerCase()
  );
  if (duplicate) return `Index "${name}" already exists on this table.`;
  return null;
});

const toggleColumn = (id: string) => {
  const idx = newIndex.value.columns.findIndex((c) => c.columnId === id);
  if (idx === -1) {
    newIndex.value.columns.push({ columnId: id, order: "ASC" });
  } else {
    newIndex.value.columns.splice(idx, 1);
  }
};

const toggleColumnOrder = (id: string) => {
  const col = newIndex.value.columns.find((c) => c.columnId === id);
  if (col) col.order = col.order === "ASC" ? "DESC" : "ASC";
};

const addExpression = () => {
  const expr = newExpression.value.trim();
  if (expr) {
    newIndex.value.expressions.push(expr);
    newExpression.value = "";
  }
};

const removeExpression = (idx: number) => {
  newIndex.value.expressions.splice(idx, 1);
};

const getColumnName = (id: string) =>
  schemaStore.selectedTable?.columns.find((c) => c.id === id)?.name || id;
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h4
        class="text-xs font-bold text-secondary-400 uppercase tracking-widest"
      >
        Optimizers (Indexes)
      </h4>
      <span class="text-xs text-secondary-400 font-medium">DEFINED: {{ schemaStore.selectedTable?.indexes.length }}</span>
    </div>

    <!-- List Existing Indexes -->
    <div class="space-y-2">
      <p
        v-if="!schemaStore.selectedTable?.indexes.length"
        class="text-[11px] text-secondary-500 italic px-1"
      >
        No indexes defined on this table.
      </p>
      <div
        v-for="idx in schemaStore.selectedTable?.indexes"
        :key="idx.id"
        class="bg-secondary-900/40 p-4 rounded-xl border border-secondary-800/50 group"
      >
        <div class="flex items-center justify-between mb-2">
          <div class="flex items-center gap-2">
            <span class="text-sm font-bold text-secondary-200">{{
              idx.name
            }}</span>
            <span
              class="px-2 py-0.5 text-[10px] font-mono bg-secondary-950 border border-secondary-800 rounded text-primary-400"
            >
              {{ idx.type.toUpperCase() }}
            </span>
          </div>
          <button
            v-if="schemaStore.viewMode === 'full'"
            class="text-secondary-600 hover:text-danger-500 opacity-0 group-hover:opacity-100 transition-all"
            @click="
              schemaStore.removeIndex(schemaStore.selectedTableId!, idx.id)
            "
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
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
        </div>
        <div class="flex flex-wrap gap-1.5">
          <span
            v-for="col in (idx.columns ?? [])"
            :key="col.columnId"
            class="text-[10px] font-mono bg-secondary-800 px-2 py-0.5 rounded text-secondary-400"
          >
            {{ getColumnName(col.columnId) }}<span
              v-if="col.order === 'DESC'"
              class="text-primary-400 ml-0.5"
            >DESC</span>
          </span>
          <span
            v-for="(expr, i) in (idx.expressions ?? [])"
            :key="'expr-' + i"
            class="text-[10px] font-mono bg-primary-500/10 border border-primary-500/20 px-2 py-0.5 rounded text-primary-400 italic"
          >
            {{ expr }}
          </span>
        </div>
        <div
          v-if="idx.filter"
          class="mt-2 pt-2 border-t border-secondary-800/50 text-[10px] font-mono text-secondary-400 italic"
        >
          WHERE: {{ idx.filter }}
        </div>
      </div>
    </div>

    <!-- New Index Form (edit mode only) -->
    <div
      v-if="schemaStore.viewMode === 'full'"
      class="space-y-4"
    >
      <div class="flex items-center gap-2 py-1">
        <div class="h-px flex-1 bg-secondary-600" />
        <span class="text-[9px] font-bold text-secondary-500 uppercase tracking-[0.2em]">Register Index</span>
        <div class="h-px flex-1 bg-secondary-600" />
      </div>

      <div class="space-y-1.5">
        <label class="text-[10px] font-bold text-secondary-300 uppercase ml-1">Index Name</label>
        <input
          :value="newIndex.name"
          type="text"
          class="w-full bg-secondary-950 border rounded-lg px-3 py-2 text-xs focus:outline-none transition-colors"
          :class="indexNameError
            ? 'border-danger-500/70 text-danger-400 focus:border-danger-500'
            : 'border-secondary-800 text-secondary-200 focus:border-primary-500'"
          @input="(e) => {
            let v = (e.target as HTMLInputElement).value.replace(/[^a-zA-Z0-9_]/g, '')
            if (v && /^\d/.test(v)) v = '_' + v
            newIndex.name = v;
            (e.target as HTMLInputElement).value = v
          }"
        >
        <p
          v-if="indexNameError"
          class="text-[10px] text-danger-400 ml-1"
        >
          {{ indexNameError }}
        </p>
      </div>

      <div class="space-y-1.5">
        <div class="flex items-center justify-between">
          <label class="text-[10px] font-bold text-secondary-300 uppercase ml-1">Columns</label>
          <label class="text-[10px] text-secondary-500 ml-1 flex items-center gap-1.5">
            <input
              v-model="newIndex.type"
              type="checkbox"
              true-value="unique"
              false-value="normal"
              class="w-3.5 h-3.5 rounded border-secondary-800 text-primary-500 accent-primary-500"
            >
            Unique
          </label>
        </div>
        <div
          class="flex flex-wrap gap-1.5 p-2 bg-secondary-950 border border-secondary-800 rounded-lg min-h-[40px]"
        >
          <button
            v-for="col in schemaStore.selectedTable?.columns"
            :key="col.id"
            class="px-2 py-1 rounded text-[10px] font-bold transition-all flex items-center gap-1"
            :class="
              newIndex.columns.some((c) => c.columnId === col.id)
                ? 'bg-primary-500 text-white'
                : 'bg-secondary-800 text-secondary-400 hover:text-secondary-200'
            "
            @click="toggleColumn(col.id)"
          >
            {{ col.name }}
            <span
              v-if="newIndex.columns.some((c) => c.columnId === col.id)"
              class="text-[8px] opacity-70 cursor-pointer"
              @click.stop="toggleColumnOrder(col.id)"
            >{{ newIndex.columns.find((c) => c.columnId === col.id)?.order }}</span>
          </button>
        </div>
      </div>

      <div class="space-y-1.5">
        <label class="text-[10px] font-bold text-secondary-300 uppercase ml-1">Expressions</label>
        <div class="flex gap-1.5">
          <input
            v-model="newExpression"
            type="text"
            placeholder="e.g. lower(name), date_trunc('day', created_at)"
            class="flex-1 bg-secondary-950 border border-secondary-800 rounded-lg px-3 py-1.5 text-[10px] focus:border-primary-500 focus:outline-none text-secondary-200 font-mono"
            @keydown.enter="addExpression"
          >
          <button
            :disabled="!newExpression.trim()"
            class="px-3 py-1.5 bg-secondary-800 hover:bg-primary-600 rounded-lg text-[10px] font-bold text-secondary-300 hover:text-white transition-all disabled:opacity-20"
            @click="addExpression"
          >
            +
          </button>
        </div>
        <div
          v-if="newIndex.expressions.length"
          class="flex flex-wrap gap-1.5"
        >
          <span
            v-for="(expr, i) in newIndex.expressions"
            :key="i"
            class="text-[10px] font-mono bg-primary-500/10 border border-primary-500/20 px-2 py-0.5 rounded text-primary-400 italic flex items-center gap-1"
          >
            {{ expr }}
            <button
              class="text-danger-400 hover:text-danger-300"
              @click="removeExpression(i)"
            >&times;</button>
          </span>
        </div>
      </div>

      <div class="space-y-1.5">
        <label class="text-[10px] font-bold text-secondary-300 uppercase ml-1">Partial Filter (WHERE)</label>
        <input
          v-model="newIndex.filter"
          type="text"
          placeholder="e.g. status = 'active'"
          class="w-full bg-secondary-950 border border-secondary-800 rounded-lg px-3 py-2 text-[10px] focus:border-primary-500 focus:outline-none text-secondary-200 italic"
        >
      </div>

      <button
        :disabled="(newIndex.columns.length === 0 && newIndex.expressions.length === 0) || !newIndex.name || !!indexNameError"
        class="w-full flex items-center justify-center gap-2 p-3 bg-secondary-800 hover:bg-success-600 rounded-xl text-secondary-50 hover:text-white text-xs font-bold transition-all disabled:opacity-20 shadow-lg group active:scale-95"
        @click="addIndex"
      >
        <svg
          class="w-4 h-4 group-hover:scale-125 transition-transform"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        Register Optimizer
      </button>
    </div>
  </div>
</template>
