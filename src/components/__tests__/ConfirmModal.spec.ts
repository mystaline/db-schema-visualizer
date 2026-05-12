import { describe, it, expect, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import ConfirmModal from "../ConfirmModal.vue";

describe("ConfirmModal.vue", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  const mountModal = (props = {}) => mount(ConfirmModal, {
    props: { isOpen: true, title: "Delete Item", ...props },
    global: { stubs: { Teleport: true } },
  });

  it("renders title and default confirm label", () => {
    const wrapper = mountModal();
    expect(wrapper.text()).toContain("Delete Item");
    expect(wrapper.text()).toContain("Delete");
  });

  it("renders custom confirmLabel", () => {
    const wrapper = mountModal({ confirmLabel: "Remove" });
    const buttons = wrapper.findAll("button");
    const confirmBtn = buttons[1]; // second button is the confirm
    expect(confirmBtn.text()).toBe("Remove");
  });

  it("renders message when provided", () => {
    const wrapper = mountModal({ message: "This action cannot be undone." });
    expect(wrapper.text()).toContain("This action cannot be undone.");
  });

  it("renders two buttons", () => {
    const wrapper = mountModal();
    const buttons = wrapper.findAll("button");
    expect(buttons.length).toBe(2);
  });

  it("emits confirm when confirm button is clicked", async () => {
    const wrapper = mountModal();
    const buttons = wrapper.findAll("button");
    const confirmBtn = buttons.find(b => b.text() === "Delete")!;
    await confirmBtn.trigger("click");
    expect(wrapper.emitted("confirm")).toBeTruthy();
  });

  it("emits cancel when cancel button is clicked", async () => {
    const wrapper = mountModal();
    const buttons = wrapper.findAll("button");
    const cancelBtn = buttons.find(b => b.text() === "Cancel")!;
    await cancelBtn.trigger("click");
    expect(wrapper.emitted("cancel")).toBeTruthy();
  });

  it("emits cancel when modal shell emits close", async () => {
    const wrapper = mountModal();
    const modalShell = wrapper.findComponent({ name: "ModalShell" });
    await modalShell.vm.$emit("close");
    expect(wrapper.emitted("cancel")).toBeTruthy();
  });

  it("does not render when isOpen is false", () => {
    const wrapper = mount(ConfirmModal, {
      props: { isOpen: false, title: "Test" },
      global: { stubs: { Teleport: true } },
    });
    expect(wrapper.text()).toBe("");
  });
});
