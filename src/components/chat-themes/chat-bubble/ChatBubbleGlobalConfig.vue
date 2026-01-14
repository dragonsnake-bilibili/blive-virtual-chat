<template>
  <v-row v-if="ready">
    <v-col cols="6">
      <v-text-field
        v-model.number="configuring.avatar_gap"
        hide-details
        label="头像到内容间距"
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
        v-model.number="configuring.username_to_bubble"
        hide-details
        label="用户名到气泡距离"
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
    <v-col cols="6">
      <v-text-field
        v-model.number="configuring.bubble_padding"
        hide-details
        label="气泡内间距"
        suffix="pixel"
      />
    </v-col>
    <v-col cols="6">
      <v-text-field
        v-model.number="configuring.bubble_radius"
        hide-details
        label="气泡圆角尺寸"
        suffix="pixel"
      />
    </v-col>
    <v-col cols="6">
      <v-text-field
        v-model.number="configuring.start_angle"
        hide-details
        label="起始角"
        suffix="π"
      />
    </v-col>
    <v-col cols="6">
      <v-text-field
        v-model.number="configuring.end_angle"
        hide-details
        label="终止角"
        suffix="π"
      />
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
  avatar_gap: 16,
  username_to_badge: 12,
  username_to_bubble: 12,
  badge_gap: 8,
  bubble_padding: 20,
  bubble_radius: 24,
  start_angle: 0.05,
  end_angle: 0.4,
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
