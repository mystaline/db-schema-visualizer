<script setup lang="ts">
import { ref } from 'vue'
import { useSchemaStore } from '../stores/schemaStore'
import ColumnEditor from './ColumnEditor.vue'
import ForeignKeyEditor from './ForeignKeyEditor.vue'
import IndexEditor from './IndexEditor.vue'
import ConstraintEditor from './ConstraintEditor.vue'

const schemaStore = useSchemaStore()
const activeTab = ref('columns')

const tabs = [
  { id: 'columns', name: 'Columns' },
  { id: 'relations', name: 'Foreign Keys' },
  { id: 'indexes', name: 'Indexes' },
  { id: 'constraints', name: 'Constraints' }
]
</script>

<template>
  <section class="flex flex-col h-full bg-secondary-900 border-l border-secondary-800">
    <!-- Header -->
    <div class="px-6 py-4 border-b border-secondary-600 flex justify-between items-center bg-secondary-950">
      <div
        v-if="schemaStore.selectedTable"
        class="flex flex-col"
      >
        <h3 class="text-sm font-bold text-secondary-50 font-mono uppercase tracking-widest">
          {{ schemaStore.selectedTable.name }}
        </h3>
        <p class="text-[10px] text-secondary-400 font-medium">
          TABLE IDENTIFIER: {{ schemaStore.selectedTable.id.split('-')[0] }}
        </p>
      </div>
      <div v-else>
        <h3 class="text-sm font-bold uppercase tracking-widest text-secondary-400">
          Entity Details
        </h3>
      </div>
      <span
        v-if="schemaStore.selectedTable"
        class="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-primary-500/10 border border-primary-500/20 text-primary-400"
      >
        {{ schemaStore.selectedTable.columns.length }} COL
      </span>
    </div>

    <template v-if="schemaStore.selectedTable">
      <!-- Tabs Navigation -->
      <nav class="flex border-b border-secondary-600 text-xs font-bold uppercase tracking-wider overflow-x-auto no-scrollbar bg-secondary-950/50">
        <button 
          v-for="tab in tabs" 
          :key="tab.id"
          class="px-5 py-3 border-b-2 transition-all whitespace-nowrap"
          :class="[
            activeTab === tab.id 
              ? 'border-primary-500 text-primary-400 bg-primary-500/5' 
              : 'border-transparent text-secondary-400 hover:text-secondary-200 hover:bg-secondary-800/50'
          ]"
          @click="activeTab = tab.id"
        >
          {{ tab.name }}
        </button>
      </nav>

      <!-- Tab Content -->
      <div class="flex-1 overflow-y-auto no-scrollbar p-6 bg-secondary-950/20">
        <ColumnEditor v-if="activeTab === 'columns'" />
        <ForeignKeyEditor v-else-if="activeTab === 'relations'" />
        <IndexEditor v-else-if="activeTab === 'indexes'" />
        <ConstraintEditor v-else-if="activeTab === 'constraints'" />
      </div>
    </template>

    <div
      v-else
      class="flex-1 flex items-center justify-center p-12 text-center select-none"
    >
      <div class="space-y-6 max-w-xs animate-in fade-in zoom-in duration-700">
        <div class="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-secondary-800/30 border-2 border-dashed border-secondary-800 mb-8 opacity-40 shadow-inner">
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
          Select a table from the system entity list to architecturalize its structure, constraints, and relationships.
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
