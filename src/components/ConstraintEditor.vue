<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useSchemaStore } from '../stores/schemaStore'

const schemaStore = useSchemaStore()
const newConstraint = ref({
  name: '',
  expression: ''
})

const IDENTIFIER_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

// Auto-generate constraint name
watch(
  () => [newConstraint.value.expression, schemaStore.selectedTable?.name],
  () => {
    if (schemaStore.selectedTable && newConstraint.value.expression.trim()) {
      // Create a snippet from the expression for the name (letters/numbers/underscores only)
      const snippet = newConstraint.value.expression
        .replace(/[^a-zA-Z0-9_]/g, "")
        .slice(0, 15)
        .toLowerCase();
      
      if (snippet) {
         newConstraint.value.name = `chk_${schemaStore.selectedTable.name}_${snippet}`;
      }
    } else {
      newConstraint.value.name = '';
    }
  }
);

const constraintNameError = computed(() => {
  const name = newConstraint.value.name.trim();
  if (!name) return null;
  if (!IDENTIFIER_RE.test(name)) return "Only letters, digits, underscores. Cannot start with a digit.";
  const duplicate = schemaStore.selectedTable?.checkConstraints.some(
    (c) => c.name.toLowerCase() === name.toLowerCase()
  );
  if (duplicate) return `Constraint "${name}" already exists on this table.`;
  return null;
});

const addConstraint = () => {
  if (!schemaStore.selectedTableId || !newConstraint.value.expression.trim() || !newConstraint.value.name || constraintNameError.value) return
  
  const table = schemaStore.tables.find(t => t.id === schemaStore.selectedTableId)
  if (table) {
    table.checkConstraints.push({
      id: crypto.randomUUID(),
      name: newConstraint.value.name.trim(),
      expression: newConstraint.value.expression.trim()
    })
    newConstraint.value = { name: '', expression: '' }
  }
}

const removeConstraint = (index: number) => {
  const table = schemaStore.tables.find(t => t.id === schemaStore.selectedTableId)
  if (table) {
    table.checkConstraints.splice(index, 1)
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h4 class="text-xs font-bold text-secondary-400 uppercase tracking-widest">
        Business Logic (CHECK)
      </h4>
      <span class="text-xs text-secondary-400 font-medium">DEFINED: {{ schemaStore.selectedTable?.checkConstraints.length }}</span>
    </div>

    <!-- Constraints List -->
    <div class="space-y-2">
      <p
        v-if="!schemaStore.selectedTable?.checkConstraints.length"
        class="text-[11px] text-secondary-500 italic px-1"
      >
        No check constraints defined on this table.
      </p>
      <div 
        v-for="(constraint, idx) in schemaStore.selectedTable?.checkConstraints" 
        :key="constraint.id"
        class="bg-secondary-900/40 p-4 rounded-xl border border-secondary-800/50 group space-y-2"
      >
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold text-secondary-200 font-mono">{{ constraint.name }}</span>
          <button
            v-if="schemaStore.viewMode === 'full'"
            class="text-secondary-600 hover:text-danger-500 opacity-0 group-hover:opacity-100 transition-all ml-2"
            @click="removeConstraint(idx)"
          >
            <svg
              class="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            ><path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1-1v3M4 7h16"
            /></svg>
          </button>
        </div>
        <div class="bg-secondary-950/50 p-2 rounded-lg border border-secondary-800/30">
          <p class="text-[10px] font-mono text-primary-400 italic leading-relaxed">
            CHECK ({{ constraint.expression }})
          </p>
        </div>
      </div>
    </div>

    <!-- New Constraint Form (edit mode only) -->
    <div
      v-if="schemaStore.viewMode === 'full'"
      class="space-y-4"
    >
      <div class="flex items-center gap-2 py-1">
        <div class="h-px flex-1 bg-secondary-600" />
        <span class="text-[9px] font-bold text-secondary-500 uppercase tracking-[0.2em]">Register Constraint</span>
        <div class="h-px flex-1 bg-secondary-600" />
      </div>

      <div class="space-y-1.5">
        <label class="text-[10px] font-bold text-secondary-300 uppercase ml-1">Constraint Name</label>
        <input
          v-model="newConstraint.name"
          type="text"
          class="w-full bg-secondary-950 border rounded-lg px-3 py-2 text-xs focus:outline-none transition-colors"
          :class="constraintNameError
            ? 'border-danger-500/70 text-danger-400 focus:border-danger-500'
            : 'border-secondary-800 text-secondary-200 focus:border-primary-500'"
          @input="(e) => {
            let v = (e.target as HTMLInputElement).value.replace(/[^a-zA-Z0-9_]/g, '')
            if (v && /^\d/.test(v)) v = '_' + v
            newConstraint.name = v;
            (e.target as HTMLInputElement).value = v
          }"
        >
        <p
          v-if="constraintNameError"
          class="text-[10px] text-danger-400 ml-1"
        >
          {{ constraintNameError }}
        </p>
      </div>
      
      <div class="space-y-1.5">
        <label class="text-[10px] font-bold text-secondary-300 uppercase ml-1">Condition Expression</label>
        <textarea 
          v-model="newConstraint.expression" 
          rows="3"
          placeholder="e.g. status IN ('draft', 'published') OR price > 0" 
          class="w-full bg-secondary-950 border border-secondary-800 rounded-lg px-3 py-2 text-[10px] font-mono focus:border-primary-500 focus:outline-none text-secondary-200 placeholder:text-secondary-500"
        />
      </div>

      <button 
        :disabled="!newConstraint.expression.trim() || !newConstraint.name || !!constraintNameError"
        class="w-full flex items-center justify-center gap-2 p-3 border border-secondary-800 bg-secondary-900/50 hover:bg-secondary-800 rounded-xl text-secondary-400 hover:text-secondary-50 text-xs font-bold transition-all disabled:opacity-20 shadow-lg group active:scale-95"
        @click="addConstraint"
      >
        <svg
          class="w-4 h-4 group-hover:rotate-12 transition-transform text-warning-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        ><path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
        /></svg>
        Lock Logic Integrity
      </button>
    </div>
  </div>
</template>
