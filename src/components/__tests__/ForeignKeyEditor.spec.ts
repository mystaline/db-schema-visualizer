import { describe, it, expect, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import ForeignKeyEditor from "../ForeignKeyEditor.vue";
import { useSchemaStore } from "../../stores/schemaStore";

describe("ForeignKeyEditor.vue", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("renders outgoing relations correctly", () => {
    const store = useSchemaStore();

    // Setup tables/columns
    store.addTable("orders");
    store.addTable("customers");
    const t1Id = store.tables[0].id;
    const t2Id = store.tables[1].id;

    store.addColumn(t1Id);
    store.addColumn(t2Id);
    const c1Id = store.tables[0].columns[0].id;
    const c2Id = store.tables[1].columns[0].id;

    // Set column names for display checks
    store.tables[0].columns[0].name = "source_col";
    store.tables[1].columns[0].name = "target_col";
    const table = store.tables[0];
    const uId = table.id;
    const cId = table.columns[0].id;
    store.selectedTableId = uId; // Set selected table so outgoing FKs are visible

    store.addForeignKey({
      sourceTableId: uId,
      sourceColumnId: cId,
      targetTableId: uId,
      targetColumnId: cId,
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    });

    const wrapper = mount(ForeignKeyEditor);

    expect(wrapper.text()).toContain("source_col");
    expect(wrapper.text()).toContain("orders.source_col");
  });

  it("renders foreign keys correctly", async () => {
    setActivePinia(createPinia());
    const store = useSchemaStore();
    store.addTable("orders");
    const tId = store.tables[0].id;
    store.addColumn(tId); // id
    const col1 = store.tables[0].columns[0].id;
    store.selectedTableId = tId;

    store.addForeignKey({
      sourceTableId: tId,
      sourceColumnId: col1,
      targetTableId: tId,
      targetColumnId: col1,
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    });

    const wrapper = mount(ForeignKeyEditor);
    expect(wrapper.text()).toContain("new_column");
  });
});
