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
    await wrapper.find('[role="dialog"]').trigger("click.self");
    expect(wrapper.emitted("close")).toBeTruthy();
  });

  it("does not emit close on backdrop click when closable is false", async () => {
    const wrapper = mount(ModalShell, {
      props: { isOpen: true, closable: false },
      global: { stubs: { Teleport: true } },
    });
    await wrapper.find('[role="dialog"]').trigger("click.self");
    expect(wrapper.emitted("close")).toBeFalsy();
  });

  it("emits close on ESC when closable", async () => {
    const wrapper = mount(ModalShell, {
      props: { isOpen: true, closable: true },
      global: { stubs: { Teleport: true } },
    });
    await wrapper.find('[role="dialog"]').trigger("keydown.esc");
    expect(wrapper.emitted("close")).toBeTruthy();
  });

  it("does not emit close on ESC when closable is false", async () => {
    const wrapper = mount(ModalShell, {
      props: { isOpen: true, closable: false },
      global: { stubs: { Teleport: true } },
    });
    await wrapper.find('[role="dialog"]').trigger("keydown.esc");
    expect(wrapper.emitted("close")).toBeFalsy();
  });

  it("applies maxWidth and padding props", () => {
    const wrapper = mount(ModalShell, {
      props: { isOpen: true, maxWidth: "max-w-md", padding: "p-4" },
      global: { stubs: { Teleport: true } },
    });
    const panel = wrapper.find(".relative");
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
    expect(dialog.attributes("tabindex")).toBe("-1");
  });
});
