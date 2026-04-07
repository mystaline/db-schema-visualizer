<script setup lang="ts">
import { useSchemaStore } from '../stores/schemaStore'

const schemaStore = useSchemaStore()

const selectTable = (id: string) => {
  schemaStore.selectedTableId = id
}

const deleteTable = (id: string, name: string) => {
  if (confirm(`Are you sure you want to delete table "${name}"? This cannot be undone.`)) {
    schemaStore.removeTable(id)
  }
}
</script>

<template>
  <div class="flex-1 overflow-y-auto p-4 space-y-2">
    <div 
      v-for="table in schemaStore.tables" 
      :key="table.id"
      class="flex items-center gap-3 p-3 rounded-xl cursor-pointer group transition-all duration-300 border"
      :class="[
        schemaStore.selectedTableId === table.id 
          ? 'bg-primary-500/10 border-primary-500/50 shadow-[0_0_15px_rgba(0,158,255,0.1)]' 
          : 'bg-secondary-800/30 border-secondary-800 hover:border-secondary-700 hover:bg-secondary-800/50'
      ]"
      @click="selectTable(table.id)"
    >
      <div 
        class="w-1.5 h-1.5 rounded-full transition-colors"
        :class="schemaStore.selectedTableId === table.id ? 'bg-primary-500 shadow-[0_0_8px_#009eff]' : 'bg-secondary-600 group-hover:bg-secondary-400'"
      />
      
      <span 
        class="text-sm font-medium transition-colors"
        :class="schemaStore.selectedTableId === table.id ? 'text-secondary-50' : 'text-secondary-300 group-hover:text-secondary-50'"
      >
        {{ table.name }}
      </span>

      <div class="ml-auto flex items-center gap-2">
        <span class="text-[10px] font-mono text-secondary-500 px-1.5 py-0.5 bg-secondary-900/50 rounded border border-secondary-800">
          {{ table.columns.length }}
        </span>
        <button 
          class="text-secondary-500 hover:text-danger-500 transition-colors p-1"
          @click.stop="deleteTable(table.id, table.name)"
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
    </div>

    <!-- Empty State -->
    <div
      v-if="schemaStore.tables.length === 0"
      class="py-12 px-4 text-center"
    >
      <div class="inline-flex items-center justify-center w-12 h-12 rounded-full bg-secondary-800/50 text-secondary-400 mb-4">
        <svg
          class="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24 font-bold"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"
          />
        </svg>
      </div>
      <p class="text-xs text-secondary-400 font-medium leading-relaxed">
        No tables found.<br>Define your first entity below.
      </p>
    </div>
  </div>
</template>
