import { describe, it, expect, beforeEach, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import ExportModal from "../ExportModal.vue";
import { useSchemaStore } from "../../stores/schemaStore";

describe("ExportModal.vue", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    window.URL.createObjectURL = vi.fn();
    window.URL.revokeObjectURL = vi.fn();
  });

  it("shows empty schema warning when no tables", () => {
    const wrapper = mount(ExportModal, {
      props: { isOpen: true },
      global: { stubs: { Teleport: true } },
    });
    expect(wrapper.text()).toContain("there is nothing to export");
  });

  it("shows SQL tab active by default", () => {
    const wrapper = mount(ExportModal, {
      props: { isOpen: true },
      global: { stubs: { Teleport: true } },
    });
    const sqlTab = wrapper.find("#export-tab-sql");
    expect(sqlTab.text()).toContain("SQL");
  });

  it("generates CREATE TABLE SQL for a table with columns", () => {
    const store = useSchemaStore();
    store.addTable("users");
    const tId = store.tables[0].id;
    store.addColumn(tId);
    store.updateColumn(tId, store.tables[0].columns[0].id, {
      name: "id", type: "uuid", isPrimaryKey: true, isNullable: false,
    });

    const wrapper = mount(ExportModal, {
      props: { isOpen: true },
      global: { stubs: { Teleport: true } },
    });

    const sql = (wrapper.find("textarea").element as HTMLTextAreaElement).value;
    expect(sql).toContain("CREATE TABLE users");
    expect(sql).toContain("PRIMARY KEY (id)");
  });

  it("generates JSON output on JSON tab", async () => {
    const store = useSchemaStore();
    store.addTable("test");

    const wrapper = mount(ExportModal, {
      props: { isOpen: true },
      global: { stubs: { Teleport: true } },
    });

    const jsonTab = wrapper.find("#export-tab-json");
    await jsonTab.trigger("click");

    const json = (wrapper.find("textarea").element as HTMLTextAreaElement).value;
    expect(json).toContain('"tables"');
    expect(json).toContain('"test"');
  });

  it("switches between SQL and JSON tabs", async () => {
    const store = useSchemaStore();
    store.addTable("test");

    const wrapper = mount(ExportModal, {
      props: { isOpen: true },
      global: { stubs: { Teleport: true } },
    });

    expect((wrapper.find("textarea").element as HTMLTextAreaElement).value).toContain("CREATE TABLE");

    await wrapper.find("#export-tab-json").trigger("click");
    expect((wrapper.find("textarea").element as HTMLTextAreaElement).value).toContain('"tables"');
  });

  it("emits close when close button is clicked", async () => {
    const wrapper = mount(ExportModal, {
      props: { isOpen: true },
      global: { stubs: { Teleport: true } },
    });

    const closeBtn = wrapper.find("[aria-label='Close modal']");
    await closeBtn.trigger("click");
    expect(wrapper.emitted("close")).toBeTruthy();
  });

  it("does not render when isOpen is false", () => {
    const wrapper = mount(ExportModal, {
      props: { isOpen: false },
      global: { stubs: { Teleport: true } },
    });
    expect(wrapper.text()).toBe("");
  });

  it("renders the sidebar only on SQL tab", async () => {
    const store = useSchemaStore();
    store.addTable("alpha");

    const wrapper = mount(ExportModal, {
      props: { isOpen: true },
      global: { stubs: { Teleport: true } },
    });
    expect(wrapper.find('[data-testid="sidebar-row-all"]').exists()).toBe(true);

    await wrapper.find("#export-tab-json").trigger("click");
    expect(wrapper.find('[data-testid="sidebar-row-all"]').exists()).toBe(false);
  });

  it("clicking an entity row switches to single view; preview reflects only that entity", async () => {
    const store = useSchemaStore();
    store.addTable("alpha");
    store.addTable("beta");
    const wrapper = mount(ExportModal, {
      props: { isOpen: true },
      global: { stubs: { Teleport: true } },
    });
    const alphaId = store.tables[0].id;
    await wrapper.find(`[data-testid="sidebar-row-entity-${alphaId}"]`).trigger("click");
    const sql = (wrapper.find("textarea").element as HTMLTextAreaElement).value;
    expect(sql).toContain("CREATE TABLE alpha");
    expect(sql).not.toContain("CREATE TABLE beta");
  });

  it("entering bundle mode shows checkboxes with all entities pre-checked", async () => {
    const store = useSchemaStore();
    store.addTable("alpha");
    store.addTable("beta");
    const wrapper = mount(ExportModal, {
      props: { isOpen: true },
      global: { stubs: { Teleport: true } },
    });
    await wrapper.find('[data-testid="sidebar-row-bundle"]').trigger("click");
    // Check that all entity rows show bundle mode styling (text-secondary-300 for checked)
    const alphaId = store.tables[0].id;
    const betaId = store.tables[1].id;
    const alphaRow = wrapper.find(`[data-testid="sidebar-row-entity-${alphaId}"]`);
    const betaRow = wrapper.find(`[data-testid="sidebar-row-entity-${betaId}"]`);
    expect(alphaRow.classes()).toContain("text-secondary-300");
    expect(betaRow.classes()).toContain("text-secondary-300");
    // bundleSelectedIds should contain both
    expect(store.tables.length).toBe(2);
  });

  it("shows placeholder when bundle mode has 0 entities checked", async () => {
    const store = useSchemaStore();
    store.addTable("alpha");
    store.addTable("beta");
    const wrapper = mount(ExportModal, {
      props: { isOpen: true },
      global: { stubs: { Teleport: true } },
    });
    await wrapper.find('[data-testid="sidebar-row-bundle"]').trigger("click");
    // Uncheck all via select-all checkbox
    await wrapper.find('[data-testid="sidebar-checkbox-selectall"]').trigger("click");
    const sql = (wrapper.find("textarea").element as HTMLTextAreaElement).value;
    expect(sql).toBe("-- Select entities from the sidebar to preview SQL");
  });

  it("ZIP button is disabled with tooltip in single view mode", async () => {
    const store = useSchemaStore();
    store.addTable("alpha");
    const wrapper = mount(ExportModal, {
      props: { isOpen: true },
      global: { stubs: { Teleport: true } },
    });
    const alphaId = store.tables[0].id;
    await wrapper.find(`[data-testid="sidebar-row-entity-${alphaId}"]`).trigger("click");
    const zipBtn = wrapper.find('[data-testid="footer-btn-zip"]');
    expect(zipBtn.attributes("aria-disabled")).toBe("true");
    expect(zipBtn.attributes("title")).toContain("Bundle");
  });

  it("ZIP button is disabled when only 1 entity checked in bundle mode", async () => {
    const store = useSchemaStore();
    store.addTable("alpha");
    store.addTable("beta");
    const wrapper = mount(ExportModal, {
      props: { isOpen: true },
      global: { stubs: { Teleport: true } },
    });
    await wrapper.find('[data-testid="sidebar-row-bundle"]').trigger("click");
    // Uncheck one by clicking its row
    const betaId = store.tables[1].id;
    await wrapper.find(`[data-testid="sidebar-row-entity-${betaId}"]`).trigger("click");
    const zipBtn = wrapper.find('[data-testid="footer-btn-zip"]');
    expect(zipBtn.attributes("aria-disabled")).toBe("true");
    expect(zipBtn.attributes("title")).toContain("Select 2+");
  });

  it("shows cross-boundary banner only when bundle mode has unchecked targets of FKs", async () => {
    const store = useSchemaStore();
    store.addTable("alpha");
    store.addTable("beta");
    const a = store.tables[0];
    const b = store.tables[1];
    store.addColumn(a.id);
    store.addColumn(b.id);
    store.addForeignKey({
      sourceTableId: b.id, sourceColumnId: b.columns[0].id,
      targetTableId: a.id, targetColumnId: a.columns[0].id,
      onDelete: "CASCADE", onUpdate: "CASCADE",
    });

    const wrapper = mount(ExportModal, {
      props: { isOpen: true },
      global: { stubs: { Teleport: true } },
    });
    // All mode: no banner.
    expect(wrapper.find('[data-testid="banner-cross-boundary"]').exists()).toBe(false);

    await wrapper.find('[data-testid="sidebar-row-bundle"]').trigger("click");
    // Both checked: no banner.
    expect(wrapper.find('[data-testid="banner-cross-boundary"]').exists()).toBe(false);

    // Uncheck alpha (the FK target) — banner appears.
    await wrapper.find(`[data-testid="sidebar-row-entity-${a.id}"]`).trigger("click");
    expect(wrapper.find('[data-testid="banner-cross-boundary"]').exists()).toBe(true);
  });
});
