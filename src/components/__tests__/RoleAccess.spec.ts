import { describe, it, expect, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import ColumnEditor from "../ColumnEditor.vue";
import { useSchemaStore } from "../../stores/schemaStore";

describe("ColumnEditor Role Access (viewMode)", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("disables inputs and hides 'Add Attribute' in read mode", async () => {
    const store = useSchemaStore();
    store.addTable("users");
    const tId = store.tables[0].id;
    store.addColumn(tId);
    store.selectedTableId = tId;

    // Set viewMode to 'read'
    store.viewMode = "read";

    const wrapper = mount(ColumnEditor);

    // Check if name input is readonly
    const nameInput = wrapper.find('input[aria-label^="Column name"]');
    expect(nameInput.attributes()).toHaveProperty("readonly");

    // Check if checkboxes are disabled
    const pkCheckbox = wrapper.find('input[aria-label$="is primary key"]');
    expect(pkCheckbox.attributes()).toHaveProperty("disabled");

    // Check if 'Insert New Attribute' button is hidden
    // Note: wrapper.find uses CSS selectors. Usually easier to check existence.
    const allButtons = wrapper.findAll("button");
    const hasAddButton = allButtons.some(b => b.text().includes("Insert New Attribute"));
    expect(hasAddButton).toBe(false);
  });

  it("enables inputs and shows 'Add Attribute' in full mode", async () => {
    const store = useSchemaStore();
    store.addTable("users");
    const tId = store.tables[0].id;
    store.addColumn(tId);
    store.selectedTableId = tId;

    // Set viewMode to 'full' (default)
    store.viewMode = "full";

    const wrapper = mount(ColumnEditor);

    const nameInput = wrapper.find('input[aria-label^="Column name"]');
    expect(nameInput.attributes()).not.toHaveProperty("readonly");

    const allButtons = wrapper.findAll("button");
    const hasAddButton = allButtons.some(b => b.text().includes("Insert New Attribute"));
    expect(hasAddButton).toBe(true);
  });
});
