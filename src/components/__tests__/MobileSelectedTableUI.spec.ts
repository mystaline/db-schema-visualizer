import { describe, it, expect, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import MobileSelectedTableUI from "../MobileSelectedTableUI.vue";
import { useSchemaStore } from "../../stores/schemaStore";

describe("MobileSelectedTableUI.vue", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("does not render when no table selected", () => {
    const wrapper = mount(MobileSelectedTableUI, {
      global: { stubs: { Teleport: true } },
    });
    expect(wrapper.find(".fixed").exists()).toBe(false);
  });

  it("renders when a table is selected", () => {
    const store = useSchemaStore();
    store.addTable("users");
    store.selectedTableId = store.tables[0].id;

    const wrapper = mount(MobileSelectedTableUI, {
      global: { stubs: { Teleport: true } },
    });
    expect(wrapper.text()).toContain("users");
  });

  it("shows bottom nav bar with tab buttons", () => {
    const store = useSchemaStore();
    store.addTable("users");
    store.selectedTableId = store.tables[0].id;

    const wrapper = mount(MobileSelectedTableUI, {
      global: { stubs: { Teleport: true } },
    });

    expect(wrapper.text()).toContain("Columns");
    expect(wrapper.text()).toContain("Relations");
    expect(wrapper.text()).toContain("Indexes");
    expect(wrapper.text()).toContain("Checks");
    expect(wrapper.text()).toContain("Delete");
  });

  it("opens mobile sheet on tab click", async () => {
    const store = useSchemaStore();
    store.addTable("users");
    const tId = store.tables[0].id;
    store.addColumn(tId);
    store.selectedTableId = tId;

    const wrapper = mount(MobileSelectedTableUI, {
      global: { stubs: { Teleport: true } },
    });

    const tabs = wrapper.findAll("button");
    const columnsBtn = tabs.find(b => b.text().includes("Columns"));
    if (columnsBtn) {
      await columnsBtn.trigger("click");
      await wrapper.vm.$nextTick();
      // The active tab should now be "columns"
      const vm = wrapper.vm as any;
      expect(vm.activeTab).toBe("columns");
    }
  });
});
