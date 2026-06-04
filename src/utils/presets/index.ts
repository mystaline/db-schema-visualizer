import { uuid } from "../uuid";
import type { Table, ForeignKey } from "../../stores/schemaStore";

export type PresetKey =
  | "blog"
  | "ecommerce"
  | "saas"
  | "rbac"
  | "social"
  | "cms"
  | "chat";

export interface PresetMeta {
  key: PresetKey;
  label: string;
  emoji: string;
  description: string;
}

export interface PresetData {
  tables: Table[];
  foreignKeys: ForeignKey[];
}

export const PRESET_REGISTRY: PresetMeta[] = [
  {
    key: "blog",
    label: "Blog",
    emoji: "✍️",
    description: "Authors, posts, comments and tags",
  },
  {
    key: "ecommerce",
    label: "Shop",
    emoji: "🛍️",
    description: "Customers, products, orders and line items",
  },
  {
    key: "saas",
    label: "SaaS",
    emoji: "🏢",
    description: "Teams, memberships, plans and subscriptions",
  },
  {
    key: "rbac",
    label: "RBAC",
    emoji: "🔐",
    description: "Users, roles and permission assignments",
  },
  {
    key: "social",
    label: "Social",
    emoji: "💬",
    description: "Users, posts, comments, likes and follows",
  },
  {
    key: "cms",
    label: "CMS",
    emoji: "📰",
    description: "Articles, authors, categories, tags and media",
  },
  {
    key: "chat",
    label: "Chat",
    emoji: "💭",
    description: "Rooms, participants, messages and reactions",
  },
];

function fk(
  fks: ForeignKey[],
  sourceTableId: string,
  sourceColumnId: string,
  targetTableId: string,
  targetColumnId: string,
  onDelete: ForeignKey["onDelete"] = "CASCADE",
  onUpdate: ForeignKey["onUpdate"] = "CASCADE",
) {
  fks.push({
    id: uuid(),
    sourceTableId,
    sourceColumnId,
    targetTableId,
    targetColumnId,
    onDelete,
    onUpdate,
  });
}

// ─── BLOG ──────────────────────────────────────────────────────────────────

function buildBlog(): PresetData {
  const tables: Table[] = [];
  const foreignKeys: ForeignKey[] = [];

  const userId = uuid();
  const userPkId = uuid();
  const postId = uuid();
  const postPkId = uuid();
  const commentId = uuid();
  const tagId = uuid();
  const tagPkId = uuid();
  const postAuthorId = uuid();
  const postSlugId = uuid();
  const commentPostId = uuid();
  const commentAuthorId = uuid();
  const bridgePostId2 = uuid();
  const bridgeTagId2 = uuid();
  const bridgeId = uuid();

  tables.push({
    id: userId,
    name: "profiles",
    x: 50,
    y: 50,
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
        id: uuid(),
        name: "username",
        type: "varchar(50)",
        isPrimaryKey: false,
        isNullable: false,
        isUnique: true,
        defaultValue: null,
      },
      {
        id: uuid(),
        name: "display_name",
        type: "text",
        isPrimaryKey: false,
        isNullable: true,
        isUnique: false,
        defaultValue: null,
      },
      {
        id: uuid(),
        name: "bio",
        type: "text",
        isPrimaryKey: false,
        isNullable: true,
        isUnique: false,
        defaultValue: null,
      },
      {
        id: uuid(),
        name: "avatar_url",
        type: "text",
        isPrimaryKey: false,
        isNullable: true,
        isUnique: false,
        defaultValue: null,
      },
      {
        id: uuid(),
        name: "created_at",
        type: "timestamptz",
        isPrimaryKey: false,
        isNullable: false,
        isUnique: false,
        defaultValue: "now()",
      },
    ],
    indexes: [],
    checkConstraints: [],
  });

  tables.push({
    id: postId,
    name: "articles",
    x: 450,
    y: 50,
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
        type: "varchar(255)",
        isPrimaryKey: false,
        isNullable: false,
        isUnique: true,
        defaultValue: null,
      },
      {
        id: uuid(),
        name: "title",
        type: "text",
        isPrimaryKey: false,
        isNullable: false,
        isUnique: false,
        defaultValue: null,
      },
      {
        id: uuid(),
        name: "body",
        type: "text",
        isPrimaryKey: false,
        isNullable: true,
        isUnique: false,
        defaultValue: null,
      },
      {
        id: uuid(),
        name: "published_at",
        type: "timestamptz",
        isPrimaryKey: false,
        isNullable: true,
        isUnique: false,
        defaultValue: null,
      },
      {
        id: uuid(),
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
        id: uuid(),
        name: "idx_articles_slug",
        type: "unique",
        parts: [{ type: "column", value: postSlugId, order: "ASC" }],
        filter: "",
      },
      {
        id: uuid(),
        name: "idx_articles_author",
        type: "normal",
        parts: [{ type: "column", value: postAuthorId, order: "ASC" }],
        filter: "",
      },
    ],
    checkConstraints: [],
  });

  tables.push({
    id: commentId,
    name: "comments",
    x: 850,
    y: 50,
    columns: [
      {
        id: uuid(),
        name: "id",
        type: "uuid",
        isPrimaryKey: true,
        isNullable: false,
        isUnique: true,
        defaultValue: "gen_random_uuid()",
      },
      {
        id: commentPostId,
        name: "article_id",
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
        isNullable: false,
        isUnique: false,
        defaultValue: null,
      },
      {
        id: uuid(),
        name: "body",
        type: "text",
        isPrimaryKey: false,
        isNullable: false,
        isUnique: false,
        defaultValue: null,
      },
      {
        id: uuid(),
        name: "created_at",
        type: "timestamptz",
        isPrimaryKey: false,
        isNullable: false,
        isUnique: false,
        defaultValue: "now()",
      },
    ],
    indexes: [],
    checkConstraints: [],
  });

  tables.push({
    id: tagId,
    name: "tags",
    x: 450,
    y: 400,
    columns: [
      {
        id: tagPkId,
        name: "id",
        type: "serial",
        isPrimaryKey: true,
        isNullable: false,
        isUnique: true,
        defaultValue: null,
      },
      {
        id: uuid(),
        name: "name",
        type: "varchar(50)",
        isPrimaryKey: false,
        isNullable: false,
        isUnique: true,
        defaultValue: null,
      },
      {
        id: uuid(),
        name: "slug",
        type: "varchar(50)",
        isPrimaryKey: false,
        isNullable: false,
        isUnique: true,
        defaultValue: null,
      },
    ],
    indexes: [],
    checkConstraints: [],
  });

  tables.push({
    id: bridgeId,
    name: "article_tags",
    x: 850,
    y: 400,
    columns: [
      {
        id: bridgePostId2,
        name: "article_id",
        type: "uuid",
        isPrimaryKey: true,
        isNullable: false,
        isUnique: false,
        defaultValue: null,
      },
      {
        id: bridgeTagId2,
        name: "tag_id",
        type: "integer",
        isPrimaryKey: true,
        isNullable: false,
        isUnique: false,
        defaultValue: null,
      },
    ],
    indexes: [],
    checkConstraints: [],
  });

  fk(
    foreignKeys,
    postId,
    postAuthorId,
    userId,
    userPkId,
    "RESTRICT",
    "CASCADE",
  );
  fk(
    foreignKeys,
    commentId,
    commentPostId,
    postId,
    postPkId,
    "CASCADE",
    "CASCADE",
  );
  fk(
    foreignKeys,
    commentId,
    commentAuthorId,
    userId,
    userPkId,
    "RESTRICT",
    "CASCADE",
  );
  fk(
    foreignKeys,
    bridgeId,
    bridgePostId2,
    postId,
    postPkId,
    "CASCADE",
    "CASCADE",
  );
  fk(foreignKeys, bridgeId, bridgeTagId2, tagId, tagPkId, "CASCADE", "CASCADE");

  return { tables, foreignKeys };
}

// ─── ECOMMERCE ─────────────────────────────────────────────────────────────

function buildEcommerce(): PresetData {
  const tables: Table[] = [];
  const foreignKeys: ForeignKey[] = [];

  const customerId = uuid();
  const customerPkId = uuid();
  const categoryId = uuid();
  const categoryPkId = uuid();
  const productId = uuid();
  const productPkId = uuid();
  const orderId = uuid();
  const orderPkId = uuid();
  const itemId = uuid();
  const orderCustomerColId = uuid();
  const productCategoryColId = uuid();
  const itemOrderColId = uuid();
  const itemProductColId = uuid();
  const categoryParentColId = uuid();

  tables.push({
    id: customerId,
    name: "customers",
    x: 50,
    y: 50,
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
        id: uuid(),
        name: "email",
        type: "varchar(255)",
        isPrimaryKey: false,
        isNullable: false,
        isUnique: true,
        defaultValue: null,
      },
      {
        id: uuid(),
        name: "first_name",
        type: "text",
        isPrimaryKey: false,
        isNullable: true,
        isUnique: false,
        defaultValue: null,
      },
      {
        id: uuid(),
        name: "last_name",
        type: "text",
        isPrimaryKey: false,
        isNullable: true,
        isUnique: false,
        defaultValue: null,
      },
      {
        id: uuid(),
        name: "marketing_opt_in",
        type: "boolean",
        isPrimaryKey: false,
        isNullable: false,
        isUnique: false,
        defaultValue: "true",
      },
    ],
    indexes: [],
    checkConstraints: [],
  });

  tables.push({
    id: categoryId,
    name: "categories",
    x: 50,
    y: 450,
    columns: [
      {
        id: categoryPkId,
        name: "id",
        type: "serial",
        isPrimaryKey: true,
        isNullable: false,
        isUnique: true,
        defaultValue: null,
      },
      {
        id: uuid(),
        name: "name",
        type: "varchar(100)",
        isPrimaryKey: false,
        isNullable: false,
        isUnique: true,
        defaultValue: null,
      },
      {
        id: categoryParentColId,
        name: "parent_id",
        type: "integer",
        isPrimaryKey: false,
        isNullable: true,
        isUnique: false,
        defaultValue: null,
      },
    ],
    indexes: [],
    checkConstraints: [],
  });

  tables.push({
    id: productId,
    name: "products",
    x: 450,
    y: 400,
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
        id: productCategoryColId,
        name: "category_id",
        type: "integer",
        isPrimaryKey: false,
        isNullable: true,
        isUnique: false,
        defaultValue: null,
      },
      {
        id: uuid(),
        name: "sku",
        type: "varchar(20)",
        isPrimaryKey: false,
        isNullable: false,
        isUnique: true,
        defaultValue: null,
      },
      {
        id: uuid(),
        name: "name",
        type: "text",
        isPrimaryKey: false,
        isNullable: false,
        isUnique: false,
        defaultValue: null,
      },
      {
        id: uuid(),
        name: "price",
        type: "numeric(12,2)",
        isPrimaryKey: false,
        isNullable: false,
        isUnique: false,
        defaultValue: "0.00",
      },
      {
        id: uuid(),
        name: "stock_qty",
        type: "integer",
        isPrimaryKey: false,
        isNullable: false,
        isUnique: false,
        defaultValue: "0",
      },
    ],
    indexes: [],
    checkConstraints: [
      { id: uuid(), name: "chk_price_positive", expression: "price > 0" },
    ],
  });

  tables.push({
    id: orderId,
    name: "orders",
    x: 450,
    y: 50,
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
        id: uuid(),
        name: "order_date",
        type: "timestamptz",
        isPrimaryKey: false,
        isNullable: false,
        isUnique: false,
        defaultValue: "now()",
      },
      {
        id: uuid(),
        name: "total_amount",
        type: "numeric(12,2)",
        isPrimaryKey: false,
        isNullable: false,
        isUnique: false,
        defaultValue: "0.00",
      },
      {
        id: uuid(),
        name: "status",
        type: "varchar(20)",
        isPrimaryKey: false,
        isNullable: false,
        isUnique: false,
        defaultValue: "'pending'",
      },
    ],
    indexes: [],
    checkConstraints: [],
  });

  tables.push({
    id: itemId,
    name: "order_line_items",
    x: 850,
    y: 225,
    columns: [
      {
        id: uuid(),
        name: "id",
        type: "uuid",
        isPrimaryKey: true,
        isNullable: false,
        isUnique: true,
        defaultValue: "gen_random_uuid()",
      },
      {
        id: itemOrderColId,
        name: "order_id",
        type: "uuid",
        isPrimaryKey: false,
        isNullable: false,
        isUnique: false,
        defaultValue: null,
      },
      {
        id: itemProductColId,
        name: "product_id",
        type: "uuid",
        isPrimaryKey: false,
        isNullable: false,
        isUnique: false,
        defaultValue: null,
      },
      {
        id: uuid(),
        name: "quantity",
        type: "integer",
        isPrimaryKey: false,
        isNullable: false,
        isUnique: false,
        defaultValue: "1",
      },
      {
        id: uuid(),
        name: "unit_price",
        type: "numeric(12,2)",
        isPrimaryKey: false,
        isNullable: false,
        isUnique: false,
        defaultValue: null,
      },
    ],
    indexes: [],
    checkConstraints: [
      { id: uuid(), name: "chk_qty_pos", expression: "quantity > 0" },
    ],
  });

  fk(
    foreignKeys,
    orderId,
    orderCustomerColId,
    customerId,
    customerPkId,
    "RESTRICT",
    "CASCADE",
  );
  fk(
    foreignKeys,
    itemId,
    itemOrderColId,
    orderId,
    orderPkId,
    "CASCADE",
    "CASCADE",
  );
  fk(
    foreignKeys,
    itemId,
    itemProductColId,
    productId,
    productPkId,
    "CASCADE",
    "CASCADE",
  );
  fk(
    foreignKeys,
    productId,
    productCategoryColId,
    categoryId,
    categoryPkId,
    "SET NULL",
    "CASCADE",
  );
  fk(
    foreignKeys,
    categoryId,
    categoryParentColId,
    categoryId,
    categoryPkId,
    "CASCADE",
    "CASCADE",
  );

  return { tables, foreignKeys };
}

// ─── SAAS ──────────────────────────────────────────────────────────────────

function buildSaas(): PresetData {
  const tables: Table[] = [];
  const foreignKeys: ForeignKey[] = [];

  const userId = uuid();
  const userPkId = uuid();
  const teamId = uuid();
  const teamPkId = uuid();
  const planId = uuid();
  const planPkId = uuid();
  const subId = uuid();
  const memberId = uuid();
  const subTeamId = uuid();
  const subPlanId = uuid();
  const memUserId = uuid();
  const memTeamId = uuid();
  const teamOwnerId = uuid();

  tables.push({
    id: userId,
    name: "users",
    x: 50,
    y: 50,
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
        id: uuid(),
        name: "email",
        type: "varchar(255)",
        isPrimaryKey: false,
        isNullable: false,
        isUnique: true,
        defaultValue: null,
      },
      {
        id: uuid(),
        name: "full_name",
        type: "text",
        isPrimaryKey: false,
        isNullable: true,
        isUnique: false,
        defaultValue: null,
      },
      {
        id: uuid(),
        name: "created_at",
        type: "timestamptz",
        isPrimaryKey: false,
        isNullable: false,
        isUnique: false,
        defaultValue: "now()",
      },
    ],
    indexes: [],
    checkConstraints: [],
  });

  tables.push({
    id: planId,
    name: "plans",
    x: 50,
    y: 400,
    columns: [
      {
        id: planPkId,
        name: "id",
        type: "serial",
        isPrimaryKey: true,
        isNullable: false,
        isUnique: true,
        defaultValue: null,
      },
      {
        id: uuid(),
        name: "name",
        type: "varchar(50)",
        isPrimaryKey: false,
        isNullable: false,
        isUnique: true,
        defaultValue: null,
      },
      {
        id: uuid(),
        name: "price_per_month",
        type: "numeric(8,2)",
        isPrimaryKey: false,
        isNullable: false,
        isUnique: false,
        defaultValue: "0.00",
      },
      {
        id: uuid(),
        name: "max_members",
        type: "integer",
        isPrimaryKey: false,
        isNullable: true,
        isUnique: false,
        defaultValue: null,
      },
    ],
    indexes: [],
    checkConstraints: [],
  });

  tables.push({
    id: teamId,
    name: "teams",
    x: 450,
    y: 50,
    columns: [
      {
        id: teamPkId,
        name: "id",
        type: "uuid",
        isPrimaryKey: true,
        isNullable: false,
        isUnique: true,
        defaultValue: "gen_random_uuid()",
      },
      {
        id: teamOwnerId,
        name: "owner_id",
        type: "uuid",
        isPrimaryKey: false,
        isNullable: false,
        isUnique: false,
        defaultValue: null,
      },
      {
        id: uuid(),
        name: "name",
        type: "varchar(100)",
        isPrimaryKey: false,
        isNullable: false,
        isUnique: false,
        defaultValue: null,
      },
      {
        id: uuid(),
        name: "slug",
        type: "varchar(100)",
        isPrimaryKey: false,
        isNullable: false,
        isUnique: true,
        defaultValue: null,
      },
      {
        id: uuid(),
        name: "created_at",
        type: "timestamptz",
        isPrimaryKey: false,
        isNullable: false,
        isUnique: false,
        defaultValue: "now()",
      },
    ],
    indexes: [],
    checkConstraints: [],
  });

  tables.push({
    id: subId,
    name: "subscriptions",
    x: 450,
    y: 400,
    columns: [
      {
        id: uuid(),
        name: "id",
        type: "uuid",
        isPrimaryKey: true,
        isNullable: false,
        isUnique: true,
        defaultValue: "gen_random_uuid()",
      },
      {
        id: subTeamId,
        name: "team_id",
        type: "uuid",
        isPrimaryKey: false,
        isNullable: false,
        isUnique: true,
        defaultValue: null,
      },
      {
        id: subPlanId,
        name: "plan_id",
        type: "integer",
        isPrimaryKey: false,
        isNullable: false,
        isUnique: false,
        defaultValue: null,
      },
      {
        id: uuid(),
        name: "status",
        type: "varchar(20)",
        isPrimaryKey: false,
        isNullable: false,
        isUnique: false,
        defaultValue: "'active'",
      },
      {
        id: uuid(),
        name: "starts_at",
        type: "timestamptz",
        isPrimaryKey: false,
        isNullable: false,
        isUnique: false,
        defaultValue: "now()",
      },
      {
        id: uuid(),
        name: "ends_at",
        type: "timestamptz",
        isPrimaryKey: false,
        isNullable: true,
        isUnique: false,
        defaultValue: null,
      },
    ],
    indexes: [],
    checkConstraints: [],
  });

  tables.push({
    id: memberId,
    name: "memberships",
    x: 850,
    y: 50,
    columns: [
      {
        id: uuid(),
        name: "id",
        type: "uuid",
        isPrimaryKey: true,
        isNullable: false,
        isUnique: true,
        defaultValue: "gen_random_uuid()",
      },
      {
        id: memTeamId,
        name: "team_id",
        type: "uuid",
        isPrimaryKey: false,
        isNullable: false,
        isUnique: false,
        defaultValue: null,
      },
      {
        id: memUserId,
        name: "user_id",
        type: "uuid",
        isPrimaryKey: false,
        isNullable: false,
        isUnique: false,
        defaultValue: null,
      },
      {
        id: uuid(),
        name: "role",
        type: "varchar(20)",
        isPrimaryKey: false,
        isNullable: false,
        isUnique: false,
        defaultValue: "'member'",
      },
      {
        id: uuid(),
        name: "joined_at",
        type: "timestamptz",
        isPrimaryKey: false,
        isNullable: false,
        isUnique: false,
        defaultValue: "now()",
      },
    ],
    indexes: [],
    checkConstraints: [],
  });

  fk(foreignKeys, teamId, teamOwnerId, userId, userPkId, "RESTRICT", "CASCADE");
  fk(foreignKeys, subId, subTeamId, teamId, teamPkId, "CASCADE", "CASCADE");
  fk(foreignKeys, subId, subPlanId, planId, planPkId, "RESTRICT", "CASCADE");
  fk(foreignKeys, memberId, memTeamId, teamId, teamPkId, "CASCADE", "CASCADE");
  fk(foreignKeys, memberId, memUserId, userId, userPkId, "CASCADE", "CASCADE");

  return { tables, foreignKeys };
}

// ─── RBAC ──────────────────────────────────────────────────────────────────

function buildRbac(): PresetData {
  const tables: Table[] = [];
  const foreignKeys: ForeignKey[] = [];

  const userId = uuid();
  const userPkId = uuid();
  const roleId = uuid();
  const rolePkId = uuid();
  const permId = uuid();
  const permPkId = uuid();
  const urId = uuid();
  const rpId = uuid();
  const urUserId = uuid();
  const urRoleId = uuid();
  const rpRoleId = uuid();
  const rpPermId = uuid();

  tables.push({
    id: userId,
    name: "users",
    x: 50,
    y: 150,
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
        id: uuid(),
        name: "email",
        type: "varchar(255)",
        isPrimaryKey: false,
        isNullable: false,
        isUnique: true,
        defaultValue: null,
      },
      {
        id: uuid(),
        name: "password_hash",
        type: "text",
        isPrimaryKey: false,
        isNullable: false,
        isUnique: false,
        defaultValue: null,
      },
      {
        id: uuid(),
        name: "is_active",
        type: "boolean",
        isPrimaryKey: false,
        isNullable: false,
        isUnique: false,
        defaultValue: "true",
      },
      {
        id: uuid(),
        name: "created_at",
        type: "timestamptz",
        isPrimaryKey: false,
        isNullable: false,
        isUnique: false,
        defaultValue: "now()",
      },
    ],
    indexes: [],
    checkConstraints: [],
  });

  tables.push({
    id: roleId,
    name: "roles",
    x: 450,
    y: 50,
    columns: [
      {
        id: rolePkId,
        name: "id",
        type: "serial",
        isPrimaryKey: true,
        isNullable: false,
        isUnique: true,
        defaultValue: null,
      },
      {
        id: uuid(),
        name: "name",
        type: "varchar(50)",
        isPrimaryKey: false,
        isNullable: false,
        isUnique: true,
        defaultValue: null,
      },
      {
        id: uuid(),
        name: "description",
        type: "text",
        isPrimaryKey: false,
        isNullable: true,
        isUnique: false,
        defaultValue: null,
      },
    ],
    indexes: [],
    checkConstraints: [],
  });

  tables.push({
    id: permId,
    name: "permissions",
    x: 450,
    y: 350,
    columns: [
      {
        id: permPkId,
        name: "id",
        type: "serial",
        isPrimaryKey: true,
        isNullable: false,
        isUnique: true,
        defaultValue: null,
      },
      {
        id: uuid(),
        name: "action",
        type: "varchar(50)",
        isPrimaryKey: false,
        isNullable: false,
        isUnique: false,
        defaultValue: null,
      },
      {
        id: uuid(),
        name: "resource",
        type: "varchar(50)",
        isPrimaryKey: false,
        isNullable: false,
        isUnique: false,
        defaultValue: null,
      },
    ],
    indexes: [
      {
        id: uuid(),
        name: "uq_permissions_action_resource",
        type: "unique",
        parts: [
          { type: "column", value: "", order: "ASC" },
          { type: "column", value: "", order: "ASC" },
        ],
        filter: "",
      },
    ],
    checkConstraints: [],
  });

  tables.push({
    id: urId,
    name: "user_roles",
    x: 850,
    y: 50,
    columns: [
      {
        id: urUserId,
        name: "user_id",
        type: "uuid",
        isPrimaryKey: true,
        isNullable: false,
        isUnique: false,
        defaultValue: null,
      },
      {
        id: urRoleId,
        name: "role_id",
        type: "integer",
        isPrimaryKey: true,
        isNullable: false,
        isUnique: false,
        defaultValue: null,
      },
    ],
    indexes: [],
    checkConstraints: [],
  });

  tables.push({
    id: rpId,
    name: "role_permissions",
    x: 850,
    y: 300,
    columns: [
      {
        id: rpRoleId,
        name: "role_id",
        type: "integer",
        isPrimaryKey: true,
        isNullable: false,
        isUnique: false,
        defaultValue: null,
      },
      {
        id: rpPermId,
        name: "permission_id",
        type: "integer",
        isPrimaryKey: true,
        isNullable: false,
        isUnique: false,
        defaultValue: null,
      },
    ],
    indexes: [],
    checkConstraints: [],
  });

  fk(foreignKeys, urId, urUserId, userId, userPkId, "CASCADE", "CASCADE");
  fk(foreignKeys, urId, urRoleId, roleId, rolePkId, "CASCADE", "CASCADE");
  fk(foreignKeys, rpId, rpRoleId, roleId, rolePkId, "CASCADE", "CASCADE");
  fk(foreignKeys, rpId, rpPermId, permId, permPkId, "CASCADE", "CASCADE");

  return { tables, foreignKeys };
}

// ─── SOCIAL ────────────────────────────────────────────────────────────────

function buildSocial(): PresetData {
  const tables: Table[] = [];
  const foreignKeys: ForeignKey[] = [];

  const userId = uuid();
  const userPkId = uuid();
  const postId = uuid();
  const postPkId = uuid();
  const commentId = uuid();
  const likeId = uuid();
  const followId = uuid();
  const postAuthorId = uuid();
  const commentPostId = uuid();
  const commentUserId = uuid();
  const likePostId = uuid();
  const likeUserId = uuid();
  const followerId = uuid();
  const followingId = uuid();

  tables.push({
    id: userId,
    name: "users",
    x: 50,
    y: 150,
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
        id: uuid(),
        name: "handle",
        type: "varchar(50)",
        isPrimaryKey: false,
        isNullable: false,
        isUnique: true,
        defaultValue: null,
      },
      {
        id: uuid(),
        name: "display_name",
        type: "text",
        isPrimaryKey: false,
        isNullable: true,
        isUnique: false,
        defaultValue: null,
      },
      {
        id: uuid(),
        name: "bio",
        type: "text",
        isPrimaryKey: false,
        isNullable: true,
        isUnique: false,
        defaultValue: null,
      },
      {
        id: uuid(),
        name: "avatar_url",
        type: "text",
        isPrimaryKey: false,
        isNullable: true,
        isUnique: false,
        defaultValue: null,
      },
      {
        id: uuid(),
        name: "created_at",
        type: "timestamptz",
        isPrimaryKey: false,
        isNullable: false,
        isUnique: false,
        defaultValue: "now()",
      },
    ],
    indexes: [],
    checkConstraints: [],
  });

  tables.push({
    id: postId,
    name: "posts",
    x: 450,
    y: 50,
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
        id: uuid(),
        name: "body",
        type: "text",
        isPrimaryKey: false,
        isNullable: false,
        isUnique: false,
        defaultValue: null,
      },
      {
        id: uuid(),
        name: "media_url",
        type: "text",
        isPrimaryKey: false,
        isNullable: true,
        isUnique: false,
        defaultValue: null,
      },
      {
        id: uuid(),
        name: "created_at",
        type: "timestamptz",
        isPrimaryKey: false,
        isNullable: false,
        isUnique: false,
        defaultValue: "now()",
      },
    ],
    indexes: [],
    checkConstraints: [],
  });

  tables.push({
    id: commentId,
    name: "comments",
    x: 850,
    y: 50,
    columns: [
      {
        id: uuid(),
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
        id: commentUserId,
        name: "author_id",
        type: "uuid",
        isPrimaryKey: false,
        isNullable: false,
        isUnique: false,
        defaultValue: null,
      },
      {
        id: uuid(),
        name: "body",
        type: "text",
        isPrimaryKey: false,
        isNullable: false,
        isUnique: false,
        defaultValue: null,
      },
      {
        id: uuid(),
        name: "created_at",
        type: "timestamptz",
        isPrimaryKey: false,
        isNullable: false,
        isUnique: false,
        defaultValue: "now()",
      },
    ],
    indexes: [],
    checkConstraints: [],
  });

  tables.push({
    id: likeId,
    name: "likes",
    x: 450,
    y: 400,
    columns: [
      {
        id: likePostId,
        name: "post_id",
        type: "uuid",
        isPrimaryKey: true,
        isNullable: false,
        isUnique: false,
        defaultValue: null,
      },
      {
        id: likeUserId,
        name: "user_id",
        type: "uuid",
        isPrimaryKey: true,
        isNullable: false,
        isUnique: false,
        defaultValue: null,
      },
      {
        id: uuid(),
        name: "created_at",
        type: "timestamptz",
        isPrimaryKey: false,
        isNullable: false,
        isUnique: false,
        defaultValue: "now()",
      },
    ],
    indexes: [],
    checkConstraints: [],
  });

  tables.push({
    id: followId,
    name: "follows",
    x: 850,
    y: 400,
    columns: [
      {
        id: followerId,
        name: "follower_id",
        type: "uuid",
        isPrimaryKey: true,
        isNullable: false,
        isUnique: false,
        defaultValue: null,
      },
      {
        id: followingId,
        name: "following_id",
        type: "uuid",
        isPrimaryKey: true,
        isNullable: false,
        isUnique: false,
        defaultValue: null,
      },
      {
        id: uuid(),
        name: "created_at",
        type: "timestamptz",
        isPrimaryKey: false,
        isNullable: false,
        isUnique: false,
        defaultValue: "now()",
      },
    ],
    indexes: [],
    checkConstraints: [],
  });

  fk(foreignKeys, postId, postAuthorId, userId, userPkId, "CASCADE", "CASCADE");
  fk(
    foreignKeys,
    commentId,
    commentPostId,
    postId,
    postPkId,
    "CASCADE",
    "CASCADE",
  );
  fk(
    foreignKeys,
    commentId,
    commentUserId,
    userId,
    userPkId,
    "CASCADE",
    "CASCADE",
  );
  fk(foreignKeys, likeId, likePostId, postId, postPkId, "CASCADE", "CASCADE");
  fk(foreignKeys, likeId, likeUserId, userId, userPkId, "CASCADE", "CASCADE");
  fk(foreignKeys, followId, followerId, userId, userPkId, "CASCADE", "CASCADE");
  fk(
    foreignKeys,
    followId,
    followingId,
    userId,
    userPkId,
    "CASCADE",
    "CASCADE",
  );

  return { tables, foreignKeys };
}

// ─── CMS ───────────────────────────────────────────────────────────────────

function buildCms(): PresetData {
  const tables: Table[] = [];
  const foreignKeys: ForeignKey[] = [];

  const authorId = uuid();
  const authorPkId = uuid();
  const catId = uuid();
  const catPkId = uuid();
  const articleId = uuid();
  const articlePkId = uuid();
  const tagId = uuid();
  const tagPkId = uuid();
  const mediaId = uuid();
  const bridgeId = uuid();
  const articleAuthorId = uuid();
  const articleCatId = uuid();
  const bridgeArtId = uuid();
  const bridgeTagId = uuid();
  const mediaCatId = uuid();

  tables.push({
    id: authorId,
    name: "authors",
    x: 50,
    y: 50,
    columns: [
      {
        id: authorPkId,
        name: "id",
        type: "uuid",
        isPrimaryKey: true,
        isNullable: false,
        isUnique: true,
        defaultValue: "gen_random_uuid()",
      },
      {
        id: uuid(),
        name: "name",
        type: "text",
        isPrimaryKey: false,
        isNullable: false,
        isUnique: false,
        defaultValue: null,
      },
      {
        id: uuid(),
        name: "email",
        type: "varchar(255)",
        isPrimaryKey: false,
        isNullable: false,
        isUnique: true,
        defaultValue: null,
      },
      {
        id: uuid(),
        name: "bio",
        type: "text",
        isPrimaryKey: false,
        isNullable: true,
        isUnique: false,
        defaultValue: null,
      },
    ],
    indexes: [],
    checkConstraints: [],
  });

  tables.push({
    id: catId,
    name: "categories",
    x: 50,
    y: 400,
    columns: [
      {
        id: catPkId,
        name: "id",
        type: "serial",
        isPrimaryKey: true,
        isNullable: false,
        isUnique: true,
        defaultValue: null,
      },
      {
        id: uuid(),
        name: "name",
        type: "varchar(100)",
        isPrimaryKey: false,
        isNullable: false,
        isUnique: true,
        defaultValue: null,
      },
      {
        id: uuid(),
        name: "slug",
        type: "varchar(100)",
        isPrimaryKey: false,
        isNullable: false,
        isUnique: true,
        defaultValue: null,
      },
    ],
    indexes: [],
    checkConstraints: [],
  });

  tables.push({
    id: articleId,
    name: "articles",
    x: 450,
    y: 50,
    columns: [
      {
        id: articlePkId,
        name: "id",
        type: "uuid",
        isPrimaryKey: true,
        isNullable: false,
        isUnique: true,
        defaultValue: "gen_random_uuid()",
      },
      {
        id: articleAuthorId,
        name: "author_id",
        type: "uuid",
        isPrimaryKey: false,
        isNullable: false,
        isUnique: false,
        defaultValue: null,
      },
      {
        id: articleCatId,
        name: "category_id",
        type: "integer",
        isPrimaryKey: false,
        isNullable: true,
        isUnique: false,
        defaultValue: null,
      },
      {
        id: uuid(),
        name: "title",
        type: "text",
        isPrimaryKey: false,
        isNullable: false,
        isUnique: false,
        defaultValue: null,
      },
      {
        id: uuid(),
        name: "slug",
        type: "varchar(255)",
        isPrimaryKey: false,
        isNullable: false,
        isUnique: true,
        defaultValue: null,
      },
      {
        id: uuid(),
        name: "body",
        type: "text",
        isPrimaryKey: false,
        isNullable: true,
        isUnique: false,
        defaultValue: null,
      },
      {
        id: uuid(),
        name: "status",
        type: "varchar(20)",
        isPrimaryKey: false,
        isNullable: false,
        isUnique: false,
        defaultValue: "'draft'",
      },
      {
        id: uuid(),
        name: "published_at",
        type: "timestamptz",
        isPrimaryKey: false,
        isNullable: true,
        isUnique: false,
        defaultValue: null,
      },
    ],
    indexes: [],
    checkConstraints: [],
  });

  tables.push({
    id: tagId,
    name: "tags",
    x: 450,
    y: 450,
    columns: [
      {
        id: tagPkId,
        name: "id",
        type: "serial",
        isPrimaryKey: true,
        isNullable: false,
        isUnique: true,
        defaultValue: null,
      },
      {
        id: uuid(),
        name: "name",
        type: "varchar(50)",
        isPrimaryKey: false,
        isNullable: false,
        isUnique: true,
        defaultValue: null,
      },
    ],
    indexes: [],
    checkConstraints: [],
  });

  tables.push({
    id: bridgeId,
    name: "article_tags",
    x: 850,
    y: 250,
    columns: [
      {
        id: bridgeArtId,
        name: "article_id",
        type: "uuid",
        isPrimaryKey: true,
        isNullable: false,
        isUnique: false,
        defaultValue: null,
      },
      {
        id: bridgeTagId,
        name: "tag_id",
        type: "integer",
        isPrimaryKey: true,
        isNullable: false,
        isUnique: false,
        defaultValue: null,
      },
    ],
    indexes: [],
    checkConstraints: [],
  });

  tables.push({
    id: mediaId,
    name: "media",
    x: 850,
    y: 50,
    columns: [
      {
        id: uuid(),
        name: "id",
        type: "uuid",
        isPrimaryKey: true,
        isNullable: false,
        isUnique: true,
        defaultValue: "gen_random_uuid()",
      },
      {
        id: mediaCatId,
        name: "article_id",
        type: "uuid",
        isPrimaryKey: false,
        isNullable: true,
        isUnique: false,
        defaultValue: null,
      },
      {
        id: uuid(),
        name: "url",
        type: "text",
        isPrimaryKey: false,
        isNullable: false,
        isUnique: false,
        defaultValue: null,
      },
      {
        id: uuid(),
        name: "mime_type",
        type: "varchar(100)",
        isPrimaryKey: false,
        isNullable: false,
        isUnique: false,
        defaultValue: null,
      },
      {
        id: uuid(),
        name: "size_bytes",
        type: "bigint",
        isPrimaryKey: false,
        isNullable: true,
        isUnique: false,
        defaultValue: null,
      },
    ],
    indexes: [],
    checkConstraints: [],
  });

  fk(
    foreignKeys,
    articleId,
    articleAuthorId,
    authorId,
    authorPkId,
    "RESTRICT",
    "CASCADE",
  );
  fk(
    foreignKeys,
    articleId,
    articleCatId,
    catId,
    catPkId,
    "SET NULL",
    "CASCADE",
  );
  fk(
    foreignKeys,
    bridgeId,
    bridgeArtId,
    articleId,
    articlePkId,
    "CASCADE",
    "CASCADE",
  );
  fk(foreignKeys, bridgeId, bridgeTagId, tagId, tagPkId, "CASCADE", "CASCADE");
  fk(
    foreignKeys,
    mediaId,
    mediaCatId,
    articleId,
    articlePkId,
    "CASCADE",
    "CASCADE",
  );

  return { tables, foreignKeys };
}

// ─── CHAT ──────────────────────────────────────────────────────────────────

function buildChat(): PresetData {
  const tables: Table[] = [];
  const foreignKeys: ForeignKey[] = [];

  const userId = uuid();
  const userPkId = uuid();
  const roomId = uuid();
  const roomPkId = uuid();
  const msgId = uuid();
  const msgPkId = uuid();
  const partId = uuid();
  const reactId = uuid();
  const roomCreatorId = uuid();
  const msgRoomId = uuid();
  const msgSenderId = uuid();
  const partRoomId = uuid();
  const partUserId = uuid();
  const reactMsgId = uuid();
  const reactUserId = uuid();

  tables.push({
    id: userId,
    name: "users",
    x: 50,
    y: 150,
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
        id: uuid(),
        name: "handle",
        type: "varchar(50)",
        isPrimaryKey: false,
        isNullable: false,
        isUnique: true,
        defaultValue: null,
      },
      {
        id: uuid(),
        name: "display_name",
        type: "text",
        isPrimaryKey: false,
        isNullable: true,
        isUnique: false,
        defaultValue: null,
      },
      {
        id: uuid(),
        name: "avatar_url",
        type: "text",
        isPrimaryKey: false,
        isNullable: true,
        isUnique: false,
        defaultValue: null,
      },
    ],
    indexes: [],
    checkConstraints: [],
  });

  tables.push({
    id: roomId,
    name: "rooms",
    x: 450,
    y: 50,
    columns: [
      {
        id: roomPkId,
        name: "id",
        type: "uuid",
        isPrimaryKey: true,
        isNullable: false,
        isUnique: true,
        defaultValue: "gen_random_uuid()",
      },
      {
        id: roomCreatorId,
        name: "creator_id",
        type: "uuid",
        isPrimaryKey: false,
        isNullable: false,
        isUnique: false,
        defaultValue: null,
      },
      {
        id: uuid(),
        name: "name",
        type: "varchar(100)",
        isPrimaryKey: false,
        isNullable: true,
        isUnique: false,
        defaultValue: null,
      },
      {
        id: uuid(),
        name: "is_direct",
        type: "boolean",
        isPrimaryKey: false,
        isNullable: false,
        isUnique: false,
        defaultValue: "false",
      },
      {
        id: uuid(),
        name: "created_at",
        type: "timestamptz",
        isPrimaryKey: false,
        isNullable: false,
        isUnique: false,
        defaultValue: "now()",
      },
    ],
    indexes: [],
    checkConstraints: [],
  });

  tables.push({
    id: partId,
    name: "participants",
    x: 850,
    y: 50,
    columns: [
      {
        id: partRoomId,
        name: "room_id",
        type: "uuid",
        isPrimaryKey: true,
        isNullable: false,
        isUnique: false,
        defaultValue: null,
      },
      {
        id: partUserId,
        name: "user_id",
        type: "uuid",
        isPrimaryKey: true,
        isNullable: false,
        isUnique: false,
        defaultValue: null,
      },
      {
        id: uuid(),
        name: "joined_at",
        type: "timestamptz",
        isPrimaryKey: false,
        isNullable: false,
        isUnique: false,
        defaultValue: "now()",
      },
    ],
    indexes: [],
    checkConstraints: [],
  });

  tables.push({
    id: msgId,
    name: "messages",
    x: 450,
    y: 350,
    columns: [
      {
        id: msgPkId,
        name: "id",
        type: "uuid",
        isPrimaryKey: true,
        isNullable: false,
        isUnique: true,
        defaultValue: "gen_random_uuid()",
      },
      {
        id: msgRoomId,
        name: "room_id",
        type: "uuid",
        isPrimaryKey: false,
        isNullable: false,
        isUnique: false,
        defaultValue: null,
      },
      {
        id: msgSenderId,
        name: "sender_id",
        type: "uuid",
        isPrimaryKey: false,
        isNullable: false,
        isUnique: false,
        defaultValue: null,
      },
      {
        id: uuid(),
        name: "body",
        type: "text",
        isPrimaryKey: false,
        isNullable: false,
        isUnique: false,
        defaultValue: null,
      },
      {
        id: uuid(),
        name: "sent_at",
        type: "timestamptz",
        isPrimaryKey: false,
        isNullable: false,
        isUnique: false,
        defaultValue: "now()",
      },
      {
        id: uuid(),
        name: "edited_at",
        type: "timestamptz",
        isPrimaryKey: false,
        isNullable: true,
        isUnique: false,
        defaultValue: null,
      },
    ],
    indexes: [
      {
        id: uuid(),
        name: "idx_messages_room_sent",
        type: "normal",
        parts: [
          { type: "column", value: msgRoomId, order: "ASC" },
          { type: "column", value: "", order: "DESC" },
        ],
        filter: "",
      },
    ],
    checkConstraints: [],
  });

  tables.push({
    id: reactId,
    name: "reactions",
    x: 850,
    y: 350,
    columns: [
      {
        id: reactMsgId,
        name: "message_id",
        type: "uuid",
        isPrimaryKey: true,
        isNullable: false,
        isUnique: false,
        defaultValue: null,
      },
      {
        id: reactUserId,
        name: "user_id",
        type: "uuid",
        isPrimaryKey: true,
        isNullable: false,
        isUnique: false,
        defaultValue: null,
      },
      {
        id: uuid(),
        name: "emoji",
        type: "varchar(10)",
        isPrimaryKey: true,
        isNullable: false,
        isUnique: false,
        defaultValue: null,
      },
    ],
    indexes: [],
    checkConstraints: [],
  });

  fk(
    foreignKeys,
    roomId,
    roomCreatorId,
    userId,
    userPkId,
    "RESTRICT",
    "CASCADE",
  );
  fk(foreignKeys, partId, partRoomId, roomId, roomPkId, "CASCADE", "CASCADE");
  fk(foreignKeys, partId, partUserId, userId, userPkId, "CASCADE", "CASCADE");
  fk(foreignKeys, msgId, msgRoomId, roomId, roomPkId, "CASCADE", "CASCADE");
  fk(foreignKeys, msgId, msgSenderId, userId, userPkId, "CASCADE", "CASCADE");
  fk(foreignKeys, reactId, reactMsgId, msgId, msgPkId, "CASCADE", "CASCADE");
  fk(foreignKeys, reactId, reactUserId, userId, userPkId, "CASCADE", "CASCADE");

  return { tables, foreignKeys };
}

// ─── Registry ──────────────────────────────────────────────────────────────

const BUILDERS: Record<PresetKey, () => PresetData> = {
  blog: buildBlog,
  ecommerce: buildEcommerce,
  saas: buildSaas,
  rbac: buildRbac,
  social: buildSocial,
  cms: buildCms,
  chat: buildChat,
};

export function buildPreset(key: PresetKey): PresetData {
  return BUILDERS[key]();
}
