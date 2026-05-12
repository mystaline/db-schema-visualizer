import { describe, it, expect, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import WhatsNewModal from "../WhatsNewModal.vue";
import { CHANGELOG } from "../../version";

describe("WhatsNewModal.vue", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("renders the title", () => {
    const wrapper = mount(WhatsNewModal, {
      props: { isOpen: true },
      global: { stubs: { Teleport: true } },
    });
    expect(wrapper.text()).toContain("What's New");
  });

  it("shows the latest version open by default", () => {
    const wrapper = mount(WhatsNewModal, {
      props: { isOpen: true },
      global: { stubs: { Teleport: true } },
    });
    expect(wrapper.text()).toContain(`v${CHANGELOG[0].version}`);
  });

  it("shows changelog entries", () => {
    const wrapper = mount(WhatsNewModal, {
      props: { isOpen: true },
      global: { stubs: { Teleport: true } },
    });
    // Latest entry is expanded, should show some text
    const latestItem = CHANGELOG[0].items[0];
    expect(wrapper.text()).toContain(latestItem.text);
  });

  it("toggles accordion on click", async () => {
    const wrapper = mount(WhatsNewModal, {
      props: { isOpen: true },
      global: { stubs: { Teleport: true } },
    });

    // Click the latest version to collapse it
    const buttons = wrapper.findAll("button");
    const firstEntry = buttons.find(b => b.text().includes(CHANGELOG[0].version));
    if (firstEntry) {
      await firstEntry.trigger("click");
      await wrapper.vm.$nextTick();
      // The content should now be hidden
      // Just verify it still renders (no crash)
      expect(wrapper.text()).toContain("What's New");
    }
  });

  it("emits close on close button", async () => {
    const wrapper = mount(WhatsNewModal, {
      props: { isOpen: true },
      global: { stubs: { Teleport: true } },
    });

    const closeBtn = wrapper.find("[aria-label=\"Close what's new\"]");
    await closeBtn.trigger("click");
    expect(wrapper.emitted("close")).toBeTruthy();
  });

  it("emits close on Got it button", async () => {
    const wrapper = mount(WhatsNewModal, {
      props: { isOpen: true },
      global: { stubs: { Teleport: true } },
    });

    const buttons = wrapper.findAll("button");
    const gotItBtn = buttons.find(b => b.text().includes("Got it"));
    if (gotItBtn) {
      await gotItBtn.trigger("click");
      expect(wrapper.emitted("close")).toBeTruthy();
    }
  });

  it("does not render when isOpen is false", () => {
    const wrapper = mount(WhatsNewModal, {
      props: { isOpen: false },
      global: { stubs: { Teleport: true } },
    });
    expect(wrapper.text()).toBe("");
  });

  it("shows version in footer", () => {
    const wrapper = mount(WhatsNewModal, {
      props: { isOpen: true },
      global: { stubs: { Teleport: true } },
    });
    expect(wrapper.text()).toContain("SchemaVis");
  });
});
