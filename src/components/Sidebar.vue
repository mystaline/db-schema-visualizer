<script setup lang="ts">
import TableList from './TableList.vue'
import TableForm from './TableForm.vue'
import { useSchemaStore } from '../stores/schemaStore'

const schemaStore = useSchemaStore()
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

    <!-- Table Form at Bottom -->
    <TableForm />
  </aside>
</template>
