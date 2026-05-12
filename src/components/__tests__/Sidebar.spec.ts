import { describe, it, expect, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import Sidebar from "../Sidebar.vue";
import { useSchemaStore } from "../../stores/schemaStore";

describe("Sidebar.vue", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("renders table count", () => {
    const store = useSchemaStore();
    store.addTable("users");
    store.addTable("orders");

    const wrapper = mount(Sidebar, {
      global: { stubs: { Teleport: true } },
    });
    expect(wrapper.text()).toContain("2");
  });

  it("shows zero count when no tables", () => {
    const wrapper = mount(Sidebar, {
      global: { stubs: { Teleport: true } },
    });
    expect(wrapper.text()).toContain("0");
  });

  it("has search input", () => {
    const wrapper = mount(Sidebar, {
      global: { stubs: { Teleport: true } },
    });
    expect(wrapper.find("input").exists()).toBe(true);
  });

  it("shows New Entity button in full mode", () => {
    const wrapper = mount(Sidebar, {
      global: { stubs: { Teleport: true } },
    });
    expect(wrapper.text()).toContain("New Entity");
  });

  it("hides New Entity button in read mode", () => {
    const store = useSchemaStore();
    store.viewMode = "read";

    const wrapper = mount(Sidebar, {
      global: { stubs: { Teleport: true } },
    });
    expect(wrapper.text()).not.toContain("New Entity");
  });
});
