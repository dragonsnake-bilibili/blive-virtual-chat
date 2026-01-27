<template>
  <v-row>
    <v-col class="mx-auto" cols="6">
      <div>
        <p style="text-align: center">用户名颜色</p>
        <v-color-picker
          v-model="chat.name_color"
          class="mx-auto"
          show-swatches
          :swatches="[['#25885B'], ['#638CF8'], ['#FFFFFF']]"
        />
      </div>
    </v-col>
  </v-row>
</template>
<script setup lang="ts">
import type { ThemeSpecifiedConfiguration } from "../interface";
import type { ChatConfigures } from "./configures";
import { computed } from "vue";
const model_value = defineModel<ThemeSpecifiedConfiguration>({
  required: true,
});
const chat = computed(() => model_value.value.content as ChatConfigures);
</script>
