import { describe, it, expect, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import RelationLines from "../RelationLines.vue";
import { useSchemaStore } from "../../stores/schemaStore";

describe("RelationLines.vue", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("renders SVG element", () => {
    const wrapper = mount(RelationLines);
    expect(wrapper.find("svg").exists()).toBe(true);
  });

  it("has aria-label for foreign key relationships", () => {
    const wrapper = mount(RelationLines);
    expect(wrapper.find("svg").attributes("aria-label")).toBe("Foreign key relationships");
  });

  it("renders no paths when no foreign keys", () => {
    const store = useSchemaStore();
    store.addTable("t1");
    store.addTable("t2");

    const wrapper = mount(RelationLines);
    const paths = wrapper.findAll("path");
    // Only the arrowhead marker def and defs element exist, no relation paths beyond that
    // SVG paths with `d` attributes for relations should be empty
    const relationPaths = paths.filter(p => p.attributes("d")?.startsWith("M "));
    expect(relationPaths.length).toBe(0);
  });

  it("renders relation paths when foreign keys exist", () => {
    const store = useSchemaStore();
    store.addTable("orders");
    store.addTable("customers");
    const t1Id = store.tables[0].id;
    const t2Id = store.tables[1].id;
    store.addColumn(t1Id);
    store.addColumn(t2Id);

    store.tables[0].x = 0;
    store.tables[0].y = 0;
    store.tables[1].x = 300;
    store.tables[1].y = 0;

    store.addForeignKey({
      sourceTableId: t1Id,
      sourceColumnId: store.tables[0].columns[0].id,
      targetTableId: t2Id,
      targetColumnId: store.tables[1].columns[0].id,
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    });

    const wrapper = mount(RelationLines);
    const paths = wrapper.findAll("path");
    const relationPaths = paths.filter(p => p.attributes("d")?.startsWith("M "));
    expect(relationPaths.length).toBeGreaterThan(0);
  });

  it("skips broken foreign keys (missing tables/columns)", () => {
    const store = useSchemaStore();
    store.foreignKeys.push({
      id: "broken-fk",
      sourceTableId: "nonexistent",
      sourceColumnId: "nonexistent",
      targetTableId: "nonexistent",
      targetColumnId: "nonexistent",
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    });

    const wrapper = mount(RelationLines);
    const paths = wrapper.findAll("path");
    const relationPaths = paths.filter(p => p.attributes("d")?.startsWith("M "));
    expect(relationPaths.length).toBe(0);
  });
});
