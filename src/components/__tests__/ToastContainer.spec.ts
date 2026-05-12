import { describe, it, expect, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import ToastContainer from "../ToastContainer.vue";
import { useToast } from "../../composables/useToast";

// Clear the singleton state between test suites
const { toasts } = useToast();

describe("ToastContainer.vue", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    toasts.value = [];
  });

  it("renders a success toast", () => {
    const { toast } = useToast();
    toast("Operation completed", "success");

    const wrapper = mount(ToastContainer, {
      global: { stubs: { Teleport: true } },
    });
    expect(wrapper.text()).toContain("Operation completed");
  });

  it("renders an error toast", () => {
    const { toast } = useToast();
    toast("Something went wrong", "error");

    const wrapper = mount(ToastContainer, {
      global: { stubs: { Teleport: true } },
    });
    expect(wrapper.text()).toContain("Something went wrong");
  });

  it("renders an info toast", () => {
    const { toast } = useToast();
    toast("Just a heads up", "info");

    const wrapper = mount(ToastContainer, {
      global: { stubs: { Teleport: true } },
    });
    expect(wrapper.text()).toContain("Just a heads up");
  });

  it("renders multiple toasts", () => {
    const { toast } = useToast();
    toast("First", "success");
    toast("Second", "error");

    const wrapper = mount(ToastContainer, {
      global: { stubs: { Teleport: true } },
    });
    expect(wrapper.text()).toContain("First");
    expect(wrapper.text()).toContain("Second");
  });

  it("shows empty state when no toasts", () => {
    // toasts already cleared in beforeEach
    const wrapper = mount(ToastContainer, {
      global: { stubs: { Teleport: true } },
    });
    expect(wrapper.text().trim()).toBe("");
  });

  it("applies success class for success type", () => {
    const { toast } = useToast();
    toast("Done", "success");

    const wrapper = mount(ToastContainer, {
      global: { stubs: { Teleport: true } },
    });
    const el = wrapper.find(".text-success-500");
    expect(el.exists()).toBe(true);
  });

  it("applies error class for error type", () => {
    const { toast } = useToast();
    toast("Error!", "error");

    const wrapper = mount(ToastContainer, {
      global: { stubs: { Teleport: true } },
    });
    const el = wrapper.find(".text-danger-500");
    expect(el.exists()).toBe(true);
  });
});
