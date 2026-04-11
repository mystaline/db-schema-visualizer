<script setup lang="ts">
import { computed, ref } from "vue";
import { useSchemaStore } from "../stores/schemaStore";
import ColumnEditor from "./ColumnEditor.vue";
import ForeignKeyEditor from "./ForeignKeyEditor.vue";
import IndexEditor from "./IndexEditor.vue";
import ConstraintEditor from "./ConstraintEditor.vue";

const schemaStore = useSchemaStore();
const activeTab = ref<"none" | "columns" | "fk" | "index" | "constraint">("none");

const selectedTable = computed(() => 
  schemaStore.tables.find(t => t.id === schemaStore.selectedTableId)
);

const isConfirmingDelete = ref(false);

const handleDelete = () => {
  if (isConfirmingDelete.value) {
    if (selectedTable.value) {
      schemaStore.removeTable(selectedTable.value.id);
      activeTab.value = "none";
      isConfirmingDelete.value = false;
    }
  } else {
    isConfirmingDelete.value = true;
    // Auto-cancel after 3 seconds if not clicked
    setTimeout(() => {
      isConfirmingDelete.value = false;
    }, 3000);
  }
};

const closeSheet = () => {
  activeTab.value = "none";
};

const tabs = [
  { id: "columns", label: "Columns", icon: "M4 6h16M4 12h16M4 18h16" },
  { id: "fk", label: "Relations", icon: "M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4-4m-4 4l4 4" },
  { id: "index", label: "Indexes", icon: "M13 10V3L4 14h7v7l9-11h-7z" },
  { id: "constraint", label: "Checks", icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" },
];
</script>

<template>
  <div v-if="selectedTable" class="fixed inset-x-0 bottom-0 z-99902 pointer-events-none flex flex-col items-center">
    <!-- Blocking Backdrop -->
    <div 
      v-if="activeTab !== 'none'"
      class="fixed inset-0 bg-secondary-950/60 backdrop-blur-sm pointer-events-auto z-[-1]"
      @click="closeSheet"
    />
    
    <!-- Mobile Sheet -->
    <div 
      class="w-full max-w-2xl bg-secondary-900 border-t border-secondary-800 rounded-t-3xl shadow-[0_-20px_50px_rgba(0,0,0,0.5)] transition-transform duration-300 pointer-events-auto overflow-hidden flex flex-col"
      :class="activeTab === 'none' ? 'translate-y-full' : 'translate-y-0 h-[70vh]'"
    >
      <!-- Handle -->
      <div class="h-8 flex items-center justify-center shrink-0 cursor-pointer" @click="closeSheet">
        <div class="w-12 h-1.5 bg-secondary-700 rounded-full" />
      </div>

      <!-- Header -->
      <div class="px-6 py-2 border-b border-secondary-800 flex items-center justify-between shrink-0">
        <h3 class="text-sm font-bold text-secondary-50 font-mono uppercase tracking-widest">
          {{ selectedTable.name }} <span class="text-secondary-500 font-normal">/ {{ activeTab }}</span>
        </h3>
        <button @click="closeSheet" class="p-2 text-secondary-400 hover:text-white">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      <!-- Content -->
      <div class="flex-1 overflow-y-auto p-6 custom-scrollbar">
        <ColumnEditor v-if="activeTab === 'columns'" />
        <ForeignKeyEditor v-if="activeTab === 'fk'" />
        <IndexEditor v-if="activeTab === 'index'" />
        <ConstraintEditor v-if="activeTab === 'constraint'" />
      </div>
    </div>

    <!-- Bottom Nav Bar -->
    <div 
      class="mb-6 mx-4 w-[calc(100%-2rem)] max-w-md bg-secondary-900/90 backdrop-blur-xl border border-secondary-800 rounded-2xl shadow-2xl pointer-events-auto flex items-stretch p-1.5 transition-all"
      :class="activeTab !== 'none' ? 'opacity-0 scale-95 pointer-events-none' : 'opacity-100 scale-100'"
    >
      <button 
        v-for="tab in tabs" 
        :key="tab.id"
        class="flex-1 flex flex-col items-center justify-center gap-1 py-2 rounded-xl transition-all active:scale-90"
        :class="activeTab === tab.id ? 'bg-primary-500 text-white' : 'text-secondary-400 hover:bg-secondary-800'"
        @click="activeTab = tab.id as any"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="tab.icon" /></svg>
        <span class="text-[9px] font-bold uppercase tracking-tighter">{{ tab.label }}</span>
      </button>

      <div class="w-px bg-secondary-800 mx-1 self-stretch" />

      <button 
        class="flex-1 flex flex-col items-center justify-center gap-1 py-2 rounded-xl transition-all duration-300 active:scale-90"
        :class="isConfirmingDelete 
          ? 'bg-danger-500 text-white animate-pulse' 
          : 'text-danger-500 hover:bg-danger-500/10'"
        @click="handleDelete"
      >
        <svg class="w-5 h-5 font-bold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path v-if="!isConfirmingDelete" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          <path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <span class="text-[9px] font-bold uppercase tracking-tighter">{{ isConfirmingDelete ? 'Confirm' : 'Delete' }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.z-99902 { z-index: 99902; }
.custom-scrollbar::-webkit-scrollbar { width: 4px; }
.custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
.custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 10px; }
</style>
