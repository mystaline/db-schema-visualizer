import { describe, it, expect, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import ColumnEditor from "../ColumnEditor.vue";
import { useSchemaStore } from "../../stores/schemaStore";

describe("ColumnEditor Role Access (viewMode)", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("disables inputs and hides 'Add column' in read mode", async () => {
    const store = useSchemaStore();
    store.addTable("users");
    const tId = store.tables[0].id;
    store.addColumn(tId);
    store.selectedTableId = tId;

    store.viewMode = "read";

    const wrapper = mount(ColumnEditor, {
      global: { stubs: { Teleport: true } },
    });

    const nameInput = wrapper.find('input[aria-label^="Column name"]');
    expect(nameInput.attributes()).toHaveProperty("readonly");

    // PK button should be disabled in read mode
    const pkBtn = wrapper.find('button[aria-label$="is primary key"]');
    expect(pkBtn.attributes()).toHaveProperty("disabled");

    const allButtons = wrapper.findAll("button");
    const hasAddButton = allButtons.some(b => b.text().toLowerCase().includes("add column"));
    expect(hasAddButton).toBe(false);
  });

  it("enables inputs and shows 'Add column' in full mode", async () => {
    const store = useSchemaStore();
    store.addTable("users");
    const tId = store.tables[0].id;
    store.addColumn(tId);
    store.selectedTableId = tId;

    store.viewMode = "full";

    const wrapper = mount(ColumnEditor, {
      global: { stubs: { Teleport: true } },
    });

    const nameInput = wrapper.find('input[aria-label^="Column name"]');
    expect(nameInput.attributes()).not.toHaveProperty("readonly");

    const allButtons = wrapper.findAll("button");
    const hasAddButton = allButtons.some(b => b.text().toLowerCase().includes("add column"));
    expect(hasAddButton).toBe(true);
  });
});
