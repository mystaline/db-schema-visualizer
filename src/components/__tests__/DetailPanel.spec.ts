import { describe, it, expect, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import DetailPanel from "../DetailPanel.vue";
import { useSchemaStore } from "../../stores/schemaStore";

describe("DetailPanel.vue", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("shows empty state when no table selected", () => {
    const wrapper = mount(DetailPanel, {
      global: { stubs: { Teleport: true } },
    });
    expect(wrapper.text()).toContain("No Entity Selected");
  });

  it("renders table name when table selected", () => {
    const store = useSchemaStore();
    store.addTable("users");
    store.selectedTableId = store.tables[0].id;

    const wrapper = mount(DetailPanel, {
      global: { stubs: { Teleport: true } },
    });
    expect(wrapper.text()).toContain("users");
  });

  it("shows column count badge", () => {
    const store = useSchemaStore();
    store.addTable("users");
    const tId = store.tables[0].id;
    store.addColumn(tId);
    store.addColumn(tId);
    store.addColumn(tId);
    store.selectedTableId = tId;

    const wrapper = mount(DetailPanel, {
      global: { stubs: { Teleport: true } },
    });
    expect(wrapper.text()).toContain("3 col");
  });

  it("renders all tabs", () => {
    const store = useSchemaStore();
    store.addTable("users");
    store.selectedTableId = store.tables[0].id;

    const wrapper = mount(DetailPanel, {
      global: { stubs: { Teleport: true } },
    });

    const tabs = wrapper.findAll("nav button");
    const tabTexts = tabs.map(t => t.text().trim());
    expect(tabTexts).toContain("Columns");
    expect(tabTexts).toContain("Foreign Keys");
    expect(tabTexts).toContain("Indexes");
    expect(tabTexts).toContain("Constraints");
    expect(tabTexts).toContain("Notes");
  });

  it("switches tabs on click", async () => {
    const store = useSchemaStore();
    store.addTable("users");
    store.selectedTableId = store.tables[0].id;

    const wrapper = mount(DetailPanel, {
      global: { stubs: { Teleport: true } },
    });

    const tabs = wrapper.findAll("nav button");
    const notesTab = tabs.find(t => t.text().trim() === "Notes");
    if (notesTab) {
      await notesTab.trigger("click");
      expect(wrapper.text()).toContain("Table Notes");
    }
  });

  it("shows notes textarea on notes tab", async () => {
    const store = useSchemaStore();
    store.addTable("users");
    store.selectedTableId = store.tables[0].id;

    const wrapper = mount(DetailPanel, {
      global: { stubs: { Teleport: true } },
    });

    const tabs = wrapper.findAll("nav button");
    const notesTab = tabs.find(t => t.text().trim() === "Notes");
    if (notesTab) {
      await notesTab.trigger("click");
      expect(wrapper.find("textarea").exists()).toBe(true);
    }
  });

  it("columns tab active by default", () => {
    const store = useSchemaStore();
    store.addTable("users");
    store.selectedTableId = store.tables[0].id;

    const wrapper = mount(DetailPanel, {
      global: { stubs: { Teleport: true } },
    });

    const activeTab = wrapper.find(".border-primary-500");
    expect(activeTab.text()).toContain("Columns");
  });
});
