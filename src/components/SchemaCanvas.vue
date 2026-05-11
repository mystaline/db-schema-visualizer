<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import { useSchemaStore } from "../stores/schemaStore";
import { useHistory } from "../composables/useHistory";
import { useCreateTableModal } from "../composables/useCreateTableModal";
import TableNode from "./TableNode.vue";
import RelationLines from "./RelationLines.vue";

const schemaStore = useSchemaStore();
const transform = computed(() => schemaStore.canvasTransform);
const isPanning = ref(false);
const panOffset = ref({ x: 0, y: 0 });
const canvasContainer = ref<HTMLElement | null>(null);
const isSpaceDown = ref(false);
const isSpacePanning = ref(false);

const { clearHistory } = useHistory();
const { open: openCreateTableModal } = useCreateTableModal();

// Hydrate on load: URL > localStorage > fresh
const hydrateFromUrl = async () => {
  const hash = window.location.hash;
  if (hash.startsWith("#data=")) {
    await schemaStore.loadFromShareableData(hash.slice("#data=".length));
    clearHistory();
    return;
  }
  schemaStore.loadFromLocalStorage();
  clearHistory();
};

const pendingDeleteTable = ref(false);

const handleGlobalKeyDown = (e: KeyboardEvent) => {
  if (
    e.key === "Delete" &&
    schemaStore.selectedTableId &&
    schemaStore.viewMode === "full"
  ) {
    // Don't trigger if user is typing in an input/textarea/select
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    e.preventDefault();
    pendingDeleteTable.value = true;
  }
  if (e.key === "Escape") {
    pendingDeleteTable.value = false;
  }
};

const confirmDeleteTable = () => {
  if (schemaStore.selectedTableId) {
    schemaStore.removeTable(schemaStore.selectedTableId);
  }
  pendingDeleteTable.value = false;
};

const handleSpaceDown = (e: KeyboardEvent) => {
  if (e.code === "Space" && !e.repeat) {
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    e.preventDefault();
    isSpaceDown.value = true;
  }
};

const handleSpaceUp = (e: KeyboardEvent) => {
  if (e.code === "Space") {
    isSpaceDown.value = false;
    isSpacePanning.value = false;
  }
};

const resetSpaceState = () => {
  isSpaceDown.value = false;
  isSpacePanning.value = false;
};

const handleSpaceMouseDown = (e: MouseEvent) => {
  if (!isSpaceDown.value || e.button !== 0) return;
  isSpacePanning.value = true;
  panOffset.value = {
    x: e.clientX - schemaStore.canvasTransform.x,
    y: e.clientY - schemaStore.canvasTransform.y,
  };
};

const handleSpaceMouseMove = (e: MouseEvent) => {
  if (!isSpacePanning.value) return;
  schemaStore.canvasTransform.x = e.clientX - panOffset.value.x;
  schemaStore.canvasTransform.y = e.clientY - panOffset.value.y;
};

const handleSpaceMouseUp = () => {
  isSpacePanning.value = false;
};

onMounted(async () => {
  await hydrateFromUrl();
  window.addEventListener("keydown", handleGlobalKeyDown);
  window.addEventListener("keydown", handleSpaceDown);
  window.addEventListener("keyup", handleSpaceUp);
  window.addEventListener("blur", resetSpaceState);
  if (schemaStore.tables.length === 0 && schemaStore.viewMode === "full") {
    openCreateTableModal();
  }
});

watch(
  () => schemaStore.tables.length,
  (newLen) => {
    if (newLen === 0 && schemaStore.viewMode === "full") {
      openCreateTableModal();
    }
  },
);

onUnmounted(() => {
  window.removeEventListener("keydown", handleGlobalKeyDown);
  window.removeEventListener("keydown", handleSpaceDown);
  window.removeEventListener("keyup", handleSpaceUp);
  window.removeEventListener("blur", resetSpaceState);
});

const handleCanvasMouseDown = (e: MouseEvent) => {
  // If clicking on background, handle panning
  if (e.button === 0) {
    // Left click
    isPanning.value = true;
    panOffset.value = {
      x: e.clientX - schemaStore.canvasTransform.x,
      y: e.clientY - schemaStore.canvasTransform.y,
    };
  }
};

const handleCanvasMouseMove = (e: MouseEvent) => {
  if (isPanning.value) {
    schemaStore.canvasTransform.x = e.clientX - panOffset.value.x;
    schemaStore.canvasTransform.y = e.clientY - panOffset.value.y;
  }
};

const handleCanvasMouseUp = () => {
  isPanning.value = false;
};

const lastPinchDist = ref(0);

const handleTouchStart = (e: TouchEvent) => {
  if (e.touches.length === 1) {
    isPanning.value = true;
    const touch = e.touches[0];
    panOffset.value = {
      x: touch.clientX - schemaStore.canvasTransform.x,
      y: touch.clientY - schemaStore.canvasTransform.y,
    };
  } else if (e.touches.length === 2) {
    isPanning.value = false;
    lastPinchDist.value = Math.hypot(
      e.touches[0].clientX - e.touches[1].clientX,
      e.touches[0].clientY - e.touches[1].clientY,
    );
  }
};

const handleTouchMove = (e: TouchEvent) => {
  if (e.touches.length === 1 && isPanning.value) {
    const touch = e.touches[0];
    schemaStore.canvasTransform.x = touch.clientX - panOffset.value.x;
    schemaStore.canvasTransform.y = touch.clientY - panOffset.value.y;
  } else if (e.touches.length === 2) {
    e.preventDefault();
    const dist = Math.hypot(
      e.touches[0].clientX - e.touches[1].clientX,
      e.touches[0].clientY - e.touches[1].clientY,
    );
    if (lastPinchDist.value > 0) {
      const oldScale = schemaStore.canvasTransform.k;
      const ratio = dist / lastPinchDist.value;
      const newScale = Math.min(
        Math.max(0.2, oldScale * (1 + (ratio - 1) * 0.5)),
        2,
      );

      const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      const rect = canvasContainer.value?.getBoundingClientRect();
      if (rect) {
        const px = midX - rect.left;
        const py = midY - rect.top;
        schemaStore.canvasTransform.x =
          px - (px - schemaStore.canvasTransform.x) * (newScale / oldScale);
        schemaStore.canvasTransform.y =
          py - (py - schemaStore.canvasTransform.y) * (newScale / oldScale);
      }
      schemaStore.canvasTransform.k = newScale;
    }
    lastPinchDist.value = dist;
  }
};

const handleTouchEnd = () => {
  isPanning.value = false;
};

const handleWheel = (e: WheelEvent) => {
  e.preventDefault();

  if (e.ctrlKey) {
    // Trackpad pinch or Ctrl+scroll → zoom to cursor
    const oldScale = schemaStore.canvasTransform.k;
    const newScale = Math.min(
      Math.max(0.2, oldScale * (1 - e.deltaY * 0.03)),
      2,
    );

    const rect = canvasContainer.value?.getBoundingClientRect();
    if (!rect) {
      schemaStore.canvasTransform.k = newScale;
      return;
    }

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    schemaStore.canvasTransform.x =
      mouseX -
      (mouseX - schemaStore.canvasTransform.x) * (newScale / oldScale) -
      e.deltaX;
    schemaStore.canvasTransform.y =
      mouseY - (mouseY - schemaStore.canvasTransform.y) * (newScale / oldScale);
    schemaStore.canvasTransform.k = newScale;
  } else {
    // 2-finger slide or scroll wheel → pan
    schemaStore.canvasTransform.x -= e.deltaX;
    schemaStore.canvasTransform.y -= e.deltaY;
  }
};

const zoomToFit = () => {
  schemaStore.canvasTransform = { x: 0, y: 0, k: 1 };
};

const canvasStyle = computed(() => ({
  transform: `translate(${transform.value.x}px, ${transform.value.y}px) scale(${transform.value.k})`,
  transformOrigin: "0 0",
}));
</script>

<template>
  <div
    ref="canvasContainer"
    class="relative w-full h-full bg-secondary-950 overflow-hidden touch-none"
    :class="isPanning ? 'cursor-grabbing' : 'cursor-grab'"
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
        backgroundImage:
          'radial-gradient(circle at 1px 1px, var(--dot-color) 1px, transparent 0)',
        backgroundPosition: `${transform.x}px ${transform.y}px`,
        backgroundSize: `${40 * transform.k}px ${40 * transform.k}px`,
      }"
    />

    <!-- Canvas Transform Layer -->
    <div class="absolute inset-0 z-10 overflow-visible" :style="canvasStyle">
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
        <div
          class="text-secondary-400 text-6xl font-black uppercase tracking-tighter"
        >
          Ready for Modeling
        </div>
        <p class="text-secondary-400 text-sm font-mono lowercase">
          Waiting for system entity definition...
        </p>
      </div>
    </div>

    <!-- Space-pan overlay: sits above tables, captures drag when space is held -->
    <div
      v-if="isSpaceDown"
      class="absolute inset-0 z-30"
      :class="isSpacePanning ? 'cursor-grabbing' : 'cursor-grab'"
      @mousedown="handleSpaceMouseDown"
      @mousemove="handleSpaceMouseMove"
      @mouseup="handleSpaceMouseUp"
      @mouseleave="handleSpaceMouseUp"
    />

    <!-- Delete Table Confirmation -->
    <div
      v-if="pendingDeleteTable && schemaStore.selectedTable"
      class="absolute top-6 left-1/2 -translate-x-1/2 z-50 bg-secondary-900 border border-danger-500/50 rounded-xl shadow-2xl px-5 py-3 flex items-center gap-4"
    >
      <span class="text-sm text-secondary-50"
        >Delete
        <span class="font-bold text-danger-500">{{
          schemaStore.selectedTable.name
        }}</span
        >?</span
      >
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
    <div
      class="absolute bottom-6 left-1/2 -translate-x-1/2 pointer-events-auto px-1.5 py-1.5 bg-secondary-900/90 backdrop-blur-md shadow-lg border border-secondary-700 rounded-xl flex items-center gap-1 z-40"
    >
      <button
        class="w-8 h-8 flex items-center justify-center bg-transparent hover:bg-secondary-800 rounded-lg font-bold text-base transition-colors text-secondary-400 hover:text-secondary-50"
        @click="
          schemaStore.canvasTransform.k = Math.max(
            0.2,
            schemaStore.canvasTransform.k - 0.1,
          )
        "
      >
        −
      </button>
      <button
        class="px-3 h-8 flex items-center justify-center bg-transparent hover:bg-secondary-800 rounded-lg text-[11px] font-mono font-bold transition-colors text-secondary-300 hover:text-secondary-50 min-w-[46px] text-center"
        @click="schemaStore.canvasTransform.k = 1"
      >
        {{ Math.round(transform.k * 100) }}%
      </button>
      <button
        class="w-8 h-8 flex items-center justify-center bg-transparent hover:bg-secondary-800 rounded-lg font-bold text-base transition-colors text-secondary-400 hover:text-secondary-50"
        @click="
          schemaStore.canvasTransform.k = Math.min(
            2,
            schemaStore.canvasTransform.k + 0.1,
          )
        "
      >
        +
      </button>
      <div class="w-px h-5 bg-secondary-700 mx-0.5" />
      <button
        class="px-3 h-8 flex items-center justify-center bg-transparent hover:bg-secondary-800 rounded-lg text-[11px] font-semibold transition-colors text-secondary-400 hover:text-secondary-50"
        @click="zoomToFit"
      >
        Fit
      </button>
    </div>
  </div>
</template>

<style scoped>
/* Ensure canvas items can be visible outside the 0,0 box if needed */
.overflow-visible {
  overflow: visible !important;
}
</style>
