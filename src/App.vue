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
const leftCollapsed = ref(false);
const rightCollapsed = ref(false);

const onKeyDown = (e: KeyboardEvent) => {
  const tag = (e.target as HTMLElement)?.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

  const mod = e.ctrlKey || e.metaKey;
  if (!mod) return;

  if (
    e.key === "y" ||
    (e.key === "z" && e.shiftKey) ||
    (e.key === "Z" && e.shiftKey)
  ) {
    e.preventDefault();
    redo();
  } else if (e.key === "z" && !e.shiftKey) {
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

  const isEmbed = new URLSearchParams(window.location.search).has("embed");
  if (isEmbed) {
    schemaStore.loadPreset("blog");
    return;
  }

  const stored = localStorage.getItem(VERSION_STORAGE_KEY);
  if (stored !== APP_VERSION) {
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

      <!-- Left Sidebar (full mode + desktop only) -->
      <div
        v-if="schemaStore.viewMode === 'full'"
        class="hidden lg:flex flex-none border-r border-secondary-600 bg-secondary-900/50 backdrop-blur-sm z-20 overflow-hidden transition-[width] duration-200"
        :class="leftCollapsed ? 'w-0 border-r-0' : 'w-72'"
      >
        <Sidebar class="w-72 flex-none" />
      </div>

      <!-- Main Canvas Area -->
      <main
        class="flex-1 relative bg-secondary-900 overflow-hidden z-10"
        @click.self="schemaStore.selectedTableId = null"
      >
        <SchemaCanvas />

        <!-- Left collapse toggle (desktop only) -->
        <button
          v-if="schemaStore.viewMode === 'full'"
          class="hidden lg:flex absolute top-1/2 -translate-y-1/2 left-0 z-25 items-center justify-center w-4 h-12 bg-secondary-800 hover:bg-primary-600 border border-secondary-700 hover:border-primary-500 rounded-r-lg text-secondary-400 hover:text-white transition-all cursor-pointer"
          @click="leftCollapsed = !leftCollapsed"
          :title="leftCollapsed ? 'Expand sidebar' : 'Collapse sidebar'"
        >
          <svg
            class="w-3 h-3 transition-transform"
            :class="leftCollapsed ? 'rotate-0' : 'rotate-180'"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2.5"
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>

        <!-- Right collapse toggle (desktop only) -->
        <button
          class="hidden lg:flex absolute top-1/2 -translate-y-1/2 right-0 z-25 items-center justify-center w-4 h-12 bg-secondary-800 hover:bg-primary-600 border border-secondary-700 hover:border-primary-500 rounded-l-lg text-secondary-400 hover:text-white transition-all cursor-pointer"
          @click="rightCollapsed = !rightCollapsed"
          :title="rightCollapsed ? 'Expand panel' : 'Collapse panel'"
        >
          <svg
            class="w-3 h-3 transition-transform"
            :class="rightCollapsed ? 'rotate-180' : 'rotate-0'"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2.5"
              d="M9 5l7 7-7 7"
            />
          </svg>
        </button>
      </main>

      <!-- Right Detail Panel (desktop only) -->
      <div
        class="hidden lg:flex flex-none border-l border-secondary-600 bg-secondary-900/80 backdrop-blur-md z-20 overflow-hidden transition-[width] duration-200"
        :class="rightCollapsed ? 'w-0 border-l-0' : 'w-96'"
      >
        <DetailPanel class="w-96 flex-none" />
      </div>

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
