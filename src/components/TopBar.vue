<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import { useSchemaStore } from "../stores/schemaStore";
import { useToast } from "../composables/useToast";
import { useTheme } from "../composables/useTheme";
import { useHistory } from "../composables/useHistory";
import SqlExportModal from "./SqlExportModal.vue";

const schemaStore = useSchemaStore();
const { toast } = useToast();
const { isDark, toggleTheme } = useTheme();
const { undo, redo, canUndo, canRedo } = useHistory();
const isExportOpen = ref(false);
const showShareMenu = ref(false);
const isMobileMenuOpen = ref(false);
const shareMenuRef = ref<HTMLElement | null>(null);

// Two-click preset confirmation
const pendingPreset = ref<"blog" | "ecommerce" | null>(null);
let presetTimer: ReturnType<typeof setTimeout> | null = null;

const handleShare = async (permission: "full" | "read") => {
  showShareMenu.value = false;
  isMobileMenuOpen.value = false;
  try {
    const base64 = await schemaStore.getShareableData(permission);
    const url = `${window.location.origin}${window.location.pathname}#data=${base64}`;
    await navigator.clipboard.writeText(url);
    const label = permission === "read" ? "Read Only" : "Full Access";
    toast(`${label} link copied to clipboard!`);
  } catch (err) {
    console.error("Share URL generation failed", err);
    toast("Failed to generate share URL", "error");
  }
};

const closeShareMenu = (e: MouseEvent) => {
  if (shareMenuRef.value && !shareMenuRef.value.contains(e.target as Node)) {
    showShareMenu.value = false;
  }
};

onMounted(() => document.addEventListener("mousedown", closeShareMenu));
onUnmounted(() => {
  document.removeEventListener("mousedown", closeShareMenu);
  if (presetTimer) clearTimeout(presetTimer);
});

const loadPreset = (type: "blog" | "ecommerce") => {
  if (pendingPreset.value === type) {
    // Second click — confirmed
    if (presetTimer) clearTimeout(presetTimer);
    pendingPreset.value = null;
    executePreset(type);
    isMobileMenuOpen.value = false;
    return;
  }

  // First click — arm confirmation
  pendingPreset.value = type;
  presetTimer = setTimeout(() => {
    pendingPreset.value = null;
  }, 3000);
};

const executePreset = (type: "blog" | "ecommerce") => {
  schemaStore.tables = [];
  schemaStore.foreignKeys = [];

  if (type === "blog") {
    const userId = crypto.randomUUID();
    const postId = crypto.randomUUID();
    const tagId = crypto.randomUUID();
    const postTagId = crypto.randomUUID();
    const commentId = crypto.randomUUID();

    // Pre-generate column IDs we need for FKs and indexes
    const userPkId = crypto.randomUUID();
    const userEmailId = crypto.randomUUID();
    const userUsernameId = crypto.randomUUID();

    const postPkId = crypto.randomUUID();
    const postAuthorId = crypto.randomUUID();
    const postSlugId = crypto.randomUUID();
    const postStatusId = crypto.randomUUID();
    const postPublishedId = crypto.randomUUID();

    const tagPkId = crypto.randomUUID();
    const tagSlugId = crypto.randomUUID();

    const postTagPostId = crypto.randomUUID();
    const postTagTagId = crypto.randomUUID();

    const commentPkId = crypto.randomUUID();
    const commentPostId = crypto.randomUUID();
    const commentAuthorId = crypto.randomUUID();
    const commentParentId = crypto.randomUUID();

    schemaStore.tables.push({
      id: userId,
      name: "users",
      x: 80,
      y: 180,
      columns: [
        {
          id: userPkId,
          name: "id",
          type: "uuid",
          isPrimaryKey: true,
          isNullable: false,
          isUnique: true,
          defaultValue: "gen_random_uuid()",
        },
        {
          id: userEmailId,
          name: "email",
          type: "varchar",
          isPrimaryKey: false,
          isNullable: false,
          isUnique: true,
          defaultValue: null,
        },
        {
          id: userUsernameId,
          name: "username",
          type: "varchar",
          isPrimaryKey: false,
          isNullable: false,
          isUnique: true,
          defaultValue: null,
        },
        {
          id: crypto.randomUUID(),
          name: "password_hash",
          type: "varchar",
          isPrimaryKey: false,
          isNullable: false,
          isUnique: false,
          defaultValue: null,
        },
        {
          id: crypto.randomUUID(),
          name: "role",
          type: "varchar",
          isPrimaryKey: false,
          isNullable: false,
          isUnique: false,
          defaultValue: "'author'",
        },
        {
          id: crypto.randomUUID(),
          name: "created_at",
          type: "timestamptz",
          isPrimaryKey: false,
          isNullable: false,
          isUnique: false,
          defaultValue: "now()",
        },
      ],
      indexes: [
        {
          id: crypto.randomUUID(),
          name: "idx_users_email",
          type: "normal",
          parts: [{ type: "column", value: userEmailId, order: "ASC" }],
          filter: "",
        },
        {
          id: crypto.randomUUID(),
          name: "idx_users_username",
          type: "normal",
          parts: [{ type: "column", value: userUsernameId, order: "ASC" }],
          filter: "",
        },
      ],
      checkConstraints: [
        {
          id: crypto.randomUUID(),
          name: "chk_users_role",
          expression: "role IN ('admin', 'author', 'reader')",
        },
      ],
    });

    schemaStore.tables.push({
      id: postId,
      name: "posts",
      x: 480,
      y: 80,
      columns: [
        {
          id: postPkId,
          name: "id",
          type: "uuid",
          isPrimaryKey: true,
          isNullable: false,
          isUnique: true,
          defaultValue: "gen_random_uuid()",
        },
        {
          id: postAuthorId,
          name: "author_id",
          type: "uuid",
          isPrimaryKey: false,
          isNullable: false,
          isUnique: false,
          defaultValue: null,
        },
        {
          id: postSlugId,
          name: "slug",
          type: "varchar",
          isPrimaryKey: false,
          isNullable: false,
          isUnique: true,
          defaultValue: null,
        },
        {
          id: postStatusId,
          name: "status",
          type: "varchar",
          isPrimaryKey: false,
          isNullable: false,
          isUnique: false,
          defaultValue: "'draft'",
        },
        {
          id: crypto.randomUUID(),
          name: "title",
          type: "varchar",
          isPrimaryKey: false,
          isNullable: false,
          isUnique: false,
          defaultValue: null,
        },
        {
          id: crypto.randomUUID(),
          name: "content",
          type: "text",
          isPrimaryKey: false,
          isNullable: true,
          isUnique: false,
          defaultValue: null,
        },
        {
          id: postPublishedId,
          name: "published_at",
          type: "timestamptz",
          isPrimaryKey: false,
          isNullable: true,
          isUnique: false,
          defaultValue: null,
        },
        {
          id: crypto.randomUUID(),
          name: "created_at",
          type: "timestamptz",
          isPrimaryKey: false,
          isNullable: false,
          isUnique: false,
          defaultValue: "now()",
        },
      ],
      indexes: [
        {
          id: crypto.randomUUID(),
          name: "idx_posts_author_id",
          type: "normal",
          parts: [{ type: "column", value: postAuthorId, order: "ASC" }],
          filter: "",
        },
        {
          id: crypto.randomUUID(),
          name: "unq_posts_slug",
          type: "unique",
          parts: [{ type: "column", value: postSlugId, order: "ASC" }],
          filter: "",
        },
        {
          id: crypto.randomUUID(),
          name: "idx_posts_published_at",
          type: "normal",
          parts: [{ type: "column", value: postPublishedId, order: "ASC" }],
          filter: "status = 'published'",
        },
      ],
      checkConstraints: [
        {
          id: crypto.randomUUID(),
          name: "chk_posts_status",
          expression: "status IN ('draft', 'published', 'archived')",
        },
      ],
    });

    schemaStore.tables.push({
      id: tagId,
      name: "tags",
      x: 480,
      y: 500,
      columns: [
        {
          id: tagPkId,
          name: "id",
          type: "uuid",
          isPrimaryKey: true,
          isNullable: false,
          isUnique: true,
          defaultValue: "gen_random_uuid()",
        },
        {
          id: tagSlugId,
          name: "slug",
          type: "varchar",
          isPrimaryKey: false,
          isNullable: false,
          isUnique: true,
          defaultValue: null,
        },
        {
          id: crypto.randomUUID(),
          name: "name",
          type: "varchar",
          isPrimaryKey: false,
          isNullable: false,
          isUnique: true,
          defaultValue: null,
        },
      ],
      indexes: [
        {
          id: crypto.randomUUID(),
          name: "unq_tags_slug",
          type: "unique",
          parts: [{ type: "column", value: tagSlugId, order: "ASC" }],
          filter: "",
        },
      ],
      checkConstraints: [],
    });

    schemaStore.tables.push({
      id: postTagId,
      name: "post_tags",
      x: 860,
      y: 280,
      columns: [
        {
          id: postTagPostId,
          name: "post_id",
          type: "uuid",
          isPrimaryKey: false,
          isNullable: false,
          isUnique: false,
          defaultValue: null,
        },
        {
          id: postTagTagId,
          name: "tag_id",
          type: "uuid",
          isPrimaryKey: false,
          isNullable: false,
          isUnique: false,
          defaultValue: null,
        },
      ],
      indexes: [
        {
          id: crypto.randomUUID(),
          name: "idx_post_tags_post_id",
          type: "normal",
          parts: [{ type: "column", value: postTagPostId, order: "ASC" }],
          filter: "",
        },
        {
          id: crypto.randomUUID(),
          name: "idx_post_tags_tag_id",
          type: "normal",
          parts: [{ type: "column", value: postTagTagId, order: "ASC" }],
          filter: "",
        },
      ],
      checkConstraints: [],
    });

    schemaStore.tables.push({
      id: commentId,
      name: "comments",
      x: 860,
      y: 520,
      columns: [
        {
          id: commentPkId,
          name: "id",
          type: "uuid",
          isPrimaryKey: true,
          isNullable: false,
          isUnique: true,
          defaultValue: "gen_random_uuid()",
        },
        {
          id: commentPostId,
          name: "post_id",
          type: "uuid",
          isPrimaryKey: false,
          isNullable: false,
          isUnique: false,
          defaultValue: null,
        },
        {
          id: commentAuthorId,
          name: "author_id",
          type: "uuid",
          isPrimaryKey: false,
          isNullable: true,
          isUnique: false,
          defaultValue: null,
        },
        {
          id: commentParentId,
          name: "parent_id",
          type: "uuid",
          isPrimaryKey: false,
          isNullable: true,
          isUnique: false,
          defaultValue: null,
        },
        {
          id: crypto.randomUUID(),
          name: "content",
          type: "text",
          isPrimaryKey: false,
          isNullable: false,
          isUnique: false,
          defaultValue: null,
        },
        {
          id: crypto.randomUUID(),
          name: "created_at",
          type: "timestamptz",
          isPrimaryKey: false,
          isNullable: false,
          isUnique: false,
          defaultValue: "now()",
        },
      ],
      indexes: [
        {
          id: crypto.randomUUID(),
          name: "idx_comments_post_id",
          type: "normal",
          parts: [{ type: "column", value: commentPostId, order: "ASC" }],
          filter: "",
        },
        {
          id: crypto.randomUUID(),
          name: "idx_comments_author_id",
          type: "normal",
          parts: [{ type: "column", value: commentAuthorId, order: "ASC" }],
          filter: "author_id IS NOT NULL",
        },
      ],
      checkConstraints: [],
    });

    // FKs
    schemaStore.addForeignKey({
      sourceTableId: postId,
      sourceColumnId: postAuthorId,
      targetTableId: userId,
      targetColumnId: userPkId,
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    });
    schemaStore.addForeignKey({
      sourceTableId: postTagId,
      sourceColumnId: postTagPostId,
      targetTableId: postId,
      targetColumnId: postPkId,
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    });
    schemaStore.addForeignKey({
      sourceTableId: postTagId,
      sourceColumnId: postTagTagId,
      targetTableId: tagId,
      targetColumnId: tagPkId,
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    });
    schemaStore.addForeignKey({
      sourceTableId: commentId,
      sourceColumnId: commentPostId,
      targetTableId: postId,
      targetColumnId: postPkId,
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    });
    schemaStore.addForeignKey({
      sourceTableId: commentId,
      sourceColumnId: commentAuthorId,
      targetTableId: userId,
      targetColumnId: userPkId,
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    });
    schemaStore.addForeignKey({
      sourceTableId: commentId,
      sourceColumnId: commentParentId,
      targetTableId: commentId,
      targetColumnId: commentPkId,
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    });
  }

  if (type === "ecommerce") {
    const customerId = crypto.randomUUID();
    const productId = crypto.randomUUID();
    const orderId = crypto.randomUUID();
    const orderItemId = crypto.randomUUID();

    const customerPkId = crypto.randomUUID();
    const customerEmailColId = crypto.randomUUID();
    const productPkId = crypto.randomUUID();
    const productNameColId = crypto.randomUUID();
    const orderPkId = crypto.randomUUID();
    const orderItemPkId = crypto.randomUUID();
    const orderCustomerColId = crypto.randomUUID();
    const orderStatusColId = crypto.randomUUID();
    const orderItemOrderColId = crypto.randomUUID();
    const orderItemProductColId = crypto.randomUUID();

    schemaStore.tables.push({
      id: customerId,
      name: "customers",
      x: 100,
      y: 150,
      columns: [
        {
          id: customerPkId,
          name: "id",
          type: "uuid",
          isPrimaryKey: true,
          isNullable: false,
          isUnique: true,
          defaultValue: "gen_random_uuid()",
        },
        {
          id: customerEmailColId,
          name: "email",
          type: "varchar",
          isPrimaryKey: false,
          isNullable: false,
          isUnique: true,
          defaultValue: null,
        },
        {
          id: crypto.randomUUID(),
          name: "full_name",
          type: "varchar",
          isPrimaryKey: false,
          isNullable: false,
          isUnique: false,
          defaultValue: null,
        },
      ],
      indexes: [
        {
          id: crypto.randomUUID(),
          name: "unq_customers_email",
          type: "unique",
          parts: [{ type: "column", value: customerEmailColId, order: "ASC" }],
          filter: "",
        },
      ],
      checkConstraints: [],
    });

    schemaStore.tables.push({
      id: productId,
      name: "products",
      x: 550,
      y: 100,
      columns: [
        {
          id: productPkId,
          name: "id",
          type: "uuid",
          isPrimaryKey: true,
          isNullable: false,
          isUnique: true,
          defaultValue: "gen_random_uuid()",
        },
        {
          id: productNameColId,
          name: "name",
          type: "varchar",
          isPrimaryKey: false,
          isNullable: false,
          isUnique: false,
          defaultValue: null,
        },
        {
          id: crypto.randomUUID(),
          name: "price",
          type: "numeric",
          isPrimaryKey: false,
          isNullable: false,
          isUnique: false,
          defaultValue: null,
        },
        {
          id: crypto.randomUUID(),
          name: "stock",
          type: "int",
          isPrimaryKey: false,
          isNullable: false,
          isUnique: false,
          defaultValue: "0",
        },
      ],
      indexes: [
        {
          id: crypto.randomUUID(),
          name: "idx_products_name",
          type: "normal",
          parts: [{ type: "column", value: productNameColId, order: "ASC" }],
          filter: "",
        },
      ],
      checkConstraints: [
        {
          id: crypto.randomUUID(),
          name: "chk_products_price",
          expression: "price > 0",
        },
        {
          id: crypto.randomUUID(),
          name: "chk_products_stock",
          expression: "stock >= 0",
        },
      ],
    });

    schemaStore.tables.push({
      id: orderId,
      name: "orders",
      x: 300,
      y: 350,
      columns: [
        {
          id: orderPkId,
          name: "id",
          type: "uuid",
          isPrimaryKey: true,
          isNullable: false,
          isUnique: true,
          defaultValue: "gen_random_uuid()",
        },
        {
          id: orderCustomerColId,
          name: "customer_id",
          type: "uuid",
          isPrimaryKey: false,
          isNullable: false,
          isUnique: false,
          defaultValue: null,
        },
        {
          id: orderStatusColId,
          name: "status",
          type: "varchar",
          isPrimaryKey: false,
          isNullable: false,
          isUnique: false,
          defaultValue: "'pending'",
        },
        {
          id: crypto.randomUUID(),
          name: "created_at",
          type: "timestamptz",
          isPrimaryKey: false,
          isNullable: false,
          isUnique: false,
          defaultValue: "now()",
        },
      ],
      indexes: [
        {
          id: crypto.randomUUID(),
          name: "idx_orders_customer_id",
          type: "normal",
          parts: [{ type: "column", value: orderCustomerColId, order: "ASC" }],
          filter: "",
        },
        {
          id: crypto.randomUUID(),
          name: "idx_orders_status",
          type: "normal",
          parts: [{ type: "column", value: orderStatusColId, order: "ASC" }],
          filter: "",
        },
      ],
      checkConstraints: [],
    });

    schemaStore.tables.push({
      id: orderItemId,
      name: "order_items",
      x: 650,
      y: 380,
      columns: [
        {
          id: orderItemPkId,
          name: "id",
          type: "uuid",
          isPrimaryKey: true,
          isNullable: false,
          isUnique: true,
          defaultValue: "gen_random_uuid()",
        },
        {
          id: orderItemOrderColId,
          name: "order_id",
          type: "uuid",
          isPrimaryKey: false,
          isNullable: false,
          isUnique: false,
          defaultValue: null,
        },
        {
          id: orderItemProductColId,
          name: "product_id",
          type: "uuid",
          isPrimaryKey: false,
          isNullable: false,
          isUnique: false,
          defaultValue: null,
        },
        {
          id: crypto.randomUUID(),
          name: "quantity",
          type: "int",
          isPrimaryKey: false,
          isNullable: false,
          isUnique: false,
          defaultValue: "1",
        },
      ],
      indexes: [
        {
          id: crypto.randomUUID(),
          name: "idx_order_items_order_id",
          type: "normal",
          parts: [{ type: "column", value: orderItemOrderColId, order: "ASC" }],
          filter: "",
        },
        {
          id: crypto.randomUUID(),
          name: "idx_order_items_product_id",
          type: "normal",
          parts: [{ type: "column", value: orderItemProductColId, order: "ASC" }],
          filter: "",
        },
      ],
      checkConstraints: [
        {
          id: crypto.randomUUID(),
          name: "chk_order_items_quantity",
          expression: "quantity > 0",
        },
      ],
    });

    schemaStore.addForeignKey({
      sourceTableId: orderId,
      sourceColumnId: orderCustomerColId,
      targetTableId: customerId,
      targetColumnId: customerPkId,
      onDelete: "RESTRICT",
      onUpdate: "CASCADE",
    });
    schemaStore.addForeignKey({
      sourceTableId: orderItemId,
      sourceColumnId: orderItemOrderColId,
      targetTableId: orderId,
      targetColumnId: orderPkId,
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    });
    schemaStore.addForeignKey({
      sourceTableId: orderItemId,
      sourceColumnId: orderItemProductColId,
      targetTableId: productId,
      targetColumnId: productPkId,
      onDelete: "RESTRICT",
      onUpdate: "CASCADE",
    });
  }

  toast(`${type.charAt(0).toUpperCase() + type.slice(1)} preset loaded!`);
};
</script>

<template>
  <header
    class="relative px-4 lg:px-8 py-4 flex items-center justify-between z-99901 overflow-visible"
  >
    <div class="flex items-center gap-4 lg:gap-6">
      <div class="flex items-center gap-3">
        <div
          class="w-10 h-10 rounded-2xl bg-linear-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-lg shadow-primary-500/20 active:scale-95 transition-transform cursor-pointer"
        >
          <svg
            class="w-6 h-6 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="3"
              d="M4 7v10c0 1.105 4.477 2 10 2s10-.895 10-2V7M4 7c0 1.105 4.477 2 10 2s10-.895 10-2M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"
            />
          </svg>
        </div>
        <h1
          class="text-xl font-bold tracking-tight text-secondary-50 font-mono uppercase"
        >
          <span class="hidden sm:inline">SCHEMA</span
          ><span class="text-primary-400">VIS</span>
        </h1>
      </div>

      <div class="hidden lg:block h-6 w-px bg-secondary-800" />

      <!-- View Only Badge -->
      <div
        v-if="schemaStore.viewMode === 'read'"
        class="px-2 lg:px-3 py-1 rounded-lg bg-warning-500/10 border border-warning-500/20 text-warning-400 text-[9px] lg:text-[10px] font-bold uppercase tracking-widest"
      >
        Read Only
      </div>

      <!-- Presets (Desktop Only) -->
      <div
        v-if="schemaStore.viewMode === 'full'"
        class="hidden lg:flex items-center gap-3"
      >
        <span
          class="text-[10px] font-bold text-secondary-400 uppercase tracking-widest"
          >Presets:</span
        >
        <button
          class="text-xs font-bold transition-all uppercase tracking-tight px-3 py-1.5 rounded-lg border"
          :class="
            pendingPreset === 'blog'
              ? 'bg-warning-500/20 border-warning-500/50 text-warning-400 animate-pulse'
              : 'text-secondary-400 hover:text-primary-400 border-transparent hover:bg-secondary-800'
          "
          @click="loadPreset('blog')"
        >
          {{ pendingPreset === "blog" ? "Confirm?" : "Blog" }}
        </button>
        <button
          class="text-xs font-bold transition-all uppercase tracking-tight px-3 py-1.5 rounded-lg border"
          :class="
            pendingPreset === 'ecommerce'
              ? 'bg-warning-500/20 border-warning-500/50 text-warning-400 animate-pulse'
              : 'text-secondary-400 hover:text-primary-400 border-transparent hover:bg-secondary-800'
          "
          @click="loadPreset('ecommerce')"
        >
          {{ pendingPreset === "ecommerce" ? "Confirm?" : "Shop" }}
        </button>
      </div>

      <div class="hidden sm:block w-px h-6 bg-secondary-800 mx-1" />

      <!-- Undo / Redo (Unified Visibility) -->
      <div
        v-if="schemaStore.viewMode === 'full'"
        class="flex items-center gap-1 shrink-0"
      >
        <button
          :disabled="!canUndo"
          class="w-8 h-8 lg:w-9 lg:h-9 flex items-center justify-center rounded-lg bg-secondary-800 hover:bg-secondary-700 border border-secondary-700 text-secondary-300 disabled:opacity-20 active:scale-90 transition-all"
          aria-label="Undo"
          @click="undo"
        >
          <svg
            class="w-4 h-4 lg:w-4.5 lg:h-4.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
            />
          </svg>
        </button>
        <button
          :disabled="!canRedo"
          class="w-8 h-8 lg:w-9 lg:h-9 flex items-center justify-center rounded-lg bg-secondary-800 hover:bg-secondary-700 border border-secondary-700 text-secondary-300 disabled:opacity-20 active:scale-90 transition-all"
          aria-label="Redo"
          @click="redo"
        >
          <svg
            class="w-4 h-4 lg:w-4.5 lg:h-4.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M21 10h-10a8 8 0 00-8 8v2m18-10l-6 6m6-6l-6-6"
            />
          </svg>
        </button>
      </div>
    </div>

    <!-- Actions -->
    <div class="flex items-center gap-2 lg:gap-4">
      <!-- Desktop Share Dropdown -->
      <div
        v-if="schemaStore.viewMode === 'full'"
        ref="shareMenuRef"
        class="relative hidden lg:block"
      >
        <button
          class="flex items-center gap-2 group focus:outline-none"
          @click="showShareMenu = !showShareMenu"
        >
          <div
            class="w-8 h-8 rounded-lg bg-secondary-800 group-hover:bg-primary-500/20 border border-transparent flex items-center justify-center transition-all"
          >
            <svg
              class="w-4 h-4 text-secondary-400 group-hover:text-primary-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
              />
            </svg>
          </div>
          <span
            class="text-xs font-bold text-secondary-400 group-hover:text-secondary-50"
            >Share</span
          >
        </button>
        <Transition
          enter-active-class="transition ease-out duration-150"
          enter-from-class="opacity-0 translate-y-1"
          enter-to-class="opacity-100 translate-y-0"
          leave-active-class="transition ease-in duration-100"
          leave-from-class="opacity-100 translate-y-0"
          leave-to-class="opacity-0 translate-y-1"
        >
          <div
            v-if="showShareMenu"
            class="absolute top-10 right-0 bg-secondary-900 border border-secondary-700 rounded-xl shadow-2xl z-50 overflow-hidden min-w-[160px]"
          >
            <button
              class="w-full text-left px-4 py-3 text-xs font-bold text-secondary-300 hover:bg-secondary-800"
              @click="handleShare('full')"
            >
              Full Access
            </button>
            <button
              class="w-full text-left px-4 py-3 text-xs font-bold text-secondary-300 hover:bg-secondary-800"
              @click="handleShare('read')"
            >
              Read Only
            </button>
          </div>
        </Transition>
      </div>

      <!-- Theme Toggle -->
      <button
        class="w-8 h-8 lg:w-9 lg:h-9 flex items-center justify-center rounded-lg bg-secondary-800 hover:bg-secondary-700 border border-secondary-700 text-secondary-300 transition-all active:scale-90"
        @click="toggleTheme"
      >
        <svg
          v-if="isDark"
          class="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
          />
        </svg>
        <svg
          v-else
          class="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
          />
        </svg>
      </button>

      <!-- Hamburger (Mobile Only) -->
      <button
        class="lg:hidden w-10 h-10 flex items-center justify-center rounded-xl bg-secondary-800 border border-secondary-700 text-primary-400 active:scale-95 shadow-lg shadow-primary-500/10"
        @click="isMobileMenuOpen = true"
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
            stroke-width="2.5"
            d="M4 6h16M4 12h16m-7 6h7"
          />
        </svg>
      </button>

      <!-- Desktop SQL Export -->
      <button
        v-if="schemaStore.viewMode === 'full'"
        class="hidden lg:flex px-6 py-2.5 text-xs font-bold bg-linear-to-br from-primary-500 to-primary-700 hover:from-primary-400 hover:to-primary-600 text-white rounded-xl shadow-lg active:scale-95 transition-all items-center gap-2"
        @click="openExport"
      >
        <svg
          class="w-4 h-4"
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
        Export SQL
      </button>
    </div>

    <!-- Mobile Menu Overlay -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-300 ease-out"
        enter-from-class="opacity-0 translate-x-full"
        enter-to-class="opacity-100 translate-x-0"
        leave-active-class="transition duration-200 ease-in"
        leave-from-class="opacity-100 translate-x-0"
        leave-to-class="opacity-0 translate-x-full"
      >
        <div
          v-if="isMobileMenuOpen"
          class="fixed inset-0 z-100002 bg-secondary-950 flex flex-col p-8 overflow-hidden touch-none"
        >
          <div class="flex items-center justify-between mb-10 shrink-0">
            <h2
              class="text-xl font-bold font-mono tracking-tighter text-white uppercase"
            >
              Workplace Menu
            </h2>
            <button
              @click="isMobileMenuOpen = false"
              class="w-12 h-12 flex items-center justify-center rounded-2xl bg-secondary-800 text-secondary-400 active:scale-95"
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

          <div
            class="space-y-8 flex-1 overflow-y-auto custom-scrollbar pr-2 pb-10"
          >
            <!-- Share Section (Moved here for mobile) -->
            <div class="space-y-4">
              <span
                class="text-[11px] font-black text-secondary-600 uppercase tracking-[0.2em] block"
                >Collaboration</span
              >
              <div class="grid grid-cols-2 gap-3">
                <button
                  class="flex-1 flex flex-col items-start gap-4 p-5 bg-secondary-900 border border-secondary-800 rounded-3xl text-secondary-100 text-sm font-bold active:bg-primary-500 transition-all shadow-xl"
                  @click="handleShare('full')"
                >
                  <div
                    class="w-10 h-10 rounded-xl bg-primary-500/10 flex items-center justify-center"
                  >
                    <svg
                      class="w-5 h-5 text-primary-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                      />
                    </svg>
                  </div>
                  Full Access Link
                </button>
                <button
                  class="flex-1 flex flex-col items-start gap-4 p-5 bg-secondary-900 border border-secondary-800 rounded-3xl text-secondary-100 text-sm font-bold active:bg-secondary-800 transition-all shadow-xl"
                  @click="handleShare('read')"
                >
                  <div
                    class="w-10 h-10 rounded-xl bg-secondary-700/10 flex items-center justify-center"
                  >
                    <svg
                      class="w-5 h-5 text-secondary-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                      />
                    </svg>
                  </div>
                  Read-Only Link
                </button>
              </div>
            </div>

            <div class="space-y-4">
              <span
                class="text-[11px] font-black text-secondary-600 uppercase tracking-[0.2em] block"
                >Database Tools</span
              >
              <button
                class="w-full flex items-center gap-4 p-5 bg-secondary-900 border border-secondary-800 rounded-3xl text-secondary-100 text-sm font-bold active:bg-primary-500 transition-all"
                @click="openExport"
              >
                <div
                  class="w-10 h-10 rounded-xl bg-primary-500/10 flex items-center justify-center"
                >
                  <svg
                    class="w-5 h-5 text-primary-400"
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
                </div>
                Export PostgreSQL DDL
              </button>
              <button
                class="w-full flex items-center gap-4 p-5 bg-secondary-900 border border-secondary-800 rounded-3xl text-secondary-100 text-sm font-bold active:bg-success-500 transition-all"
                @click="openImport"
              >
                <div
                  class="w-10 h-10 rounded-xl bg-success-500/10 flex items-center justify-center"
                >
                  <svg
                    class="w-5 h-5 text-success-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                    />
                  </svg>
                </div>
                Import SQL Schema
              </button>
            </div>

            <div class="space-y-4">
              <span
                class="text-[11px] font-black text-secondary-600 uppercase tracking-[0.2em] block"
                >System Presets</span
              >
              <div class="grid grid-cols-2 gap-4">
                <button
                  class="flex flex-col gap-3 p-5 bg-secondary-900 border-2 rounded-3xl text-xs font-bold uppercase transition-all shadow-xl"
                  :class="
                    pendingPreset === 'blog'
                      ? 'border-warning-400 text-warning-400'
                      : 'border-secondary-800 text-secondary-300'
                  "
                  @click="loadPreset('blog')"
                >
                  ✍️ {{ pendingPreset === "blog" ? "Confirm?" : "Blog" }}
                </button>
                <button
                  class="flex flex-col gap-3 p-5 bg-secondary-900 border-2 rounded-3xl text-xs font-bold uppercase transition-all shadow-xl"
                  :class="
                    pendingPreset === 'ecommerce'
                      ? 'border-warning-400 text-warning-400'
                      : 'border-secondary-800 text-secondary-300'
                  "
                  @click="loadPreset('ecommerce')"
                >
                  🛍️ {{ pendingPreset === "ecommerce" ? "Confirm?" : "E-Com" }}
                </button>
              </div>
            </div>

            <div
              class="p-6 bg-linear-to-br from-primary-500/10 to-primary-800/10 border border-primary-500/20 rounded-3xl flex items-center justify-between"
            >
              <span
                class="text-xs font-bold text-primary-400 uppercase tracking-widest"
                >v1.2 Active</span
              >
              <span
                class="w-2 h-2 rounded-full bg-success-500 shadow-lg shadow-success-500/50"
              />
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <SqlExportModal :is-open="isExportOpen" @close="isExportOpen = false" />
  </header>
</template>

<style scoped>
.z-99901 {
  z-index: 99901;
}
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #334155;
  border-radius: 10px;
}
</style>
