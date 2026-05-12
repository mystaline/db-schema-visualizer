<script setup lang="ts">
import { computed, ref, toRef } from "vue";
import { useSchemaStore } from "../stores/schemaStore";
import { useToast } from "../composables/useToast";
import ModalShell from "./ModalShell.vue";
import { useModalKeyboard } from "../composables/useModalKeyboard";

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

// ---- SQL Generation ----
const generatedSql = computed(() => {
  let sql = `-- Database Schema SQL Export\n`;
  sql += `-- Generated on ${new Date().toLocaleString()}\n\n`;

  schemaStore.tables.forEach((table) => {
    // Table notes as SQL comments
    if (table.notes?.trim()) {
      table.notes
        .trim()
        .split("\n")
        .forEach((line) => {
          sql += `-- ${line}\n`;
        });
    }

    sql += `CREATE TABLE ${table.name} (\n`;
    const lines: string[] = [];

    table.columns.forEach((col) => {
      let line = `  ${col.name} ${col.type}`;
      if (!col.isNullable) line += " NOT NULL";
      if (col.isUnique) line += " UNIQUE";
      if (col.defaultValue) line += ` DEFAULT ${col.defaultValue}`;
      lines.push(line);
    });

    const pks = table.columns.filter((c) => c.isPrimaryKey).map((c) => c.name);
    if (pks.length > 0) {
      lines.push(`  PRIMARY KEY (${pks.join(", ")})`);
    }

    table.checkConstraints.forEach((constraint) => {
      lines.push(
        `  CONSTRAINT ${constraint.name} CHECK (${constraint.expression})`,
      );
    });

    sql += lines.join(",\n");
    sql += `\n);`;

    // Foreign Keys where this table is the source
    const tableFKs = schemaStore.foreignKeys.filter(
      (fk) => fk.sourceTableId === table.id,
    );

    tableFKs.forEach((fk) => {
      const targetTable = schemaStore.tables.find(
        (t) => t.id === fk.targetTableId,
      );

      if (targetTable) {
        const sourceCol = table.columns.find((c) => c.id === fk.sourceColumnId);
        const targetCol = targetTable.columns.find(
          (c) => c.id === fk.targetColumnId,
        );

        if (sourceCol && targetCol) {
          sql += `\n\nALTER TABLE ${table.name}\n`;
          sql += `  ADD CONSTRAINT fk_${table.name}_${sourceCol.name}\n`;
          sql += `  FOREIGN KEY (${sourceCol.name}) REFERENCES ${targetTable.name} (${targetCol.name})\n`;
          sql += `  ON DELETE ${fk.onDelete} ON UPDATE ${fk.onUpdate};`;
        } else {
          sql += `\n-- WARNING: foreign key between ${table.name} and ${targetTable.name} was skipped (column reference is broken)`;
        }
      }
    });

    // Indexes on this table
    table.indexes.forEach((idx) => {
      const parts: string[] = [];

      (idx.parts ?? []).forEach((part) => {
        if (part.type === "column") {
          const name = table.columns.find((c) => c.id === part.value)?.name;
          if (name) {
            parts.push(part.order === "DESC" ? `${name} DESC` : name);
          }
        } else {
          if (part.value.trim()) {
            parts.push(
              part.order === "DESC"
                ? `(${part.value.trim()}) DESC`
                : part.value.trim(),
            );
          }
        }
      });

      if (parts.length > 0) {
        const uniqueStr = idx.type === "unique" ? " UNIQUE" : "";
        const whereStr = idx.filter ? ` WHERE ${idx.filter}` : "";
        sql += `\n\nCREATE${uniqueStr} INDEX ${idx.name} ON ${table.name} (${parts.join(", ")})${whereStr};`;
      } else if ((idx.parts ?? []).length > 0) {
        sql += `\n-- WARNING: index ${idx.name} on ${table.name} was skipped (all column references are broken)`;
      }
    });

    sql += `\n\n`;
  });

  return sql;
});

// Detect broken FK/index references so we can warn in the UI
const hasBrokenExport = computed(() => {
  const fkBroken = schemaStore.foreignKeys.some((fk) => {
    const src = schemaStore.tables.find((t) => t.id === fk.sourceTableId);
    const tgt = schemaStore.tables.find((t) => t.id === fk.targetTableId);
    if (!src || !tgt) return true;
    return (
      !src.columns.find((c) => c.id === fk.sourceColumnId) ||
      !tgt.columns.find((c) => c.id === fk.targetColumnId)
    );
  });
  if (fkBroken) return true;
  return schemaStore.tables.some((table) =>
    table.indexes.some((idx) =>
      (idx.parts ?? []).some(
        (part) =>
          part.type === "column" &&
          !table.columns.find((c) => c.id === part.value),
      ),
    ),
  );
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
        <!-- Broken reference warning -->
        <div
          v-if="hasBrokenExport && activeTab === 'sql'"
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
        <div class="flex-1 relative group">
          <div
            class="absolute -inset-1 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"
            :class="
              activeTab === 'sql'
                ? 'bg-linear-to-r from-primary-500/20 to-success-500/20'
                : 'bg-linear-to-r from-primary-500/20 to-info-500/20'
            "
          />
          <textarea
            :value="activeContent"
            readonly
            :aria-label="
              activeTab === 'sql' ? 'Generated SQL Code' : 'Generated JSON'
            "
            class="relative w-full h-full bg-secondary-950 border border-secondary-800 rounded-2xl p-6 text-sm font-mono text-secondary-300 focus:outline-none focus:border-primary-500/50 resize-none leading-relaxed selection:bg-primary-500/30 custom-scrollbar"
          />
        </div>
      </div>

      <!-- Footer -->
      <div
        class="px-8 py-6 border-t border-secondary-800 bg-secondary-950/30 shrink-0 flex gap-4"
      >
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
          class="px-12 font-bold py-4 rounded-xl transition-all shadow-xl active:scale-[0.98] flex items-center justify-center gap-3 focus:ring-2 focus:ring-primary-500 focus:outline-none text-white"
          :class="
            activeTab === 'sql'
              ? 'bg-linear-to-r from-primary-500 to-primary-700 hover:from-primary-400 hover:to-primary-600'
              : 'bg-linear-to-r from-info-500 to-info-700 hover:from-info-400 hover:to-info-600'
          "
          :aria-label="
            activeTab === 'sql' ? 'Export SQL file' : 'Export JSON file'
          "
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
          {{ activeTab === "sql" ? "Export .SQL" : "Export .JSON" }}
        </button>
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
