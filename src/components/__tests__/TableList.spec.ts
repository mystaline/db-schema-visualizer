import { describe, it, expect, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import TableList from "../TableList.vue";
import { useSchemaStore } from "../../stores/schemaStore";

describe("TableList.vue", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("renders tables from store", () => {
    const store = useSchemaStore();
    store.addTable("users");
    store.addTable("orders");

    const wrapper = mount(TableList, {
      global: { stubs: { Teleport: true } },
    });
    expect(wrapper.text()).toContain("users");
    expect(wrapper.text()).toContain("orders");
  });

  it("shows empty state when no tables", () => {
    const wrapper = mount(TableList, {
      global: { stubs: { Teleport: true } },
    });
    expect(wrapper.text()).toContain("No tables found");
  });

  it("selects a table on click", async () => {
    const store = useSchemaStore();
    store.addTable("users");
    const wrapper = mount(TableList, {
      global: { stubs: { Teleport: true } },
    });
    await wrapper.find(".cursor-pointer").trigger("click");
    expect(store.selectedTableId).toBe(store.tables[0].id);
  });

  it("shows column count per table", () => {
    const store = useSchemaStore();
    store.addTable("users");
    const tId = store.tables[0].id;
    store.addColumn(tId);
    store.addColumn(tId);

    const wrapper = mount(TableList, {
      global: { stubs: { Teleport: true } },
    });
    expect(wrapper.text()).toContain("2");
  });

  it("opens confirm modal on delete button click", async () => {
    const store = useSchemaStore();
    store.addTable("users");

    const wrapper = mount(TableList, {
      global: { stubs: { Teleport: true } },
    });

    const deleteBtn = wrapper.find("button");
    await deleteBtn.trigger("click.stop");
    expect(wrapper.text()).toContain("Delete Table");
  });

  it("confirms delete removes table", async () => {
    const store = useSchemaStore();
    store.addTable("users");

    const wrapper = mount(TableList, {
      global: { stubs: { Teleport: true } },
    });

    const deleteBtn = wrapper.find("button");
    await deleteBtn.trigger("click.stop");

    const confirmModal = wrapper.findComponent({ name: "ConfirmModal" });
    await confirmModal.vm.$emit("confirm");

    expect(store.tables.length).toBe(0);
  });

  it("highlights selected table", () => {
    const store = useSchemaStore();
    store.addTable("users");
    store.selectedTableId = store.tables[0].id;

    const wrapper = mount(TableList, {
      global: { stubs: { Teleport: true } },
    });
    const selected = wrapper.find(".bg-primary-500\\/10");
    expect(selected.exists()).toBe(true);
  });
});
