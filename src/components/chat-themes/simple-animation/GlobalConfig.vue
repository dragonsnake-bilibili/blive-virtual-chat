<template>
  <v-row v-if="ready">
    <v-col cols="6">
      <v-text-field
        v-model.number="configuring.box_padding"
        hide-details
        label="包围盒内间距"
        suffix="pixel"
      />
    </v-col>
    <v-col cols="6">
      <v-text-field
        v-model.number="configuring.username_marker_size"
        hide-details
        label="用户名标识尺寸"
        suffix="pixel"
      />
    </v-col>
    <v-col cols="6">
      <v-text-field
        v-model.number="configuring.username_marker_gap"
        hide-details
        label="用户名标识与用户名间距"
        suffix="pixel"
      />
    </v-col>
    <v-col cols="6">
      <v-text-field
        v-model.number="configuring.divider_margin"
        hide-details
        label="分隔线两侧间距"
        suffix="pixel"
      />
    </v-col>
    <v-col cols="6">
      <v-text-field
        v-model.number="configuring.divider_width"
        hide-details
        label="分隔线长度"
        suffix="pixel"
      />
    </v-col>
    <v-col cols="6">
      <v-text-field
        v-model.number="configuring.divider_height"
        hide-details
        label="分隔线宽度"
        suffix="pixel"
      />
    </v-col>
    <v-col cols="6">
      <v-text-field
        v-model.number="configuring.content_width"
        hide-details
        label="内容最大宽度"
        suffix="pixel"
      />
    </v-col>
    <v-col cols="6">
      <v-text-field
        v-model.number="configuring.larger_star_size"
        hide-details
        label="大星星尺寸"
        suffix="pixel"
      />
    </v-col>
    <v-col cols="6">
      <v-text-field
        v-model.number="configuring.smaller_star_size"
        hide-details
        label="小星星尺寸"
        suffix="pixel"
      />
    </v-col>
    <v-col cols="6">
      <v-text-field
        v-model.number="configuring.username_star_blink_rate"
        hide-details
        label="用户名侧星星闪烁周期"
        suffix="ms"
      />
    </v-col>
    <v-col cols="6">
      <v-text-field
        v-model.number="configuring.content_star_blink_rate"
        hide-details
        label="内容侧星星闪烁周期"
        suffix="ms"
      />
    </v-col>
  </v-row>
</template>
<script setup lang="ts">
import type { ThemeSpecifiedConfiguration } from "../interface";
import { onMounted, ref } from "vue";
import { type GlobalConfigures, name } from "./configures";
import diamond_source from "./diamond.svg?raw";

const model_value = defineModel<ThemeSpecifiedConfiguration>({
  required: true,
});

const DefaultConfigure: GlobalConfigures = {
  box_padding: 12,
  username_marker_size: 18,
  username_marker_gap: 12,
  divider_margin: 8,
  divider_width: 350,
  divider_height: 4,
  content_width: 300,
  larger_star_size: 18,
  smaller_star_size: 12,
  username_star_blink_rate: 2000,
  content_star_blink_rate: 1500,
};

const ready = ref(false);

onMounted(() => {
  if (model_value.value.theme !== name) {
    model_value.value.theme = name;
    model_value.value.content = { ...DefaultConfigure };
  }
  const parser = new DOMParser();
  const diamond_helper = parser.parseFromString(
    diamond_source,
    "image/svg+xml",
  );
  diamond_helper.documentElement.setAttribute("fill", "white");
  const serializer = new XMLSerializer();
  diamond.src =
    "data:image/svg+xml;charset=utf-8," +
    encodeURIComponent(serializer.serializeToString(diamond_helper));
  ready.value = true;
});
const configuring = computed(
  () => model_value.value.content as GlobalConfigures,
);
</script>
<script lang="ts">
export const diamond = document.createElement("img");
</script>
