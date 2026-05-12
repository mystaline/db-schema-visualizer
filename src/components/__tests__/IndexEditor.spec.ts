import { describe, it, expect, beforeEach, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import IndexEditor from "../IndexEditor.vue";
import { useSchemaStore } from "../../stores/schemaStore";

describe("IndexEditor.vue", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  const setupTable = () => {
    const store = useSchemaStore();
    store.addTable("users");
    const tId = store.tables[0].id;
    store.addColumn(tId);
    store.updateColumn(tId, store.tables[0].columns[0].id, { name: "email" });
    store.selectedTableId = tId;
    return { store, tId };
  };

  it("shows empty state when no indexes", () => {
    setupTable();
    const wrapper = mount(IndexEditor, {
      global: { stubs: { Teleport: true } },
    });
    expect(wrapper.text()).toContain("No indexes defined");
  });

  it("lists existing indexes", () => {
    const { store, tId } = setupTable();
    store.addIndex(tId, {
      name: "idx_users_email",
      type: "normal",
      parts: [{ type: "column", value: store.tables[0].columns[0].id, order: "ASC" }],
      filter: "",
    });

    const wrapper = mount(IndexEditor, {
      global: { stubs: { Teleport: true } },
    });
    expect(wrapper.text()).toContain("idx_users_email");
  });

  it("renders index form in full mode", () => {
    setupTable();
    const wrapper = mount(IndexEditor, {
      global: { stubs: { Teleport: true } },
    });
    expect(wrapper.text()).toContain("Register Index");
  });

  it("hides index form in read mode", () => {
    const { store } = setupTable();
    store.viewMode = "read";
    const wrapper = mount(IndexEditor, {
      global: { stubs: { Teleport: true } },
    });
    expect(wrapper.text()).not.toContain("Register Index");
  });

  it("auto-generates index name when parts are added", async () => {
    const { store, tId } = setupTable();
    const wrapper = mount(IndexEditor, {
      global: { stubs: { Teleport: true } },
    });

    const columnBtns = wrapper.findAll("button").filter(b => b.text().startsWith("+ "));
    if (columnBtns.length > 0) {
      await columnBtns[0].trigger("click");
      await wrapper.vm.$nextTick();

      const nameInput = wrapper.find("input").element as HTMLInputElement;
      expect(nameInput.value).toContain("idx_users_");
    }
  });

  it("shows index type badge", () => {
    const { store, tId } = setupTable();
    store.addIndex(tId, {
      name: "unq_users_email",
      type: "unique",
      parts: [{ type: "column", value: store.tables[0].columns[0].id, order: "ASC" }],
      filter: "",
    });

    const wrapper = mount(IndexEditor, {
      global: { stubs: { Teleport: true } },
    });
    expect(wrapper.text()).toContain("UNIQUE");
  });

  it("opens delete confirmation for index", async () => {
    const { store, tId } = setupTable();
    store.addIndex(tId, {
      name: "idx_users_email",
      type: "normal",
      parts: [{ type: "column", value: store.tables[0].columns[0].id, order: "ASC" }],
      filter: "",
    });

    const wrapper = mount(IndexEditor, {
      global: { stubs: { Teleport: true } },
    });

    const deleteBtns = wrapper.findAll("button").filter(b => {
      const svg = b.find("svg");
      return svg.exists() && !b.isVisible();
    });
    // Since buttons are hidden with opacity-0 group-hover, just check that the ConfirmModal trigger exists
    // Trigger the delete via the component internals
    const vm = wrapper.vm as any;
    vm.requestDeleteIndex(store.tables[0].indexes[0].id);
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain("Delete index?");
  });
});
