<script setup lang="ts">
import { ref, computed } from "vue";
import { useSchemaStore } from "../stores/schemaStore";
import { useToast } from "../composables/useToast";
import ConfirmModal from "./ConfirmModal.vue";

const schemaStore = useSchemaStore();
const { toast } = useToast();

const selectTable = (id: string) => {
  schemaStore.selectedTableId = id;
};

const pendingDelete = ref<{ id: string; name: string } | null>(null);

const requestDelete = (id: string, name: string) => {
  pendingDelete.value = { id, name };
};

const confirmDelete = () => {
  if (pendingDelete.value) {
    try {
      schemaStore.removeTable(pendingDelete.value.id);
    } catch (e) {
      console.error("[TableList] removeTable threw unexpectedly", e);
      toast("Failed to delete the table. Please try again.", "error");
    }
  }
  pendingDelete.value = null;
};

const cancelDelete = () => {
  pendingDelete.value = null;
};

const deleteMessage = computed(() =>
  pendingDelete.value
    ? `'${pendingDelete.value.name}' and all its columns, indexes, and foreign keys will be permanently removed.`
    : "",
);
</script>

<template>
  <div class="flex-1 overflow-y-auto py-2 no-scrollbar">
    <div
      v-for="table in schemaStore.tables"
      :key="table.id"
      class="flex items-center gap-3 px-4 py-2 cursor-pointer group transition-colors"
      :class="[
        schemaStore.selectedTableId === table.id
          ? 'bg-primary-500/10 text-secondary-50'
          : 'hover:bg-secondary-800/50',
      ]"
      @click="selectTable(table.id)"
    >
      <div
        class="w-1.5 h-1.5 rounded-full shrink-0 transition-colors"
        :class="
          schemaStore.selectedTableId === table.id
            ? 'bg-primary-500'
            : 'bg-secondary-600 group-hover:bg-secondary-400'
        "
      />

      <span
        class="text-sm font-medium transition-colors truncate flex-1"
        :class="
          schemaStore.selectedTableId === table.id
            ? 'text-secondary-50'
            : 'text-secondary-300 group-hover:text-secondary-100'
        "
      >
        {{ table.name }}
      </span>

      <div class="ml-auto flex items-center gap-2 shrink-0">
        <span class="text-[10px] font-mono text-secondary-500">
          {{ table.columns.length }}
        </span>
        <button
          class="text-secondary-600 hover:text-danger-500 transition-colors p-1 opacity-0 group-hover:opacity-100"
          @click.stop="requestDelete(table.id, table.name)"
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
    <div v-if="schemaStore.tables.length === 0" class="py-12 px-4 text-center">
      <div
        class="inline-flex items-center justify-center w-12 h-12 rounded-full bg-secondary-800/50 text-secondary-400 mb-4"
      >
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
        No tables found.<br />Define your first entity below.
      </p>
    </div>
  </div>

  <ConfirmModal
    :is-open="!!pendingDelete"
    title="Delete Table"
    :message="deleteMessage"
    @confirm="confirmDelete"
    @cancel="cancelDelete"
  />
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
