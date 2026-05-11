import { ref, computed, watch, toRaw, nextTick } from "vue";
import {
  useSchemaStore,
  type Table,
  type ForeignKey,
} from "../stores/schemaStore";

interface Snapshot {
  tables: Table[];
  foreignKeys: ForeignKey[];
}

const MAX_HISTORY = 50;
const DEBOUNCE_MS = 300;

const undoStack = ref<Snapshot[]>([]);
const redoStack = ref<Snapshot[]>([]);
let isRestoring = false;
export const isHistoryRestoring = ref(false);
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let lastSnapshot: string | null = null;

function takeSnapshot(store: ReturnType<typeof useSchemaStore>): Snapshot {
  return JSON.parse(
    JSON.stringify({
      tables: toRaw(store.tables),
      foreignKeys: toRaw(store.foreignKeys),
    }),
  );
}

function snapshotKey(snap: Snapshot): string {
  return JSON.stringify(snap);
}

export function useHistory() {
  const store = useSchemaStore();

  const canUndo = computed(() => undoStack.value.length > 0);
  const canRedo = computed(() => redoStack.value.length > 0);

  // Initialize baseline snapshot
  if (lastSnapshot === null) {
    lastSnapshot = snapshotKey(takeSnapshot(store));
  }

  // Watch for changes and push to undo stack (debounced)
  watch(
    () => [store.tables, store.foreignKeys],
    () => {
      if (isRestoring || store.viewMode === "read") return;

      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        const currentKey = snapshotKey(takeSnapshot(store));
        if (currentKey === lastSnapshot) return;

        // Push previous state to undo stack
        const previousSnapshot: Snapshot = JSON.parse(lastSnapshot!);
        undoStack.value.push(previousSnapshot);
        if (undoStack.value.length > MAX_HISTORY) {
          undoStack.value.shift();
        }

        // Clear redo on new action
        redoStack.value = [];
        lastSnapshot = currentKey;
      }, DEBOUNCE_MS);
    },
    { deep: true, flush: "sync" },
  );

  function restore(snapshot: Snapshot) {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    isRestoring = true;
    isHistoryRestoring.value = true;
    store.restoreSnapshot(
      JSON.parse(JSON.stringify(snapshot.tables)),
      JSON.parse(JSON.stringify(snapshot.foreignKeys)),
      store.canvasTransform,
      store.selectedTableId,
    );
    lastSnapshot = snapshotKey(snapshot);
    isRestoring = false;
    nextTick(() => {
      isHistoryRestoring.value = false;
    });
  }

  function undo() {
    if (!canUndo.value || store.viewMode === "read") return;
    const current = takeSnapshot(store);
    redoStack.value.push(current);
    const previous = undoStack.value.pop()!;
    restore(previous);
  }

  function redo() {
    if (!canRedo.value || store.viewMode === "read") return;
    const current = takeSnapshot(store);
    undoStack.value.push(current);
    const next = redoStack.value.pop()!;
    restore(next);
  }

  function clearHistory() {
    undoStack.value = [];
    redoStack.value = [];
    lastSnapshot = snapshotKey(takeSnapshot(store));
  }

  return { undo, redo, canUndo, canRedo, clearHistory };
}
