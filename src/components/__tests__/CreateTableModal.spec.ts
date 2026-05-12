import { describe, it, expect, beforeEach, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import CreateTableModal from "../CreateTableModal.vue";
import { useSchemaStore } from "../../stores/schemaStore";
import { useCreateTableModal } from "../../composables/useCreateTableModal";

describe("CreateTableModal.vue", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    useCreateTableModal().close();
  });

  it("renders when the modal composable is open", () => {
    useCreateTableModal().open(true);

    const wrapper = mount(CreateTableModal, {
      global: { stubs: { Teleport: true } },
    });
    expect(wrapper.text()).toContain("New Table");
  });

  it("shows error for invalid input", async () => {
    useCreateTableModal().open(true);

    const wrapper = mount(CreateTableModal, {
      global: { stubs: { Teleport: true } },
    });
    // The input sanitizer strips non-alphanumeric chars and prepends _ to digit-starting names.
    // So "123" becomes "_123" which is valid. Instead test with a blank name after blur.
    const input = wrapper.find("input[type='text']");
    await input.setValue("");
    await input.trigger("blur");
    // Submit with empty name should have disabled button
    const submitBtn = wrapper.find("button[type='submit']");
    expect(submitBtn.attributes("disabled")).toBeDefined();
  });

  it("creates a table on valid submit", async () => {
    const store = useSchemaStore();
    useCreateTableModal().open(true);

    const wrapper = mount(CreateTableModal, {
      global: { stubs: { Teleport: true } },
    });

    const input = wrapper.find("input[type='text']");
    await input.setValue("my_table");

    const form = wrapper.find("form");
    await form.trigger("submit.prevent");

    await wrapper.vm.$nextTick();
    expect(store.tables.some(t => t.name === "my_table")).toBe(true);
  });

  it("shows duplicate error", async () => {
    const store = useSchemaStore();
    store.addTable("existing");
    useCreateTableModal().open(true);

    const wrapper = mount(CreateTableModal, {
      global: { stubs: { Teleport: true } },
    });

    const input = wrapper.find("input[type='text']");
    await input.setValue("existing");
    await input.trigger("blur");

    expect(wrapper.text()).toContain("already exists");
  });

  it("has Cancel and Create buttons when closable", () => {
    useCreateTableModal().open(true);

    const wrapper = mount(CreateTableModal, {
      global: { stubs: { Teleport: true } },
    });
    expect(wrapper.text()).toContain("Cancel");
    expect(wrapper.text()).toContain("Create");
  });

  it("shows import shortcut when not closable (fresh canvas)", () => {
    useCreateTableModal().open(false);

    const wrapper = mount(CreateTableModal, {
      global: { stubs: { Teleport: true } },
    });
    expect(wrapper.text()).toContain("Import existing schema instead");
  });
});
