import { ref, computed, watch, toRaw } from "vue";
import { useSchemaStore, type Table, type ForeignKey } from "../stores/schemaStore";

interface Snapshot {
  tables: Table[];
  foreignKeys: ForeignKey[];
}

const MAX_HISTORY = 50;
const DEBOUNCE_MS = 300;

const undoStack = ref<Snapshot[]>([]);
const redoStack = ref<Snapshot[]>([]);
let isRestoring = false;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let lastSnapshot: string | null = null;

function takeSnapshot(store: ReturnType<typeof useSchemaStore>): Snapshot {
  return JSON.parse(JSON.stringify({
    tables: toRaw(store.tables),
    foreignKeys: toRaw(store.foreignKeys),
  }));
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
      if (isRestoring) return;

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
    { deep: true },
  );

  function restore(snapshot: Snapshot) {
    isRestoring = true;
    store.tables = JSON.parse(JSON.stringify(snapshot.tables));
    store.foreignKeys = JSON.parse(JSON.stringify(snapshot.foreignKeys));
    lastSnapshot = snapshotKey(snapshot);
    // Use setTimeout to ensure the watcher fires and sees isRestoring=true
    setTimeout(() => {
      isRestoring = false;
    }, 0);
  }

  function undo() {
    if (!canUndo.value) return;
    const current = takeSnapshot(store);
    redoStack.value.push(current);
    const previous = undoStack.value.pop()!;
    restore(previous);
  }

  function redo() {
    if (!canRedo.value) return;
    const current = takeSnapshot(store);
    undoStack.value.push(current);
    const next = redoStack.value.pop()!;
    restore(next);
  }

  return { undo, redo, canUndo, canRedo };
}
