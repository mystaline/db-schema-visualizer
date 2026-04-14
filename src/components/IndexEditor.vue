<script setup lang="ts">
import { ref, watch, computed } from "vue";
import { useSchemaStore, type IndexPart } from "../stores/schemaStore";

const schemaStore = useSchemaStore();
const newIndex = ref({
  name: "",
  type: "normal" as "unique" | "normal",
  parts: [] as IndexPart[],
  filter: "",
});
const newExpression = ref("");

// Auto-generate index name
watch(
  () => [newIndex.value.parts, newIndex.value.type],
  () => {
    if (schemaStore.selectedTable) {
      const generatedName = schemaStore.getIndexName(schemaStore.selectedTable, {
        type: newIndex.value.type,
        parts: newIndex.value.parts,
        filter: newIndex.value.filter,
      });

      if (newIndex.value.parts.length > 0) {
        newIndex.value.name = generatedName;
      } else {
        newIndex.value.name = "";
      }
    }
  },
  { deep: true },
);

const addIndex = () => {
  if (
    !schemaStore.selectedTableId ||
    !newIndex.value.name ||
    newIndex.value.parts.length === 0
  )
    return;

  schemaStore.addIndex(schemaStore.selectedTableId, {
    name: newIndex.value.name,
    type: newIndex.value.type,
    parts: [...newIndex.value.parts],
    filter: newIndex.value.filter,
  });

  newIndex.value = { name: "", type: "normal", parts: [], filter: "" };
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
  const idx = newIndex.value.parts.findIndex((p) => p.type === "column" && p.value === id);
  if (idx === -1) {
    newIndex.value.parts.push({ type: "column", value: id, order: "ASC" });
  } else {
    newIndex.value.parts.splice(idx, 1);
  }
};

const toggleOrder = (index: number) => {
  const part = newIndex.value.parts[index];
  if (part) part.order = part.order === "ASC" ? "DESC" : "ASC";
};

const addExpression = () => {
  const expr = newExpression.value.trim();
  if (expr) {
    newIndex.value.parts.push({ type: "expression", value: expr, order: "ASC" });
    newExpression.value = "";
  }
};

const removePart = (idx: number) => {
  newIndex.value.parts.splice(idx, 1);
};

const injectColumn = (colName: string) => {
  newExpression.value += colName;
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
        <div class="flex items-start justify-between gap-2 mb-2">
          <div class="flex flex-wrap items-start gap-2 flex-1 min-w-0">
            <span class="text-sm font-bold text-secondary-200 break-words w-full">{{
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
            class="text-secondary-600 hover:text-danger-500 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
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
            v-for="(part, i) in (idx.parts ?? [])"
            :key="i"
            class="text-[10px] font-mono px-2 py-0.5 rounded flex items-center gap-1"
            :class="part.type === 'column' ? 'bg-secondary-800 text-secondary-400' : 'bg-primary-500/10 border border-primary-500/20 text-primary-400 italic'"
          >
            {{ part.type === 'column' ? getColumnName(part.value) : part.value }}
            <span v-if="part.order === 'DESC'" class="text-[8px] font-bold text-primary-400">DESC</span>
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
          class="w-full bg-secondary-950 border rounded-lg px-3 py-2 text-xs focus:outline-none transition-colors font-mono"
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
          class="text-[10px] text-danger-500 ml-1"
        >
          {{ indexNameError }}
        </p>
      </div>

      <div class="space-y-1.5">
        <div class="flex items-center justify-between">
          <label class="text-[10px] font-bold text-secondary-300 uppercase ml-1">Index Parts (Columns/Exprs)</label>
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

        <!-- Selected Parts -->
        <div
          class="space-y-1.5 p-3 bg-secondary-950 border border-secondary-800 rounded-xl min-h-[50px] flex flex-col gap-2"
        >
          <div v-if="!newIndex.parts.length" class="text-[10px] text-secondary-600 italic">Select columns or add expressions below...</div>
          <div
            v-for="(part, i) in newIndex.parts"
            :key="i"
            class="flex items-center justify-between bg-secondary-900 border border-secondary-800 p-2 rounded-lg group animate-in fade-in slide-in-from-left-2"
          >
            <div class="flex items-center gap-2 overflow-hidden">
               <span class="text-[9px] font-bold text-secondary-500 opacity-50">{{ i + 1 }}</span>
               <span 
                class="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase transition-colors"
                :class="part.type === 'column' ? 'bg-primary-500/20 text-primary-400' : 'bg-success-500/20 text-success-400'"
               >
                 {{ part.type }}
               </span>
               <span class="text-[10px] font-mono text-secondary-200 truncate" :title="part.type === 'column' ? getColumnName(part.value) : part.value">
                 {{ part.type === 'column' ? getColumnName(part.value) : part.value }}
               </span>
            </div>
            <div class="flex items-center gap-2 shrink-0">
               <button 
                class="px-1.5 py-0.5 rounded bg-secondary-800 text-[8px] font-bold text-secondary-400 hover:text-white transition-colors"
                @click="toggleOrder(i)"
               >
                 {{ part.order }}
               </button>
               <button 
                class="text-secondary-600 hover:text-danger-500 transition-colors"
                @click="removePart(i)"
               >
                 <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
               </button>
            </div>
          </div>
        </div>

        <!-- Column Selector -->
        <div class="flex flex-wrap gap-1.5 pt-1">
          <button
            v-for="col in schemaStore.selectedTable?.columns"
            :key="col.id"
            class="px-2 py-1 rounded text-[10px] font-bold transition-all border border-transparent"
            :class="
              newIndex.parts.some((p) => p.type === 'column' && p.value === col.id)
                ? 'bg-primary-500 text-white border-primary-400'
                : 'bg-secondary-800 text-secondary-400 hover:bg-secondary-700'
            "
            @click="toggleColumn(col.id)"
          >
            + {{ col.name }}
          </button>
        </div>
      </div>

      <div class="space-y-1.5">
        <label class="text-[10px] font-bold text-secondary-300 uppercase ml-1">New Expression</label>
        <div class="flex gap-1.5">
          <input
            v-model="newExpression"
            type="text"
            placeholder="e.g. lower(email)"
            class="flex-1 bg-secondary-950 border border-secondary-800 rounded-lg px-3 py-1.5 text-[10px] focus:border-primary-500 focus:outline-none text-secondary-200 font-mono"
            @keydown.enter="addExpression"
          >
          <button
            :disabled="!newExpression.trim()"
            class="px-3 py-1.5 bg-secondary-800 hover:bg-success-600 rounded-lg text-[10px] font-bold text-secondary-300 hover:text-white transition-all disabled:opacity-20"
            @click="addExpression"
          >
            ADD EXPR
          </button>
        </div>
        
        <!-- Injector -->
        <div class="flex flex-wrap gap-1 mt-1 opacity-70">
           <span class="text-[9px] text-secondary-500 flex items-center mr-1">Tap to inject:</span>
           <button 
             v-for="col in schemaStore.selectedTable?.columns" 
             :key="'inj-'+col.id"
             class="px-1.5 py-0.5 rounded bg-secondary-900 border border-secondary-800 text-[9px] text-secondary-400 hover:bg-secondary-800 hover:text-secondary-200"
             @click="injectColumn(col.name)"
           >
             {{ col.name }}
           </button>
        </div>
      </div>

      <div class="space-y-1.5">
        <label class="text-[10px] font-bold text-secondary-300 uppercase ml-1">Partial Filter (WHERE)</label>
        <input
          v-model="newIndex.filter"
          type="text"
          placeholder="e.g. deleted_at IS NULL"
          class="w-full bg-secondary-950 border border-secondary-800 rounded-lg px-3 py-2 text-[10px] focus:border-primary-500 focus:outline-none text-secondary-200 italic font-mono"
        >
      </div>

      <button
        :disabled="newIndex.parts.length === 0 || !newIndex.name || !!indexNameError"
        class="w-full flex items-center justify-center gap-2 p-3 bg-linear-to-r from-success-600 to-success-700 hover:from-success-500 hover:to-success-600 rounded-xl text-white text-xs font-bold transition-all disabled:opacity-20 shadow-lg group active:scale-95 mt-2"
        @click="addIndex"
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
            d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
          />
        </svg>
        Register Index Optimizer
      </button>
    </div>
  </div>
</template>
