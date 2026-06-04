import { describe, it, expect, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import EmbedWatermark from "../EmbedWatermark.vue";
import { useSchemaStore } from "../../stores/schemaStore";

describe("EmbedWatermark.vue", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("renders nothing when isEmbed is false", () => {
    const store = useSchemaStore();
    store.isEmbed = false;
    const wrapper = mount(EmbedWatermark);
    expect(wrapper.find("a").exists()).toBe(false);
  });

  it("renders watermark link when isEmbed is true", () => {
    const store = useSchemaStore();
    store.isEmbed = true;
    const wrapper = mount(EmbedWatermark);
    expect(wrapper.find("a").exists()).toBe(true);
  });

  it("watermark link points to landing page", () => {
    const store = useSchemaStore();
    store.isEmbed = true;
    const wrapper = mount(EmbedWatermark);
    expect(wrapper.find("a").attributes("href")).toBe("https://schemaviz.mystaline.dev");
  });

  it("watermark link opens in new tab", () => {
    const store = useSchemaStore();
    store.isEmbed = true;
    const wrapper = mount(EmbedWatermark);
    expect(wrapper.find("a").attributes("target")).toBe("_blank");
  });

  it("watermark contains SCHEMAVIZ brand text", () => {
    const store = useSchemaStore();
    store.isEmbed = true;
    const wrapper = mount(EmbedWatermark);
    expect(wrapper.text()).toContain("SCHEMAVIZ");
  });
});
