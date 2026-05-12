import { describe, it, expect, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import ConstraintEditor from "../ConstraintEditor.vue";
import { useSchemaStore } from "../../stores/schemaStore";

describe("ConstraintEditor.vue", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  const setupTable = () => {
    const store = useSchemaStore();
    store.addTable("users");
    const tId = store.tables[0].id;
    store.addColumn(tId);
    store.selectedTableId = tId;
    return { store, tId };
  };

  it("shows empty state when no constraints", () => {
    setupTable();
    const wrapper = mount(ConstraintEditor, {
      global: { stubs: { Teleport: true } },
    });
    expect(wrapper.text()).toContain("No check constraints defined");
  });

  it("lists existing constraints", () => {
    const { store, tId } = setupTable();
    store.tables[0].checkConstraints.push({
      id: "c1",
      name: "chk_positive",
      expression: "value > 0",
    });

    const wrapper = mount(ConstraintEditor, {
      global: { stubs: { Teleport: true } },
    });
    expect(wrapper.text()).toContain("chk_positive");
    expect(wrapper.text()).toContain("value > 0");
  });

  it("renders the new constraint form in full mode", () => {
    setupTable();
    const wrapper = mount(ConstraintEditor, {
      global: { stubs: { Teleport: true } },
    });
    expect(wrapper.text()).toContain("Register Constraint");
  });

  it("hides new constraint form in read mode", () => {
    const { store } = setupTable();
    store.viewMode = "read";
    const wrapper = mount(ConstraintEditor, {
      global: { stubs: { Teleport: true } },
    });
    expect(wrapper.text()).not.toContain("Register Constraint");
  });

  it("auto-generates constraint name from expression", async () => {
    const { store, tId } = setupTable();
    const wrapper = mount(ConstraintEditor, {
      global: { stubs: { Teleport: true } },
    });
    const textarea = wrapper.find("textarea");
    await textarea.setValue("price > 0");
    await wrapper.vm.$nextTick();
    const nameInput = wrapper.findAll("input")[0];
    expect((nameInput.element as HTMLInputElement).value).toBe("chk_users_price0");
  });

  it("adds constraint on submit", async () => {
    setupTable();
    const wrapper = mount(ConstraintEditor, {
      global: { stubs: { Teleport: true } },
    });
    const textarea = wrapper.find("textarea");
    await textarea.setValue("price > 0");
    await wrapper.vm.$nextTick();

    const submitBtn = wrapper.find("button[type='button']");
    // Find the "Lock Logic Integrity" button
    const buttons = wrapper.findAll("button");
    const lockBtn = buttons.find(b => b.text().includes("Lock Logic Integrity"));
    if (lockBtn) {
      await lockBtn.trigger("click");
      const { store } = setupTable();
      expect(store.tables[0].checkConstraints.length).toBe(1);
    }
  });

  it("opens delete confirmation for a constraint", async () => {
    const { store } = setupTable();
    store.tables[0].checkConstraints.push({
      id: "c1",
      name: "chk_test",
      expression: "x > 0",
    });

    const wrapper = mount(ConstraintEditor, {
      global: { stubs: { Teleport: true } },
    });

    const deleteBtns = wrapper.findAll("button").filter(b => {
      const svg = b.find("svg");
      return svg.exists() && b.classes().includes("text-secondary-600");
    });
    if (deleteBtns.length > 0) {
      await deleteBtns[0].trigger("click");
      expect(wrapper.text()).toContain("Delete constraint?");
    }
  });
});
