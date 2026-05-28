<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from "vue";
import { useSchemaStore } from "../stores/schemaStore";
import { useHistory, isHistoryRestoring } from "../composables/useHistory";
import { useToast } from "../composables/useToast";
import { useCreateTableModal } from "../composables/useCreateTableModal";
import { APP_VERSION, VERSION_STORAGE_KEY } from "../version";
import TableNode from "./TableNode.vue";
import RelationLines from "./RelationLines.vue";
import ConfirmModal from "./ConfirmModal.vue";

const schemaStore = useSchemaStore();
const transform = computed(() => schemaStore.canvasTransform);
const isEmbed = new URLSearchParams(window.location.search).has("embed");
const isPanning = ref(false);
const panOffset = ref({ x: 0, y: 0 });
const canvasContainer = ref<HTMLElement | null>(null);
const isSpaceDown = ref(false);
const isSpacePanning = ref(false);

const { clearHistory } = useHistory();
const { open: openCreateTableModal } = useCreateTableModal();
const { toast } = useToast();
const isHydrating = ref(true);

// Hydrate on load: URL > localStorage > fresh
// Returns true if the session loaded cleanly (tables may still be empty for a new user).
// Returns false if there was a load error — caller should not auto-open the create modal.
const hydrateFromUrl = async (): Promise<boolean> => {
  try {
    if (isEmbed) {
      clearHistory();
      return true;
    }
    const hash = window.location.hash;
    if (hash.startsWith("#data=")) {
      const ok = await schemaStore.loadFromShareableData(
        hash.slice("#data=".length),
      );
      if (ok) {
        window.history.replaceState(
          null,
          "",
          window.location.pathname + window.location.search,
        );
      } else {
        schemaStore.viewMode = "full";
        const localResult = schemaStore.loadFromLocalStorage();
        toast(
          localResult === "loaded"
            ? "Share link could not be loaded. Restored your last session."
            : "Share link could not be loaded and no saved session was found.",
          "error",
        );
      }
      clearHistory();
      return true;
    }
    const result = schemaStore.loadFromLocalStorage();
    clearHistory();
    return result !== "error";
  } catch (e) {
    console.error("[SchemaCanvas] hydrateFromUrl failed", e);
    toast("Failed to load your session. Starting fresh.", "error");
    clearHistory();
    return false;
  }
};

const pendingDeleteTable = ref(false);
const pendingDeleteTableId = ref<string | null>(null);
const pendingDeleteTableName = ref<string | null>(null);

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
    pendingDeleteTableId.value = schemaStore.selectedTableId;
    pendingDeleteTableName.value = schemaStore.selectedTable?.name ?? null;
    pendingDeleteTable.value = true;
  }
  if (e.key === "Escape") {
    if (pendingDeleteTable.value) cancelDeleteTable();
  }
};

const confirmDeleteTable = () => {
  try {
    if (pendingDeleteTableId.value) {
      schemaStore.removeTable(pendingDeleteTableId.value);
    } else {
      toast("Could not delete — no table was selected.", "error");
    }
  } catch (e) {
    console.error("[SchemaCanvas] removeTable threw unexpectedly", e);
    toast("Failed to delete the table. Please try again.", "error");
  } finally {
    pendingDeleteTable.value = false;
    pendingDeleteTableId.value = null;
    pendingDeleteTableName.value = null;
  }
};

const cancelDeleteTable = () => {
  pendingDeleteTable.value = false;
  pendingDeleteTableId.value = null;
  pendingDeleteTableName.value = null;
};

const handleSpaceDown = (e: KeyboardEvent) => {
  if (e.code === "Space" && !e.repeat) {
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    if (pendingDeleteTable.value) return;
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
  const sessionOk = await hydrateFromUrl();
  isHydrating.value = false;
  window.addEventListener("keydown", handleGlobalKeyDown);
  window.addEventListener("keydown", handleSpaceDown);
  window.addEventListener("keyup", handleSpaceUp);
  window.addEventListener("blur", resetSpaceState);
  const whatsNewPending = (() => {
    try { return localStorage.getItem(VERSION_STORAGE_KEY) !== APP_VERSION; }
    catch { return false; }
  })();
  if (
    sessionOk &&
    !isEmbed &&
    !whatsNewPending &&
    schemaStore.tables.length === 0 &&
    schemaStore.viewMode === "full"
  ) {
    openCreateTableModal();
  }
});

watch(
  () => schemaStore.tables.length,
  (newLen) => {
    if (
      !isEmbed &&
      newLen === 0 &&
      schemaStore.viewMode === "full" &&
      !isHistoryRestoring.value &&
      !isHydrating.value
    ) {
      nextTick(() => {
        if (schemaStore.tables.length === 0 && !isHistoryRestoring.value)
          openCreateTableModal();
      });
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

  // Distinguish mouse wheel (large discrete steps, e.g. ±100) from trackpad
  // (small smooth deltas, e.g. ±1–10). Mouse wheel panning needs damping.
  const isMouseWheel = Math.abs(e.deltaY) > 30;

  if (e.ctrlKey) {
    // Trackpad pinch or Ctrl+scroll → zoom to cursor
    const oldScale = schemaStore.canvasTransform.k;
    const speed = isMouseWheel ? 0.001 : 0.03;
    const newScale = Math.min(
      Math.max(0.2, oldScale * (1 - e.deltaY * speed)),
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
      (isMouseWheel ? 0 : e.deltaX);
    schemaStore.canvasTransform.y =
      mouseY - (mouseY - schemaStore.canvasTransform.y) * (newScale / oldScale);
    schemaStore.canvasTransform.k = newScale;
  } else {
    // 2-finger slide or scroll wheel → pan
    const damp = isMouseWheel ? 0.4 : 1;
    schemaStore.canvasTransform.x -= e.deltaX * damp;
    schemaStore.canvasTransform.y -= e.deltaY * damp;
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
      @mousedown.stop="handleSpaceMouseDown"
      @mousemove="handleSpaceMouseMove"
      @mouseup="handleSpaceMouseUp"
      @mouseleave="handleSpaceMouseUp"
    />

    <!-- Delete Table Confirmation Modal -->
    <ConfirmModal
      :is-open="pendingDeleteTable"
      title="Delete Table"
      :message="
        pendingDeleteTableName
          ? `'${pendingDeleteTableName}' and all its columns, indexes, and foreign keys will be permanently removed.`
          : undefined
      "
      @confirm="confirmDeleteTable"
      @cancel="cancelDeleteTable"
    />

    <!-- Canvas HUD Controls -->
    <div
      class="absolute bottom-6 left-1/2 -translate-x-1/2 pointer-events-auto px-1.5 py-1.5 bg-secondary-900/90 backdrop-blur-md shadow-lg border border-secondary-700 rounded-xl flex items-center gap-1 z-40"
      @mousedown.stop
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
