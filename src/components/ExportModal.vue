<script setup lang="ts">
import { computed, ref, toRef } from "vue";
import { useSchemaStore } from "../stores/schemaStore";
import { useToast } from "../composables/useToast";
import ModalShell from "./ModalShell.vue";
import { useModalKeyboard } from "../composables/useModalKeyboard";
import { buildSchemaSql, hasBrokenRefs, countCrossBoundaryFks, type BuildOptions } from "../utils/sqlExporter";
import { downloadZip } from "../utils/zipExport";

const props = defineProps<{
  isOpen: boolean;
}>();

const emit = defineEmits(["close"]);

const schemaStore = useSchemaStore();
const { toast } = useToast();

const modalRef = ref<HTMLElement | null>(null);
const copyBtnRef = ref<HTMLButtonElement | null>(null);

type ExportTab = "sql" | "json";
const activeTab = ref<ExportTab>("sql");

// ---- SQL Generation with Mode State ----
type SqlMode = "all" | "single" | "bundle";
const sqlMode = ref<SqlMode>("all");
const viewedEntityId = ref<string | null>(null);
const bundleSelectedIds = ref<Set<string>>(new Set());

const enterAll = () => {
  sqlMode.value = "all";
  viewedEntityId.value = null;
  bundleSelectedIds.value = new Set();
};
const enterSingle = (id: string) => {
  const exists = schemaStore.tables.some((t) => t.id === id);
  if (!exists) {
    console.warn(`Attempted to enter single mode for deleted entity ${id} — ignoring`);
    return;
  }
  sqlMode.value = "single";
  viewedEntityId.value = id;
  bundleSelectedIds.value = new Set();
};
const enterBundle = () => {
  sqlMode.value = "bundle";
  viewedEntityId.value = null;
  bundleSelectedIds.value = new Set(schemaStore.tables.map((t) => t.id));
};
const toggleBundle = (id: string) => {
  const exists = schemaStore.tables.some((t) => t.id === id);
  if (!exists) {
    console.warn(`Attempted to toggle deleted entity ${id} — ignoring`);
    return;
  }
  const next = new Set(bundleSelectedIds.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  bundleSelectedIds.value = next;
};
const setBundleAll = (checked: boolean) => {
  bundleSelectedIds.value = checked
    ? new Set(schemaStore.tables.map((t) => t.id))
    : new Set();
};

const exportSet = computed<Set<string>>(() => {
  if (sqlMode.value === "all") return new Set(schemaStore.tables.map((t) => t.id));
  if (sqlMode.value === "single") {
    if (!viewedEntityId.value) return new Set();
    const exists = schemaStore.tables.some((t) => t.id === viewedEntityId.value);
    if (!exists) {
      console.warn(`viewedEntityId ${viewedEntityId.value} no longer exists — falling back to all mode`);
      enterAll();
      return new Set(schemaStore.tables.map((t) => t.id));
    }
    return new Set([viewedEntityId.value]);
  }
  return bundleSelectedIds.value;
});

const markCrossBoundary = computed(() => sqlMode.value !== "all");

const crossBoundaryCount = computed(() =>
  sqlMode.value === "bundle"
    ? countCrossBoundaryFks(exportSet.value, schemaStore.foreignKeys, schemaStore.tables)
    : 0,
);

const generatedSql = computed(() => {
  if (sqlMode.value === "bundle" && bundleSelectedIds.value.size === 0) {
    return "-- Select entities from the sidebar to preview SQL";
  }
  return buildSchemaSql(schemaStore.tables, schemaStore.foreignKeys, {
    exportSet: exportSet.value,
    markCrossBoundary: markCrossBoundary.value,
  });
});

const hasBrokenExport = computed(() =>
  hasBrokenRefs(schemaStore.tables, schemaStore.foreignKeys),
);

const entityCounts = computed(() => {
  const map: Record<string, { c: number; i: number; fk: number }> = {};
  schemaStore.tables.forEach((t) => {
    map[t.id] = {
      c: t.columns.length,
      i: t.indexes.length,
      fk: schemaStore.foreignKeys.filter((fk) => fk.sourceTableId === t.id).length,
    };
  });
  return map;
});

const bundleAllState = computed<"none" | "some" | "all">(() => {
  const total = schemaStore.tables.length;
  const sel = bundleSelectedIds.value.size;
  if (sel === 0) return "none";
  if (sel === total) return "all";
  return "some";
});

const canCopy = computed(() => {
  if (sqlMode.value === "bundle") return bundleSelectedIds.value.size > 0;
  return true;
});
const canDownloadSql = computed(() => canCopy.value);
const canDownloadZip = computed(() => {
  if (sqlMode.value === "single") return false;
  if (sqlMode.value === "bundle") return bundleSelectedIds.value.size >= 2;
  return true; // all mode
});
const zipDisabledTooltip = computed(() => {
  if (sqlMode.value === "single") return "Use Bundle mode for ZIP";
  if (sqlMode.value === "bundle" && bundleSelectedIds.value.size < 2)
    return "Select 2+ entities";
  return "";
});

// ---- JSON Generation ----
const generatedJson = computed(() => {
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    tables: schemaStore.tables,
    foreignKeys: schemaStore.foreignKeys,
  };
  return JSON.stringify(payload, null, 2);
});

// Active content based on tab
const activeContent = computed(() =>
  activeTab.value === "sql" ? generatedSql.value : generatedJson.value,
);

const copyToClipboard = async () => {
  try {
    await navigator.clipboard.writeText(activeContent.value);
    toast(
      activeTab.value === "sql"
        ? "SQL copied to clipboard!"
        : "JSON copied to clipboard!",
    );
  } catch (err) {
    console.error("Clipboard write failed", err);
    toast("Failed to copy — use Export button to download instead", "error");
  }
};

const downloadSqlFile = () => {
  try {
    let filename = "schema_export.sql";
    if (sqlMode.value === "single" && viewedEntityId.value) {
      const t = schemaStore.tables.find((x) => x.id === viewedEntityId.value);
      if (t) filename = `${t.name}.sql`;
    } else if (sqlMode.value === "bundle") {
      filename = "schema_export_subset.sql";
    }
    const blob = new Blob([generatedSql.value], { type: "text/sql" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 100);
    toast(`${filename} downloaded!`);
  } catch (e) {
    console.error("SQL download failed", e);
    toast("Download failed — try copying the content instead", "error");
  }
};

const downloadZipFile = async () => {
  try {
    const ids = sqlMode.value === "all"
      ? new Set(schemaStore.tables.map((t) => t.id))
      : bundleSelectedIds.value;
    const files = schemaStore.tables
      .filter((t) => ids.has(t.id))
      .map((t) => ({
        name: `${t.name}.sql`,
        content: buildSchemaSql([t], schemaStore.foreignKeys, {
          exportSet: ids,
          markCrossBoundary: markCrossBoundary.value,
        }),
      }));
    const zipName = sqlMode.value === "bundle" ? "schema_export_subset.zip" : "schema_export.zip";
    await downloadZip(files, zipName);
    toast(`${zipName} downloaded!`);
  } catch (e) {
    console.error("ZIP export failed", e);
    toast("ZIP export failed — try Download .SQL instead", "error");
  }
};

const downloadFile = () => {
  try {
    const isSql = activeTab.value === "sql";
    const content = isSql ? generatedSql.value : generatedJson.value;
    const type = isSql ? "text/sql" : "application/json";
    const filename = isSql ? "schema_export.sql" : "schema_export.json";
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 100);
    toast(`${filename} downloaded!`);
  } catch (e) {
    console.error("Download failed", e);
    toast("Download failed — try copying the content instead", "error");
  }
};

useModalKeyboard(toRef(props, "isOpen"), {
  onEsc: () => emit("close"),
  modalRef,
  onOpen: () => copyBtnRef.value?.focus(),
});
</script>

<template>
  <ModalShell :is-open="isOpen" @close="emit('close')">
    <div
      ref="modalRef"
      class="w-full max-h-[85vh] bg-secondary-900 border border-secondary-800 rounded-3xl overflow-hidden flex flex-col"
    >
      <!-- Header -->
      <div
        class="px-8 py-6 border-b border-secondary-800 flex items-center justify-between bg-secondary-950/30 shrink-0"
      >
        <div class="flex items-center gap-4">
          <div
            class="w-10 h-10 rounded-2xl bg-success-500/10 border border-success-500/20 flex items-center justify-center"
          >
            <svg
              aria-hidden="true"
              class="w-6 h-6 text-success-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 00-2 2z"
              />
            </svg>
          </div>
          <div>
            <h3
              id="export-modal-title"
              class="text-xl font-bold text-secondary-50 tracking-tight"
            >
              Schema Export
            </h3>
            <p
              class="text-xs text-secondary-400 font-medium font-mono uppercase tracking-widest mt-0.5"
            >
              PostgreSQL DDL · JSON Snapshot
            </p>
          </div>
        </div>
        <button
          class="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-secondary-800 text-secondary-500 hover:text-secondary-50 transition-all focus:ring-2 focus:ring-primary-500 focus:outline-none"
          aria-label="Close modal"
          @click="emit('close')"
        >
          <svg
            class="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      <!-- Tab Switcher -->
      <div
        class="px-8 pt-5 pb-0 shrink-0 flex items-center gap-1 border-b border-secondary-800 bg-secondary-950/20"
      >
        <button
          id="export-tab-sql"
          class="relative px-5 py-2.5 text-xs font-bold uppercase tracking-widest rounded-t-xl transition-all focus:outline-none"
          :class="
            activeTab === 'sql'
              ? 'text-success-400 bg-secondary-900 border border-b-0 border-secondary-700'
              : 'text-secondary-500 hover:text-secondary-300 border border-transparent'
          "
          @click="activeTab = 'sql'"
        >
          <span class="flex items-center gap-2">
            <svg
              class="w-3.5 h-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
              />
            </svg>
            SQL
          </span>
        </button>
        <button
          id="export-tab-json"
          class="relative px-5 py-2.5 text-xs font-bold uppercase tracking-widest rounded-t-xl transition-all focus:outline-none"
          :class="
            activeTab === 'json'
              ? 'text-primary-400 bg-secondary-900 border border-b-0 border-secondary-700'
              : 'text-secondary-500 hover:text-secondary-300 border border-transparent'
          "
          @click="activeTab = 'json'"
        >
          <span class="flex items-center gap-2">
            <svg
              class="w-3.5 h-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2zM9 7h6m-6 4h6m-6 4h4"
              />
            </svg>
            JSON
          </span>
        </button>
      </div>

      <!-- Body -->
      <div class="flex-1 overflow-hidden p-8 flex flex-col gap-4">
        <!-- Empty schema warning -->
        <div
          v-if="schemaStore.tables.length === 0"
          class="flex items-start gap-3 px-4 py-3 rounded-xl bg-warning-500/10 border border-warning-500/20 text-warning-400 shrink-0"
        >
          <svg
            class="w-4 h-4 shrink-0 mt-0.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <p class="text-[11px] font-medium leading-relaxed">
            Your schema is empty — there is nothing to export yet.
          </p>
        </div>

        <!-- Two-column layout for SQL tab -->
        <template v-if="activeTab === 'sql'">
          <div class="flex gap-4 flex-1 overflow-hidden">
            <!-- Sidebar -->
            <div
              class="w-60 shrink-0 bg-secondary-950/30 border border-secondary-800 rounded-2xl p-3 overflow-y-auto custom-scrollbar"
              role="listbox"
              aria-label="Entity selection"
            >
              <!-- Sidebar header -->
              <div class="flex items-center justify-between mb-2">
                <span class="text-xs font-bold text-secondary-400 uppercase tracking-wider">
                  Entities ({{ schemaStore.tables.length }})
                </span>
                <div
                  v-if="sqlMode === 'bundle'"
                  data-testid="sidebar-checkbox-selectall"
                  class="flex items-center gap-2 cursor-pointer select-none"
                  :class="bundleAllState === 'none' ? 'text-secondary-600' : 'text-secondary-400'"
                  @click="setBundleAll(bundleAllState !== 'all')"
                >
                  <div
                    class="relative flex items-center justify-center w-4 h-4 rounded border transition-all shrink-0"
                    :class="bundleAllState === 'all'
                      ? 'bg-success-500 border-success-500'
                      : bundleAllState === 'some'
                        ? 'bg-success-500/20 border-success-500/60'
                        : 'bg-secondary-900 border-secondary-600'"
                  >
                    <svg
                      v-if="bundleAllState === 'all'"
                      class="w-2.5 h-2.5 text-secondary-900 pointer-events-none"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="3"
                      viewBox="0 0 24 24"
                    >
                      <path stroke-linecap="round" stroke-linejoin="round" d="M4 12l6 6L20 6" />
                    </svg>
                    <svg
                      v-else-if="bundleAllState === 'some'"
                      class="w-2.5 h-2.5 text-success-400 pointer-events-none"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="3"
                      viewBox="0 0 24 24"
                    >
                      <path stroke-linecap="round" stroke-linejoin="round" d="M5 12h14" />
                    </svg>
                  </div>
                  <span class="text-[11px] font-medium">Select all</span>
                </div>
              </div>

              <!-- Mode rows -->
              <div
                data-testid="sidebar-row-all"
                role="option"
                :aria-selected="sqlMode === 'all'"
                class="px-3 py-2 rounded-lg cursor-pointer transition-all mb-1 flex items-center gap-2"
                :class="
                  sqlMode === 'all'
                    ? 'text-success-400 bg-secondary-900 border border-secondary-700'
                    : 'text-secondary-400 hover:bg-secondary-800/40 border border-transparent'
                "
                @click="enterAll"
              >
                <svg
                  class="w-4 h-4 shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                  />
                </svg>
                <span class="text-xs font-medium">All entities</span>
              </div>

              <div
                data-testid="sidebar-row-bundle"
                role="option"
                :aria-selected="sqlMode === 'bundle'"
                class="px-3 py-2 rounded-lg cursor-pointer transition-all mb-3 flex items-center gap-2"
                :class="
                  sqlMode === 'bundle'
                    ? 'text-success-400 bg-secondary-900 border border-secondary-700'
                    : 'text-secondary-400 hover:bg-secondary-800/40 border border-transparent'
                "
                @click="enterBundle"
              >
                <svg
                  class="w-4 h-4 shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                <span class="text-xs font-medium">Bundle subset…</span>
              </div>

              <!-- Divider -->
              <div class="h-px bg-secondary-800 mb-2" />

              <!-- Entity list -->
              <div
                v-for="table in schemaStore.tables"
                :key="table.id"
                :data-testid="`sidebar-row-entity-${table.id}`"
                role="option"
                :aria-selected="sqlMode === 'single' && viewedEntityId === table.id"
                class="group flex items-center gap-2 px-3 py-2 rounded-lg transition-all"
                :class="
                  sqlMode === 'single' && viewedEntityId === table.id
                    ? 'text-success-400 bg-secondary-900 border border-secondary-700 cursor-pointer'
                    : sqlMode === 'bundle'
                      ? 'text-secondary-300 hover:bg-secondary-800/60 border border-transparent cursor-pointer'
                      : 'text-secondary-400 hover:bg-secondary-800/40 border border-transparent cursor-pointer'
                "
                @click="sqlMode === 'bundle' ? toggleBundle(table.id) : enterSingle(table.id)"
              >
                <!-- Bundle checkbox -->
                <div
                  v-if="sqlMode === 'bundle'"
                  class="relative flex items-center justify-center w-4 h-4 rounded border transition-all"
                  :class="bundleSelectedIds.has(table.id)
                      ? 'bg-success-500 border-success-500'
                      : 'bg-secondary-900 border-secondary-600 group-hover:border-secondary-500'"
                  @click.stop
                >
                  <svg
                    v-if="bundleSelectedIds.has(table.id)"
                    class="w-2.5 h-2.5 text-secondary-900 pointer-events-none"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="3"
                    viewBox="0 0 24 24"
                  >
                    <path stroke-linecap="round" stroke-linejoin="round" d="M4 12l6 6L20 6" />
                  </svg>
                </div>

                <div class="flex-1 min-w-0">
                  <div class="text-xs font-medium truncate">{{ table.name }}</div>
                </div>

                <!-- Count badge -->
                <div class="shrink-0 font-mono tabular-nums text-[11px] text-secondary-500">
                  {{ entityCounts[table.id]?.c ?? 0 }}c·{{ entityCounts[table.id]?.i ?? 0 }}i·{{ entityCounts[table.id]?.fk ?? 0 }}fk
                </div>
              </div>
            </div>

            <!-- Preview column -->
            <div class="flex-1 flex flex-col gap-4 overflow-hidden">
              <!-- Broken reference warning -->
              <div
                v-if="hasBrokenExport"
                class="flex items-start gap-3 px-4 py-3 rounded-xl bg-warning-500/10 border border-warning-500/20 text-warning-400 shrink-0"
              >
                <svg
                  class="w-4 h-4 shrink-0 mt-0.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
                <p class="text-[11px] font-medium leading-relaxed">
                  Some foreign keys or indexes reference columns that no longer exist
                  and will be skipped. Check the
                  <code class="font-mono">-- WARNING</code> comments in the SQL
                  output.
                </p>
              </div>

              <!-- Cross-boundary warning -->
              <div
                v-if="sqlMode === 'bundle' && crossBoundaryCount > 0"
                data-testid="banner-cross-boundary"
                class="flex items-start gap-3 px-4 py-3 rounded-xl bg-warning-500/10 border border-warning-500/20 text-warning-400 shrink-0"
              >
                <svg
                  class="w-4 h-4 shrink-0 mt-0.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
                <p class="text-[11px] font-medium leading-relaxed">
                  {{ crossBoundaryCount }} foreign key{{ crossBoundaryCount === 1 ? '' : 's' }} reference{{ crossBoundaryCount === 1 ? 's' : '' }} entities not in this selection — included anyway. See <code class="font-mono">-- WARNING</code> comments.
                </p>
              </div>

              <!-- SQL preview -->
              <div class="flex-1 relative group">
                <div
                  class="absolute -inset-1 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200 bg-linear-to-r from-primary-500/20 to-success-500/20"
                />
                <textarea
                  :value="generatedSql"
                  readonly
                  aria-label="Generated SQL Code"
                  class="relative w-full h-full bg-secondary-950 border border-secondary-800 rounded-2xl p-6 text-sm font-mono text-secondary-300 focus:outline-none focus:border-primary-500/50 resize-none leading-relaxed selection:bg-primary-500/30 custom-scrollbar"
                />
              </div>
            </div>
          </div>
        </template>

        <!-- JSON tab: single-column layout -->
        <template v-else>
          <div class="flex-1 relative group">
            <div
              class="absolute -inset-1 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200 bg-linear-to-r from-primary-500/20 to-info-500/20"
            />
            <textarea
              :value="generatedJson"
              readonly
              aria-label="Generated JSON"
              class="relative w-full h-full bg-secondary-950 border border-secondary-800 rounded-2xl p-6 text-sm font-mono text-secondary-300 focus:outline-none focus:border-primary-500/50 resize-none leading-relaxed selection:bg-primary-500/30 custom-scrollbar"
            />
          </div>
        </template>
      </div>

      <!-- Footer -->
      <div
        class="px-8 py-6 border-t border-secondary-800 bg-secondary-950/30 shrink-0 flex gap-4"
      >
        <!-- SQL tab: three buttons -->
        <template v-if="activeTab === 'sql'">
          <button
            ref="copyBtnRef"
            data-testid="footer-btn-copy"
            :disabled="!canCopy"
            class="flex-1 bg-secondary-800 hover:bg-secondary-700 text-secondary-50 font-bold py-4 rounded-xl transition-all shadow-lg active:scale-[0.98] flex items-center justify-center gap-3 focus:ring-2 focus:ring-secondary-500 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Copy to clipboard"
            @click="copyToClipboard"
          >
            <svg
              aria-hidden="true"
              class="w-5 h-5 opacity-70"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
              />
            </svg>
            Copy
          </button>
          <button
            data-testid="footer-btn-sql"
            :disabled="!canDownloadSql"
            class="px-10 font-bold py-4 rounded-xl transition-all shadow-xl active:scale-[0.98] flex items-center justify-center gap-3 focus:ring-2 focus:ring-primary-500 focus:outline-none text-white bg-linear-to-r from-primary-500 to-primary-700 hover:from-primary-400 hover:to-primary-600 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Export SQL file"
            @click="downloadSqlFile"
          >
            <svg
              aria-hidden="true"
              class="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
            Download .SQL
          </button>
          <button
            data-testid="footer-btn-zip"
            :disabled="!canDownloadZip"
            :aria-disabled="!canDownloadZip"
            :title="zipDisabledTooltip"
            class="px-10 font-bold py-4 rounded-xl transition-all shadow-xl active:scale-[0.98] flex items-center justify-center gap-3 focus:ring-2 focus:ring-success-500 focus:outline-none text-white bg-linear-to-r from-success-500 to-success-700 hover:from-success-400 hover:to-success-600 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Export ZIP file"
            @click="downloadZipFile"
          >
            <svg
              aria-hidden="true"
              class="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
              />
            </svg>
            Download .ZIP
          </button>
        </template>

        <!-- JSON tab: two buttons -->
        <template v-else>
          <button
            ref="copyBtnRef"
            class="flex-1 bg-secondary-800 hover:bg-secondary-700 text-secondary-50 font-bold py-4 rounded-xl transition-all shadow-lg active:scale-[0.98] flex items-center justify-center gap-3 focus:ring-2 focus:ring-secondary-500 focus:outline-none"
            aria-label="Copy to clipboard"
            @click="copyToClipboard"
          >
            <svg
              aria-hidden="true"
              class="w-5 h-5 opacity-70"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
              />
            </svg>
            Copy Snippet
          </button>
          <button
            class="px-12 font-bold py-4 rounded-xl transition-all shadow-xl active:scale-[0.98] flex items-center justify-center gap-3 focus:ring-2 focus:ring-info-500 focus:outline-none text-white bg-linear-to-r from-info-500 to-info-700 hover:from-info-400 hover:to-info-600"
            aria-label="Export JSON file"
            @click="downloadFile"
          >
            <svg
              aria-hidden="true"
              class="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
            Export .JSON
          </button>
        </template>
      </div>
    </div>
  </ModalShell>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 8px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: rgba(15, 23, 42, 0.5);
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #334155;
  border-radius: 10px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #475569;
}
</style>
