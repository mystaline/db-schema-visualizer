<script setup lang="ts">
import TableList from './TableList.vue'
import { useSchemaStore } from '../stores/schemaStore'
import { useCreateTableModal } from '../composables/useCreateTableModal'

const schemaStore = useSchemaStore()
const { open: openCreateTableModal } = useCreateTableModal()
</script>

<template>
  <aside class="flex flex-col h-full bg-secondary-900 border-r border-secondary-600">
    <div class="p-6 border-b border-secondary-600 bg-secondary-950">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-[10px] font-bold uppercase tracking-[0.2em] text-secondary-300">
          System Entities
        </h2>
        <span class="text-[10px] text-primary-400 font-mono px-1.5 py-0.5 bg-primary-400/10 border border-primary-400/20 rounded">
          TBL-{{ schemaStore.tables.length.toString().padStart(3, '0') }}
        </span>
      </div>
      <div class="relative group">
        <input
          type="text"
          placeholder="Search entities..."
          class="w-full bg-secondary-950 border border-secondary-800 rounded-xl px-4 py-2.5 text-sm focus:border-primary-500 focus:outline-none transition-all placeholder:text-secondary-500 focus:ring-4 focus:ring-primary-500/10"
        >
        <div class="absolute right-3 top-2.5 text-secondary-800 text-[10px] font-mono group-focus-within:text-primary-500 transition-colors">
          /
        </div>
      </div>
    </div>

    <!-- Table List Area -->
    <TableList />

    <!-- New Table Button -->
    <div v-if="schemaStore.viewMode === 'full'" class="p-4 border-t border-secondary-600 bg-secondary-950">
      <button
        class="w-full flex items-center justify-center gap-2 p-3 border border-primary-500/30 bg-primary-500/5 hover:bg-primary-500 hover:border-primary-500 active:scale-95 rounded-xl text-primary-400 hover:text-white text-sm font-bold transition-all group shadow-sm"
        @click="openCreateTableModal(true)"
      >
        <svg
          class="w-5 h-5 group-hover:scale-110 transition-transform"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
        New Entity
      </button>
    </div>
  </aside>
</template>
