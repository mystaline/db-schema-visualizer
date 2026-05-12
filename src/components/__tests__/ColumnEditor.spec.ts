import { describe, it, expect, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import ColumnEditor from "../ColumnEditor.vue";
import { useSchemaStore } from "../../stores/schemaStore";

describe("ColumnEditor.vue", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  const setupTable = () => {
    const store = useSchemaStore();
    store.addTable("users");
    const tId = store.tables[0].id;
    store.addColumn(tId);
    store.selectedTableId = tId;
    return { store, tId };
  };

  it("renders columns from selected table", () => {
    setupTable();
    const wrapper = mount(ColumnEditor, {
      global: { stubs: { Teleport: true } },
    });
    const inputs = wrapper.findAll("input[aria-label^='Column name']");
    expect(inputs.length).toBe(1);
    expect((inputs[0].element as HTMLInputElement).value).toBe("new_column");
  });

  it("shows column count", () => {
    const { store, tId } = setupTable();
    store.addColumn(tId);
    const wrapper = mount(ColumnEditor, {
      global: { stubs: { Teleport: true } },
    });
    expect(wrapper.text()).toContain("2 columns");
  });

  it("adds a new column on add button click", async () => {
    const { store, tId } = setupTable();
    const wrapper = mount(ColumnEditor, {
      global: { stubs: { Teleport: true } },
    });
    const buttons = wrapper.findAll("button");
    const addBtn = buttons.find(b => b.text().toLowerCase().includes("add column"));
    expect(addBtn).toBeDefined();
    if (addBtn) await addBtn.trigger("click");
    expect(store.tables[0].columns.length).toBe(2);
  });

  it("updates column name on input", async () => {
    const { store, tId } = setupTable();
    const col = store.tables[0].columns[0];
    const wrapper = mount(ColumnEditor, {
      global: { stubs: { Teleport: true } },
    });
    const nameInput = wrapper.find("input[aria-label^='Column name']");
    await nameInput.setValue("user_id");
    await nameInput.trigger("input");
    const updated = store.tables[0].columns.find(c => c.id === col.id);
    expect(updated?.name).toBe("user_id");
  });

  it("toggles PK", async () => {
    const { store, tId } = setupTable();
    const wrapper = mount(ColumnEditor, {
      global: { stubs: { Teleport: true } },
    });
    const pkBtn = wrapper.find("button[aria-label$='is primary key']");
    await pkBtn.trigger("click");
    expect(store.tables[0].columns[0].isPrimaryKey).toBe(true);
    expect(store.tables[0].columns[0].isNullable).toBe(false);
  });

  it("opens delete confirmation", async () => {
    setupTable();
    const wrapper = mount(ColumnEditor, {
      global: { stubs: { Teleport: true } },
    });
    const deleteBtn = wrapper.find("button[aria-label^='Delete column']");
    await deleteBtn.trigger("click");
    expect(wrapper.text()).toContain("Delete column?");
  });

  it("flags invalid column names", async () => {
    const { store, tId } = setupTable();
    const col = store.tables[0].columns[0];
    store.updateColumn(tId, col.id, { name: "1invalid" });

    const wrapper = mount(ColumnEditor, {
      global: { stubs: { Teleport: true } },
    });
    const row = wrapper.find(".border-danger-500\\/50");
    expect(row.exists()).toBe(true);
  });

  it("hides add column button in read mode", () => {
    const { store } = setupTable();
    store.viewMode = "read";
    const wrapper = mount(ColumnEditor, {
      global: { stubs: { Teleport: true } },
    });
    const buttons = wrapper.findAll("button");
    const hasAddButton = buttons.some(b => b.text().toLowerCase().includes("add column"));
    expect(hasAddButton).toBe(false);
  });
});
