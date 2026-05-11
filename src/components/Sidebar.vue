<script setup lang="ts">
import TableList from "./TableList.vue";
import { useSchemaStore } from "../stores/schemaStore";
import { useCreateTableModal } from "../composables/useCreateTableModal";

const schemaStore = useSchemaStore();
const { open: openCreateTableModal } = useCreateTableModal();
</script>

<template>
  <aside
    class="flex flex-col h-full bg-secondary-950 border-r border-secondary-700"
  >
    <div class="px-5 py-4 border-b border-secondary-700">
      <div class="flex items-center justify-between mb-3">
        <h2 class="text-xs font-semibold text-secondary-300">Tables</h2>
        <span
          class="text-xs font-medium text-secondary-400 px-2 py-0.5 bg-secondary-800 border border-secondary-700 rounded-md"
        >
          {{ schemaStore.tables.length }}
        </span>
      </div>
      <div class="relative group">
        <input
          type="text"
          placeholder="Search tables..."
          class="w-full bg-secondary-900 border border-secondary-700 rounded-lg px-3 py-2 text-sm focus:border-primary-500 focus:outline-none transition-all placeholder:text-secondary-500 focus:ring-2 focus:ring-primary-500/15"
        />
        <div
          class="absolute right-3 top-2 text-secondary-600 text-[10px] font-mono group-focus-within:text-primary-500 transition-colors"
        >
          ⌘K
        </div>
      </div>
    </div>

    <!-- Table List Area -->
    <TableList />

    <!-- New Table Button -->
    <div
      v-if="schemaStore.viewMode === 'full'"
      class="p-4 border-t border-secondary-700"
    >
      <button
        class="w-full flex items-center justify-center gap-2 py-2.5 border border-secondary-700 bg-secondary-900 hover:bg-secondary-800 hover:border-secondary-600 active:scale-95 rounded-lg text-secondary-300 hover:text-secondary-50 text-sm font-semibold transition-all group"
        @click="openCreateTableModal(true)"
      >
        <svg
          class="w-5 h-5 group-hover:scale-110 transition-transform"
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
        New Entity
      </button>
    </div>
  </aside>
</template>
