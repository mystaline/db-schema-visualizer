import { describe, it, expect, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import TableNode from "../TableNode.vue";
import { useSchemaStore, type Table } from "../../stores/schemaStore";

describe("TableNode.vue", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  const createTable = (): Table => {
    const store = useSchemaStore();
    store.addTable("users");
    const tId = store.tables[0].id;
    store.addColumn(tId);
    store.updateColumn(tId, store.tables[0].columns[0].id, { name: "id", type: "uuid", isPrimaryKey: true });
    store.addColumn(tId);
    store.updateColumn(tId, store.tables[0].columns[1].id, { name: "email", type: "varchar" });
    return store.tables[0];
  };

  it("renders table name", () => {
    const table = createTable();
    const wrapper = mount(TableNode, {
      props: { table, scale: 1 },
    });
    expect(wrapper.text()).toContain("users");
  });

  it("renders column names and types", () => {
    const table = createTable();
    const wrapper = mount(TableNode, {
      props: { table, scale: 1 },
    });
    expect(wrapper.text()).toContain("id");
    expect(wrapper.text()).toContain("uuid");
    expect(wrapper.text()).toContain("email");
    expect(wrapper.text()).toContain("varchar");
  });

  it("shows PK badge for primary key columns", () => {
    const table = createTable();
    const wrapper = mount(TableNode, {
      props: { table, scale: 1 },
    });
    expect(wrapper.text()).toContain("PK");
  });

  it("shows column count", () => {
    const table = createTable();
    const wrapper = mount(TableNode, {
      props: { table, scale: 1 },
    });
    // The header shows the count
    const countEl = wrapper.findAll(".text-secondary-500");
    const count = countEl.find(el => el.text() === "2");
    expect(count?.exists()).toBe(true);
  });

  it("highlights when selected", () => {
    const table = createTable();
    const store = useSchemaStore();
    store.selectedTableId = table.id;

    const wrapper = mount(TableNode, {
      props: { table, scale: 1 },
    });
    expect(wrapper.find(".border-primary-500").exists()).toBe(true);
  });

  it("shows empty columns message when no columns", () => {
    const store = useSchemaStore();
    store.addTable("empty_table");
    const table = store.tables[0];

    const wrapper = mount(TableNode, {
      props: { table, scale: 1 },
    });
    expect(wrapper.text()).toContain("No columns defined");
  });

  it("has aria attributes", () => {
    const table = createTable();
    const wrapper = mount(TableNode, {
      props: { table, scale: 1 },
    });
    const root = wrapper.find("[role='article']");
    expect(root.attributes("aria-label")).toContain("users");
  });

  it("shows index indicator when indexes exist", () => {
    const table = createTable();
    const store = useSchemaStore();
    store.addIndex(table.id, {
      name: "idx_users_email",
      type: "normal",
      parts: [{ type: "column", value: table.columns[1].id, order: "ASC" }],
      filter: "",
    });

    const wrapper = mount(TableNode, {
      props: { table: store.tables[0], scale: 1 },
    });
    expect(wrapper.text()).toContain("IDX");
  });
});
