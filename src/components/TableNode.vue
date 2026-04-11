<script setup lang="ts">
import { computed, ref, nextTick, onUnmounted } from "vue";
import { useSchemaStore, type Table } from "../stores/schemaStore";

const IDENTIFIER_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

const props = defineProps<{
  table: Table;
  scale: number;
}>();

const schemaStore = useSchemaStore();
const isDragging = ref(false);
const dragOffset = ref({ startX: 0, startY: 0, initialX: 0, initialY: 0 });
const isRenaming = ref(false);
const renameInput = ref<HTMLInputElement | null>(null);
const renameValue = ref("");

const isSelected = computed(
  () => schemaStore.selectedTableId === props.table.id,
);

const tableStyle = computed(() => {
  const active = schemaStore.activeDrag;
  if (active?.id === props.table.id) {
    return {
      left: `${active.x}px`,
      top: `${active.y}px`,
    };
  }
  return {
    left: `${props.table.x}px`,
    top: `${props.table.y}px`,
  };
});

const selectTable = () => {
  schemaStore.selectedTableId = props.table.id;
};

const handleMouseMove = (e: MouseEvent) => {
  if (!isDragging.value) return;

  const deltaX = (e.clientX - dragOffset.value.startX) / props.scale;
  const deltaY = (e.clientY - dragOffset.value.startY) / props.scale;

  const newX = dragOffset.value.initialX + deltaX;
  const newY = dragOffset.value.initialY + deltaY;

  schemaStore.activeDrag = { id: props.table.id, x: newX, y: newY };
  schemaStore.updateTable(props.table.id, { x: newX, y: newY });
};

const handleMouseUp = () => {
  isDragging.value = false;
  schemaStore.activeDrag = null;
  window.removeEventListener("mousemove", handleMouseMove);
  window.removeEventListener("mouseup", handleMouseUp);
};

const handleMouseDown = (e: MouseEvent) => {
  if (schemaStore.viewMode === 'read') {
    selectTable();
    return;
  }

  selectTable();
  isDragging.value = true;

  dragOffset.value = {
    startX: e.clientX,
    startY: e.clientY,
    initialX: props.table.x,
    initialY: props.table.y,
  };

  window.addEventListener("mousemove", handleMouseMove);
  window.addEventListener("mouseup", handleMouseUp);

  e.stopPropagation();
  e.preventDefault();
};

const handleTouchStart = (e: TouchEvent) => {
  if (schemaStore.viewMode === 'read') {
    selectTable();
    return;
  }

  selectTable();
  isDragging.value = true;
  const touch = e.touches[0];

  dragOffset.value = {
    startX: touch.clientX,
    startY: touch.clientY,
    initialX: props.table.x,
    initialY: props.table.y,
  };

  window.addEventListener("touchmove", handleTouchMove, { passive: false });
  window.addEventListener("touchend", handleTouchUp);

  e.stopPropagation();
};

const handleTouchMove = (e: TouchEvent) => {
  if (!isDragging.value) return;
  e.preventDefault(); // Prevent scrolling while dragging

  const touch = e.touches[0];
  const deltaX = (touch.clientX - dragOffset.value.startX) / props.scale;
  const deltaY = (touch.clientY - dragOffset.value.startY) / props.scale;

  const newX = dragOffset.value.initialX + deltaX;
  const newY = dragOffset.value.initialY + deltaY;

  schemaStore.activeDrag = { id: props.table.id, x: newX, y: newY };
  schemaStore.updateTable(props.table.id, { x: newX, y: newY });
};

const handleTouchUp = () => {
  isDragging.value = false;
  schemaStore.activeDrag = null;
  window.removeEventListener("touchmove", handleTouchMove);
  window.removeEventListener("touchend", handleTouchUp);
};

const handleKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    selectTable();
  }
};

const startRename = async () => {
  if (schemaStore.viewMode === 'read') return;
  renameValue.value = props.table.name;
  isRenaming.value = true;
  await nextTick();
  renameInput.value?.focus();
  renameInput.value?.select();
};

const commitRename = () => {
  let sanitized = renameValue.value.replace(/[^a-zA-Z0-9_]/g, "");
  if (sanitized && /^\d/.test(sanitized)) sanitized = "_" + sanitized;
  if (sanitized && IDENTIFIER_RE.test(sanitized)) {
    schemaStore.updateTable(props.table.id, { name: sanitized });
  }
  isRenaming.value = false;
};

const cancelRename = () => {
  isRenaming.value = false;
};

onUnmounted(() => {
  window.removeEventListener("mousemove", handleMouseMove);
  window.removeEventListener("mouseup", handleMouseUp);
  window.removeEventListener("touchmove", handleTouchMove);
  window.removeEventListener("touchend", handleTouchUp);
  if (isDragging.value) {
    schemaStore.activeDrag = null;
  }
});
</script>

<template>
  <div
    class="absolute z-20 pointer-events-auto select-none touch-none"
    :class="schemaStore.viewMode === 'read' ? 'cursor-default' : 'cursor-move'"
    :style="tableStyle"
    :tabindex="0"
    role="article"
    :aria-label="`Table: ${table.name}, ${table.columns.length} columns`"
    :aria-selected="isSelected"
    @mousedown="handleMouseDown"
    @touchstart="handleTouchStart"
    @keydown="handleKeyDown"
  >
    <div
      class="min-w-[200px] bg-secondary-900 border-2 rounded-xl shadow-2xl overflow-hidden transition-[border-color,transform,box-shadow] duration-300 focus-within:ring-2 focus-within:ring-primary-500/50"
      :class="[
        isSelected
          // shadow color: primary-400 (#009eff) at 20% opacity — hardcoded because
          // Tailwind arbitrary values cannot interpolate CSS custom properties at build time
          ? 'border-primary-500 scale-105 shadow-[0_0_30px_rgba(0,158,255,0.2)]'
          : 'border-secondary-800 hover:border-secondary-700',
      ]"
    >
      <!-- Table Header -->
      <div
        class="px-4 py-2 flex items-center justify-between border-b"
        :class="
          isSelected
            ? 'bg-primary-500/10 border-primary-500/30'
            : 'bg-secondary-800/50 border-secondary-800'
        "
      >
        <input
          v-if="isRenaming"
          ref="renameInput"
          v-model="renameValue"
          class="text-xs font-bold text-secondary-50 font-mono tracking-wider bg-transparent border-b border-primary-500 focus:outline-none w-full"
          @blur="commitRename"
          @keydown.enter="commitRename"
          @keydown.escape="cancelRename"
          @mousedown.stop
        >
        <span
          v-else
          class="text-xs font-bold text-secondary-50 font-mono tracking-wider cursor-text"
          :title="schemaStore.viewMode === 'full' ? 'Double-click to rename' : undefined"
          @dblclick.stop="startRename"
        >{{ table.name }}</span>
        <span class="text-[9px] font-mono text-secondary-500 shrink-0">{{ table.columns.length }} col</span>
      </div>

      <!-- Columns List -->
      <div class="p-1.5 space-y-0.5 bg-secondary-800/20">
        <div
          v-for="col in table.columns"
          :key="col.id"
          class="px-3 py-1.5 flex items-center justify-between group hover:bg-secondary-800/30 rounded-md transition-colors"
        >
          <div class="flex items-center gap-2 min-w-0">
            <span
              v-if="col.isPrimaryKey"
              title="Primary Key"
              aria-label="Primary Key"
              class="text-warning-400 text-[10px] shrink-0"
            >🔑</span>
            <span
              class="text-[11px] font-medium tracking-tight truncate"
              :class="col.isPrimaryKey ? 'text-secondary-50' : 'text-secondary-300'"
            >
              {{ col.name }}
            </span>
          </div>
          <span class="text-[9px] font-mono text-secondary-400 uppercase shrink-0 ml-2">{{
            col.type
          }}</span>
        </div>

        <div
          v-if="table.columns.length === 0"
          class="py-4 text-center"
        >
          <span class="text-[10px] text-secondary-500 italic">No attributes defined</span>
        </div>
      </div>

      <!-- Indexes/FK Indicators (Mini) -->
      <div
        v-if="table.indexes.length > 0 || table.checkConstraints.length > 0"
        class="px-3 py-1.5 border-t border-secondary-800 flex flex-wrap gap-2"
      >
        <span
          v-if="table.indexes.length > 0"
          class="text-[8px] font-bold text-primary-500 uppercase tracking-tighter"
        >
          IDX ({{ table.indexes.length }})
        </span>
        <span
          v-if="table.checkConstraints.length > 0"
          class="text-[8px] font-bold text-success-500 uppercase tracking-tighter"
        >
          CHK ({{ table.checkConstraints.length }})
        </span>
      </div>
    </div>
  </div>
</template>
