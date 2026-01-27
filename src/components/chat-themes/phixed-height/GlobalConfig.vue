<template>
  <v-row v-if="ready">
    <v-col cols="6">
      <v-text-field
        v-model.number="configuring.card_height"
        hide-details
        label="卡片高度"
        suffix="pixel"
      />
    </v-col>
    <v-col cols="6">
      <v-text-field
        v-model.number="configuring.card_radius"
        hide-details
        label="卡片圆角尺寸"
        suffix="pixel"
      />
    </v-col>
    <v-col cols="6">
      <v-text-field
        v-model.number="configuring.card_padding"
        hide-details
        label="卡片内间距"
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
        v-model.number="configuring.content_lines"
        hide-details
        label="内容最大行数"
      />
    </v-col>
    <v-col cols="6">
      <v-text-field
        v-model.number="configuring.transparent_ratio"
        hide-details
        label="头像完全透明开始位置"
      />
    </v-col>
    <v-col cols="6">
      <v-text-field
        v-model.number="configuring.username_font_size"
        hide-details
        label="用户名字体大小"
        suffix="pixel"
      />
    </v-col>
    <v-col cols="6">
      <v-text-field
        v-model.number="configuring.username_to_badge"
        hide-details
        label="用户名到徽章距离"
        suffix="pixel"
      />
    </v-col>
    <v-col cols="6">
      <v-text-field
        v-model.number="configuring.username_to_content"
        hide-details
        label="用户名到内容距离"
        suffix="pixel"
      />
    </v-col>
    <v-col cols="6">
      <v-text-field
        v-model.number="configuring.badge_gap"
        hide-details
        label="徽章间距"
        suffix="pixel"
      />
    </v-col>
    <v-col class="mx-auto" cols="12">
      <div>
        <p style="text-align: center">卡片背景</p>
        <v-color-picker v-model="configuring.card_background" class="mx-auto" />
      </div>
    </v-col>
  </v-row>
</template>
<script setup lang="ts">
import type { ThemeSpecifiedConfiguration } from "../interface";
import { computed, onMounted, ref } from "vue";
import { type GlobalConfigures, name } from "./configures";
const model_value = defineModel<ThemeSpecifiedConfiguration>({
  required: true,
});

const DefaultConfigure: GlobalConfigures = {
  card_height: 160,
  card_radius: 18,
  card_padding: 12,
  content_width: 200,
  content_lines: 2,
  card_background: "#00000066",
  transparent_ratio: 0.9,
  username_font_size: 14,
  username_to_badge: 8,
  username_to_content: 12,
  badge_gap: 6,
};

const ready = ref(false);
onMounted(() => {
  if (model_value.value.theme !== name) {
    model_value.value.theme = name;
    model_value.value.content = { ...DefaultConfigure };
  }
  ready.value = true;
});
const configuring = computed(
  () => model_value.value.content as GlobalConfigures,
);
</script>
