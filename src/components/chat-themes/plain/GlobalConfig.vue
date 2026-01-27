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
        v-model.number="configuring.content_gap"
        hide-details
        label="用户信息到内容间距"
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
  avatar_gap: 8,
  username_to_badge: 4,
  content_gap: 12,
  badge_gap: 8,
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
