<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import { useSchemaStore } from "./stores/schemaStore";
import { useHistory } from "./composables/useHistory";
import { APP_VERSION, VERSION_STORAGE_KEY } from "./version";
import TopBar from "./components/TopBar.vue";
import Sidebar from "./components/Sidebar.vue";
import SchemaCanvas from "./components/SchemaCanvas.vue";
import DetailPanel from "./components/DetailPanel.vue";
import MobileSelectedTableUI from "./components/MobileSelectedTableUI.vue";
import ToastContainer from "./components/ToastContainer.vue";
import WhatsNewModal from "./components/WhatsNewModal.vue";
import CreateTableModal from "./components/CreateTableModal.vue";

const schemaStore = useSchemaStore();
const { undo, redo } = useHistory();

const showWhatsNew = ref(false);

const onKeyDown = (e: KeyboardEvent) => {
  // Skip if user is typing in an input/textarea
  const tag = (e.target as HTMLElement)?.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

  const mod = e.ctrlKey || e.metaKey;
  if (!mod) return;

  // Redo: Ctrl+Y or Ctrl+Shift+Z (check first — more specific)
  if (
    e.key === "y" ||
    (e.key === "z" && e.shiftKey) ||
    (e.key === "Z" && e.shiftKey)
  ) {
    e.preventDefault();
    redo();
  }
  // Undo: Ctrl+Z (without Shift)
  else if (e.key === "z" && !e.shiftKey) {
    e.preventDefault();
    undo();
  }
};

const dismissWhatsNew = () => {
  showWhatsNew.value = false;
  localStorage.setItem(VERSION_STORAGE_KEY, APP_VERSION);
};

onMounted(() => {
  document.addEventListener("keydown", onKeyDown);

  // Version check — show What's New if first visit or version changed
  const stored = localStorage.getItem(VERSION_STORAGE_KEY);
  if (stored !== APP_VERSION) {
    // Small delay so the app renders first before the modal pops in
    setTimeout(() => {
      showWhatsNew.value = true;
    }, 400);
  }
});

onUnmounted(() => document.removeEventListener("keydown", onKeyDown));
</script>

<template>
  <div
    class="fixed inset-0 flex flex-col h-screen overflow-hidden text-secondary-50"
  >
    <!-- Top Bar -->
    <TopBar
      class="flex-none h-16 border-b border-secondary-800 bg-secondary-900/80 backdrop-blur-md z-30"
      @open-whats-new="showWhatsNew = true"
    />

    <div class="flex flex-1 min-h-0 overflow-hidden relative">
      <!-- Grain Overlay -->
      <div class="absolute inset-0 bg-grain pointer-events-none z-0" />

      <!-- Left Sidebar (hidden in read mode OR mobile) -->
      <Sidebar
        v-if="schemaStore.viewMode === 'full'"
        class="hidden lg:flex w-72 flex-none border-r border-secondary-600 bg-secondary-900/50 backdrop-blur-sm z-20"
      />

      <!-- Main Canvas Area -->
      <main
        class="flex-1 relative bg-secondary-900 overflow-hidden z-10"
        @click.self="schemaStore.selectedTableId = null"
      >
        <SchemaCanvas />
      </main>

      <!-- Right Detail Panel (hidden on mobile) -->
      <DetailPanel
        class="hidden lg:flex w-96 flex-none border-l border-secondary-600 bg-secondary-900/80 backdrop-blur-md z-20"
      />

      <!-- Mobile UI -->
      <MobileSelectedTableUI class="lg:hidden" />
    </div>

    <!-- Global Toast Notifications -->
    <ToastContainer />

    <!-- What's New modal, shown on first load or after a version change -->
    <WhatsNewModal :is-open="showWhatsNew" @close="dismissWhatsNew" />
    <CreateTableModal />
  </div>
</template>

<style>
/* Global styles if needed */
</style>
