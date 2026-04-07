<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useSchemaStore } from '../stores/schemaStore'
import TableNode from './TableNode.vue'
import RelationLines from './RelationLines.vue'

const schemaStore = useSchemaStore()
const transform = computed(() => schemaStore.canvasTransform)
const isPanning = ref(false)
const panOffset = ref({ x: 0, y: 0 })

// Hydrate from URL if present
const hydrateFromUrl = async () => {
  const hash = window.location.hash
  if (hash.startsWith('#data=')) {
    const base64 = hash.slice('#data='.length)
    await schemaStore.loadFromShareableData(base64)
  }
}

onMounted(() => {
  hydrateFromUrl()
})

const handleCanvasMouseDown = (e: MouseEvent) => {
  // If clicking on background, handle panning
  if (e.button === 0) { // Left click
    isPanning.value = true
    panOffset.value = {
      x: e.clientX - schemaStore.canvasTransform.x,
      y: e.clientY - schemaStore.canvasTransform.y
    }
  }
}

const handleCanvasMouseMove = (e: MouseEvent) => {
  if (isPanning.value) {
    schemaStore.canvasTransform.x = e.clientX - panOffset.value.x
    schemaStore.canvasTransform.y = e.clientY - panOffset.value.y
  }
}

const handleCanvasMouseUp = () => {
  isPanning.value = false
}

const handleWheel = (e: WheelEvent) => {
  e.preventDefault()
  const zoomFactor = 0.05
  const delta = e.deltaY > 0 ? -zoomFactor : zoomFactor
  const newScale = Math.min(Math.max(0.2, schemaStore.canvasTransform.scale + delta), 2)
  schemaStore.canvasTransform.scale = newScale
}

const zoomToFit = () => {
  schemaStore.canvasTransform = { x: 0, y: 0, scale: 1 }
}

const canvasStyle = computed(() => ({
  transform: `translate(${transform.value.x}px, ${transform.value.y}px) scale(${transform.value.scale})`,
  transformOrigin: '0 0'
}))
</script>

<template>
  <div 
    class="relative w-full h-full bg-secondary-950 overflow-hidden"
    @mousedown="handleCanvasMouseDown"
    @mousemove="handleCanvasMouseMove"
    @mouseup="handleCanvasMouseUp"
    @mouseleave="handleCanvasMouseUp"
    @wheel="handleWheel"
  >
    <!-- Dynamic Dot Grid — color via CSS var so it responds to light/dark theme -->
    <div
      class="absolute inset-0 z-0"
      :style="{
        backgroundImage: 'radial-gradient(circle at 1px 1px, var(--dot-color) 1px, transparent 0)',
        backgroundPosition: `${transform.x}px ${transform.y}px`,
        backgroundSize: `${40 * transform.scale}px ${40 * transform.scale}px`
      }"
    />
    
    <!-- Canvas Transform Layer -->
    <div 
      class="absolute inset-0 z-10 overflow-visible"
      :style="canvasStyle"
    >
      <!-- SVG Lines for Relations (Behind Tables) -->
      <RelationLines />

      <!-- Draggable Tables -->
      <TableNode 
        v-for="table in schemaStore.tables" 
        :key="table.id" 
        :table="table"
        :scale="transform.scale"
      />

      <!-- Center Logo if empty -->
      <div
        v-if="schemaStore.tables.length === 0"
        class="flex flex-col items-center gap-6 opacity-20 transform -rotate-12 transition-all"
      >
        <div class="text-secondary-400 text-6xl font-black uppercase tracking-tighter">
          Ready for Modeling
        </div>
        <p class="text-secondary-400 text-sm font-mono lowercase">
          Waiting for system entity definition...
        </p>
      </div>
    </div>

    <!-- Canvas HUD Controls -->
    <div class="absolute bottom-10 right-10 pointer-events-auto p-2 bg-secondary-900/60 backdrop-blur-md shadow-2xl border border-secondary-800 rounded-2xl flex gap-1 z-40">
      <button
        class="w-10 h-10 flex items-center justify-center bg-secondary-800 hover:bg-primary-600 rounded-lg shadow-sm font-bold text-lg transition-colors text-secondary-50 hover:text-white"
        @click="schemaStore.canvasTransform.scale = Math.max(0.2, schemaStore.canvasTransform.scale - 0.1)"
      >
        -
      </button>
      <button
        class="w-10 h-10 flex items-center justify-center bg-secondary-800 hover:bg-primary-600 rounded-lg shadow-sm font-bold text-lg transition-colors text-secondary-50 hover:text-white"
        @click="schemaStore.canvasTransform.scale = Math.min(2, schemaStore.canvasTransform.scale + 0.1)"
      >
        +
      </button>
      <button
        class="px-4 h-10 flex items-center justify-center bg-secondary-800 hover:bg-primary-600 rounded-lg shadow-sm text-xs font-bold transition-all font-mono uppercase tracking-widest text-primary-400 hover:text-white"
        @click="zoomToFit"
      >
        Fit View
      </button>
      <div class="px-4 h-10 flex items-center justify-center bg-secondary-950/50 rounded-lg border border-secondary-800/50 text-[10px] font-mono font-bold text-secondary-300 uppercase tracking-tighter">
        SCALE: {{ Math.round(transform.scale * 100) }}%
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Ensure canvas items can be visible outside the 0,0 box if needed */
.overflow-visible {
  overflow: visible !important;
}
</style>
