import { describe, it, expect, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import ModalShell from "../ModalShell.vue";

describe("ModalShell.vue", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("renders when isOpen is true", () => {
    const wrapper = mount(ModalShell, {
      props: { isOpen: true },
      global: { stubs: { Teleport: true } },
      slots: { default: "<div>modal content</div>" },
    });
    expect(wrapper.text()).toContain("modal content");
  });

  it("does not render when isOpen is false", () => {
    const wrapper = mount(ModalShell, {
      props: { isOpen: false },
      global: { stubs: { Teleport: true } },
      slots: { default: "<div>modal content</div>" },
    });
    expect(wrapper.text()).toBe("");
  });

  it("emits close on backdrop click when closable", async () => {
    const wrapper = mount(ModalShell, {
      props: { isOpen: true, closable: true },
      global: { stubs: { Teleport: true } },
    });
    // Backdrop is the absolute inset-0 div, first child of [role="dialog"]
    const backdrop = wrapper.find(".absolute.inset-0");
    await backdrop.trigger("click");
    expect(wrapper.emitted("close")).toBeTruthy();
  });

  it("does not emit close on backdrop click when closable is false", async () => {
    const wrapper = mount(ModalShell, {
      props: { isOpen: true, closable: false },
      global: { stubs: { Teleport: true } },
    });
    const backdrop = wrapper.find(".absolute.inset-0");
    await backdrop.trigger("click");
    expect(wrapper.emitted("close")).toBeFalsy();
  });

  it("does not emit close when clicking panel content", async () => {
    const wrapper = mount(ModalShell, {
      props: { isOpen: true, closable: true },
      global: { stubs: { Teleport: true } },
      slots: { default: '<button class="test-btn">Inside panel</button>' },
    });
    await wrapper.find(".test-btn").trigger("click");
    expect(wrapper.emitted("close")).toBeFalsy();
  });

  it("applies maxWidth and padding props", () => {
    const wrapper = mount(ModalShell, {
      props: { isOpen: true, maxWidth: "max-w-md", padding: "p-4" },
      global: { stubs: { Teleport: true } },
    });
    const panel = wrapper.find(".modal-panel");
    expect(panel.classes()).toContain("max-w-md");
    expect(panel.classes()).toContain("p-4");
  });

  it("has aria-modal and role attributes", () => {
    const wrapper = mount(ModalShell, {
      props: { isOpen: true },
      global: { stubs: { Teleport: true } },
    });
    const dialog = wrapper.find('[role="dialog"]');
    expect(dialog.attributes("aria-modal")).toBe("true");
  });
});
