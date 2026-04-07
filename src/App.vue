<script setup lang="ts">
import { useSchemaStore } from './stores/schemaStore'
import TopBar from './components/TopBar.vue'
import Sidebar from './components/Sidebar.vue'
import SchemaCanvas from './components/SchemaCanvas.vue'
import DetailPanel from './components/DetailPanel.vue'
import ToastContainer from './components/ToastContainer.vue'

const schemaStore = useSchemaStore()
</script>

<template>
  <div class="fixed inset-0 flex flex-col h-screen overflow-hidden text-secondary-50">
    <!-- Top Bar -->
    <TopBar class="flex-none h-16 border-b border-secondary-800 bg-secondary-900/80 backdrop-blur-md z-30" />

    <div class="flex flex-1 min-h-0 overflow-hidden relative">
      <!-- Grain Overlay -->
      <div class="absolute inset-0 bg-grain pointer-events-none z-0" />

      <!-- Left Sidebar (hidden in read mode) -->
      <Sidebar
        v-if="schemaStore.viewMode === 'full'"
        class="w-72 flex-none border-r border-secondary-600 bg-secondary-900/50 backdrop-blur-sm z-20"
      />

      <!-- Main Canvas Area -->
      <main class="flex-1 relative bg-secondary-900 overflow-hidden z-10">
        <SchemaCanvas />
      </main>

      <!-- Right Detail Panel (visible in both modes — editors self-disable in read mode) -->
      <DetailPanel
        class="w-96 flex-none border-l border-secondary-600 bg-secondary-900/80 backdrop-blur-md z-20"
      />
    </div>

    <!-- Global Toast Notifications -->
    <ToastContainer />
  </div>
</template>

<style>
/* Global styles if needed */
</style>
