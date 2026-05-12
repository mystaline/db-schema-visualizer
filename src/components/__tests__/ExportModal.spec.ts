import { describe, it, expect, beforeEach, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import ExportModal from "../ExportModal.vue";
import { useSchemaStore } from "../../stores/schemaStore";

describe("ExportModal.vue", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    window.URL.createObjectURL = vi.fn();
    window.URL.revokeObjectURL = vi.fn();
  });

  it("shows empty schema warning when no tables", () => {
    const wrapper = mount(ExportModal, {
      props: { isOpen: true },
      global: { stubs: { Teleport: true } },
    });
    expect(wrapper.text()).toContain("there is nothing to export");
  });

  it("shows SQL tab active by default", () => {
    const wrapper = mount(ExportModal, {
      props: { isOpen: true },
      global: { stubs: { Teleport: true } },
    });
    const sqlTab = wrapper.find("#export-tab-sql");
    expect(sqlTab.text()).toContain("SQL");
  });

  it("generates CREATE TABLE SQL for a table with columns", () => {
    const store = useSchemaStore();
    store.addTable("users");
    const tId = store.tables[0].id;
    store.addColumn(tId);
    store.updateColumn(tId, store.tables[0].columns[0].id, {
      name: "id", type: "uuid", isPrimaryKey: true, isNullable: false,
    });

    const wrapper = mount(ExportModal, {
      props: { isOpen: true },
      global: { stubs: { Teleport: true } },
    });

    const sql = (wrapper.find("textarea").element as HTMLTextAreaElement).value;
    expect(sql).toContain("CREATE TABLE users");
    expect(sql).toContain("PRIMARY KEY (id)");
  });

  it("generates JSON output on JSON tab", async () => {
    const store = useSchemaStore();
    store.addTable("test");

    const wrapper = mount(ExportModal, {
      props: { isOpen: true },
      global: { stubs: { Teleport: true } },
    });

    const jsonTab = wrapper.find("#export-tab-json");
    await jsonTab.trigger("click");

    const json = (wrapper.find("textarea").element as HTMLTextAreaElement).value;
    expect(json).toContain('"tables"');
    expect(json).toContain('"test"');
  });

  it("switches between SQL and JSON tabs", async () => {
    const store = useSchemaStore();
    store.addTable("test");

    const wrapper = mount(ExportModal, {
      props: { isOpen: true },
      global: { stubs: { Teleport: true } },
    });

    expect((wrapper.find("textarea").element as HTMLTextAreaElement).value).toContain("CREATE TABLE");

    await wrapper.find("#export-tab-json").trigger("click");
    expect((wrapper.find("textarea").element as HTMLTextAreaElement).value).toContain('"tables"');
  });

  it("emits close when close button is clicked", async () => {
    const wrapper = mount(ExportModal, {
      props: { isOpen: true },
      global: { stubs: { Teleport: true } },
    });

    const closeBtn = wrapper.find("[aria-label='Close modal']");
    await closeBtn.trigger("click");
    expect(wrapper.emitted("close")).toBeTruthy();
  });

  it("does not render when isOpen is false", () => {
    const wrapper = mount(ExportModal, {
      props: { isOpen: false },
      global: { stubs: { Teleport: true } },
    });
    expect(wrapper.text()).toBe("");
  });
});
