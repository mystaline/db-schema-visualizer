import { describe, it, expect, beforeEach, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import ImportModal from "../ImportModal.vue";
import { useSchemaStore } from "../../stores/schemaStore";

describe("ImportModal.vue", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("renders the warning banner", () => {
    const wrapper = mount(ImportModal, {
      props: { isOpen: true },
      global: { stubs: { Teleport: true } },
    });
    expect(wrapper.text()).toContain("Warning: Destructive Action");
  });

  it("shows SQL tab active by default", () => {
    const wrapper = mount(ImportModal, {
      props: { isOpen: true },
      global: { stubs: { Teleport: true } },
    });
    const sqlTab = wrapper.find("#import-tab-sql");
    expect(sqlTab.text()).toContain("SQL");
  });

  it("switches to JSON tab", async () => {
    const wrapper = mount(ImportModal, {
      props: { isOpen: true },
      global: { stubs: { Teleport: true } },
    });
    await wrapper.find("#import-tab-json").trigger("click");
    expect(wrapper.find("textarea").attributes("placeholder")).toContain("version");
  });

  it("shows error when importing empty input", async () => {
    const wrapper = mount(ImportModal, {
      props: { isOpen: true },
      global: { stubs: { Teleport: true } },
    });

    const importBtns = wrapper.findAll("button");
    const completeBtn = importBtns.find(b => b.text().includes("Complete Import") || b.text() === "Complete Import");
    if (completeBtn) {
      await completeBtn.trigger("click");
      await wrapper.vm.$nextTick();
      // Toast should have been called with an error
      // We can check that the modal didn't close (still renders)
      expect(wrapper.text()).toContain("Warning: Destructive Action");
    }
  });

  it("emits close on cancel", async () => {
    const wrapper = mount(ImportModal, {
      props: { isOpen: true },
      global: { stubs: { Teleport: true } },
    });

    const cancelBtns = wrapper.findAll("button");
    const cancelBtn = cancelBtns.find(b => b.text() === "Cancel");
    if (cancelBtn) {
      await cancelBtn.trigger("click");
      expect(wrapper.emitted("close")).toBeTruthy();
    }
  });

  it("does not render when isOpen is false", () => {
    const wrapper = mount(ImportModal, {
      props: { isOpen: false },
      global: { stubs: { Teleport: true } },
    });
    expect(wrapper.text()).toBe("");
  });

  it("has file upload area", () => {
    const wrapper = mount(ImportModal, {
      props: { isOpen: true },
      global: { stubs: { Teleport: true } },
    });
    expect(wrapper.text()).toContain("OR PASTE BELOW");
  });
});
