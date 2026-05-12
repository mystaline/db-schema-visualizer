import { describe, it, expect, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import TypeSelector from "../TypeSelector.vue";

describe("TypeSelector.vue", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("renders with modelValue", () => {
    const wrapper = mount(TypeSelector, {
      props: { modelValue: "varchar" },
      global: { stubs: { Teleport: true } },
    });
    const trigger = wrapper.find("button");
    // The text is rendered with CSS uppercase, so raw text is lowercase
    expect(trigger.text().toLowerCase()).toContain("varchar");
  });

  it("renders placeholder when modelValue is empty", () => {
    const wrapper = mount(TypeSelector, {
      props: { modelValue: "" },
      global: { stubs: { Teleport: true } },
    });
    expect(wrapper.text().toLowerCase()).toContain("select type");
  });

  it("does not open dropdown when disabled", async () => {
    const wrapper = mount(TypeSelector, {
      props: { modelValue: "text", disabled: true },
      global: { stubs: { Teleport: true } },
    });
    await wrapper.find("button").trigger("click");
    expect(wrapper.text()).not.toContain("Numeric");
  });

  it("emits update:modelValue when a type is selected", async () => {
    const wrapper = mount(TypeSelector, {
      props: { modelValue: "text" },
      global: { stubs: { Teleport: true } },
    });
    await wrapper.find("button").trigger("click");
    await wrapper.vm.$nextTick();
    const textarea = wrapper.find("input[type='text']");
    // The search input appears; use keyboard: type 'integer' and press Enter
    await textarea.setValue("integer");
    // Press Enter to use custom
    await textarea.trigger("keydown", { key: "Enter" });
    expect(wrapper.emitted("update:modelValue")?.[0]).toEqual(["integer"]);
  });

  it("opens dropdown on trigger click", async () => {
    const wrapper = mount(TypeSelector, {
      props: { modelValue: "" },
      global: { stubs: { Teleport: true } },
    });
    await wrapper.find("button").trigger("click");
    await wrapper.vm.$nextTick();
    expect(wrapper.html()).toContain("Search or type custom");
  });

  it("shows group sections when open", async () => {
    const wrapper = mount(TypeSelector, {
      props: { modelValue: "" },
      global: { stubs: { Teleport: true } },
    });
    await wrapper.find("button").trigger("click");
    await wrapper.vm.$nextTick();
    expect(wrapper.html()).toContain("Numeric");
    expect(wrapper.html()).toContain("Text");
  });

  it("filters types based on search", async () => {
    const wrapper = mount(TypeSelector, {
      props: { modelValue: "" },
      global: { stubs: { Teleport: true } },
    });
    await wrapper.find("button").trigger("click");
    await wrapper.vm.$nextTick();

    const searchInput = wrapper.find("input[type='text']");
    await searchInput.setValue("json");
    await wrapper.vm.$nextTick();

    expect(wrapper.html()).toContain("jsonb");
    expect(wrapper.html()).toContain("JSON/NoSQL");
  });
});
