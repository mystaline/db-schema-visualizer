<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useSchemaStore } from '../stores/schemaStore'
import { useHistory } from '../composables/useHistory'
import { useCreateTableModal } from '../composables/useCreateTableModal'
import TableNode from './TableNode.vue'
import RelationLines from './RelationLines.vue'

const schemaStore = useSchemaStore()
const transform = computed(() => schemaStore.canvasTransform)
const isPanning = ref(false)
const panOffset = ref({ x: 0, y: 0 })

const { clearHistory } = useHistory()
const { open: openCreateTableModal } = useCreateTableModal()

// Hydrate on load: URL > localStorage > fresh
const hydrateFromUrl = async () => {
  const hash = window.location.hash
  if (hash.startsWith('#data=')) {
    await schemaStore.loadFromShareableData(hash.slice('#data='.length))
    clearHistory()
    return
  }
  schemaStore.loadFromLocalStorage()
  clearHistory()
}

const pendingDeleteTable = ref(false)

const handleGlobalKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'Delete' && schemaStore.selectedTableId && schemaStore.viewMode === 'full') {
    // Don't trigger if user is typing in an input/textarea/select
    const tag = (e.target as HTMLElement)?.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
    e.preventDefault()
    pendingDeleteTable.value = true
  }
  if (e.key === 'Escape') {
    pendingDeleteTable.value = false
  }
}

const confirmDeleteTable = () => {
  if (schemaStore.selectedTableId) {
    schemaStore.removeTable(schemaStore.selectedTableId)
  }
  pendingDeleteTable.value = false
}

onMounted(async () => {
  await hydrateFromUrl()
  window.addEventListener('keydown', handleGlobalKeyDown)
  if (schemaStore.tables.length === 0 && schemaStore.viewMode === 'full') {
    openCreateTableModal()
  }
})

watch(() => schemaStore.tables.length, (newLen) => {
  if (newLen === 0 && schemaStore.viewMode === 'full') {
    openCreateTableModal()
  }
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleGlobalKeyDown)
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

const initialPinchDist = ref(0);
const initialPinchScale = ref(1);

const handleTouchStart = (e: TouchEvent) => {
  if (e.touches.length === 1) {
    isPanning.value = true
    const touch = e.touches[0]
    panOffset.value = {
      x: touch.clientX - schemaStore.canvasTransform.x,
      y: touch.clientY - schemaStore.canvasTransform.y
    }
  } else if (e.touches.length === 2) {
    isPanning.value = false;
    const dist = Math.hypot(
      e.touches[0].clientX - e.touches[1].clientX,
      e.touches[0].clientY - e.touches[1].clientY
    );
    initialPinchDist.value = dist;
    initialPinchScale.value = schemaStore.canvasTransform.k;
  }
}

const handleTouchMove = (e: TouchEvent) => {
  if (e.touches.length === 1 && isPanning.value) {
    const touch = e.touches[0]
    schemaStore.canvasTransform.x = touch.clientX - panOffset.value.x
    schemaStore.canvasTransform.y = touch.clientY - panOffset.value.y
  } else if (e.touches.length === 2) {
    const dist = Math.hypot(
      e.touches[0].clientX - e.touches[1].clientX,
      e.touches[0].clientY - e.touches[1].clientY
    );
    const delta = dist / initialPinchDist.value;
    const newScale = Math.min(Math.max(0.2, initialPinchScale.value * delta), 2);
    schemaStore.canvasTransform.k = newScale;
  }
}

const handleTouchEnd = () => {
  isPanning.value = false
}

const handleWheel = (e: WheelEvent) => {
  e.preventDefault()
  const zoomFactor = 0.05
  const delta = e.deltaY > 0 ? -zoomFactor : zoomFactor
  const newScale = Math.min(Math.max(0.2, schemaStore.canvasTransform.k + delta), 2)
  schemaStore.canvasTransform.k = newScale
}

const zoomToFit = () => {
  schemaStore.canvasTransform = { x: 0, y: 0, k: 1 }
}

const canvasStyle = computed(() => ({
  transform: `translate(${transform.value.x}px, ${transform.value.y}px) scale(${transform.value.k})`,
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
    @touchstart="handleTouchStart"
    @touchmove="handleTouchMove"
    @touchend="handleTouchEnd"
    @wheel="handleWheel"
  >
    <!-- Dynamic Dot Grid — color via CSS var so it responds to light/dark theme -->
    <div
      class="absolute inset-0 z-0"
      :style="{
        backgroundImage: 'radial-gradient(circle at 1px 1px, var(--dot-color) 1px, transparent 0)',
        backgroundPosition: `${transform.x}px ${transform.y}px`,
        backgroundSize: `${40 * transform.k}px ${40 * transform.k}px`
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
        :scale="transform.k"
      />

      <!-- Empty state watermark -->
      <div
        v-if="schemaStore.tables.length === 0"
        class="flex flex-col items-center gap-6 opacity-20 transform -rotate-12 transition-all select-none"
      >
        <div class="text-secondary-400 text-6xl font-black uppercase tracking-tighter">
          Ready for Modeling
        </div>
        <p class="text-secondary-400 text-sm font-mono lowercase">
          Waiting for system entity definition...
        </p>
      </div>
    </div>

    <!-- Delete Table Confirmation -->
    <div
      v-if="pendingDeleteTable && schemaStore.selectedTable"
      class="absolute top-6 left-1/2 -translate-x-1/2 z-50 bg-secondary-900 border border-danger-500/50 rounded-xl shadow-2xl px-5 py-3 flex items-center gap-4"
    >
      <span class="text-sm text-secondary-50">Delete <span class="font-bold text-danger-500">{{ schemaStore.selectedTable.name }}</span>?</span>
      <button
        class="px-3 py-1 text-xs font-bold bg-danger-500/10 hover:bg-danger-500/20 text-danger-500 rounded-lg transition-colors"
        @click="confirmDeleteTable"
      >
        Delete
      </button>
      <button
        class="px-3 py-1 text-xs font-bold bg-secondary-800 hover:bg-secondary-700 text-secondary-300 rounded-lg transition-colors"
        @click="pendingDeleteTable = false"
      >
        Cancel
      </button>
    </div>

    <!-- Canvas HUD Controls -->
    <div class="absolute bottom-10 right-10 pointer-events-auto p-2 bg-secondary-900/60 backdrop-blur-md shadow-2xl border border-secondary-800 rounded-2xl flex gap-1 z-40">
      <button
        class="w-10 h-10 flex items-center justify-center bg-secondary-800 hover:bg-primary-600 rounded-lg shadow-sm font-bold text-lg transition-colors text-secondary-50 hover:text-white"
        @click="schemaStore.canvasTransform.k = Math.max(0.2, schemaStore.canvasTransform.k - 0.1)"
      >
        -
      </button>
      <button
        class="w-10 h-10 flex items-center justify-center bg-secondary-800 hover:bg-primary-600 rounded-lg shadow-sm font-bold text-lg transition-colors text-secondary-50 hover:text-white"
        @click="schemaStore.canvasTransform.k = Math.min(2, schemaStore.canvasTransform.k + 0.1)"
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
        SCALE: {{ Math.round(transform.k * 100) }}%
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
