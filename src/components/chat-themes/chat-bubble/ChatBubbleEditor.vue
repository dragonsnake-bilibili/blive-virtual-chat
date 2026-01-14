<template>
  <v-row>
    <v-col>
      <div>
        <p style="text-align: center">Username color</p>
        <v-color-picker
          v-model="chat.name_color"
          class="mx-auto"
          show-swatches
          :swatches="[['#25885B'], ['#638CF8'], ['#FFFFFF']]"
        />
      </div>
    </v-col>
    <v-col>
      <div>
        <p style="text-align: center">Bubble color</p>
        <v-color-picker
          v-model="chat.bubble_color"
          class="mx-auto"
          show-swatches
          :swatches="[['#2BEA28'], ['#2960FB'], ['#FFFFFF']]"
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
<style lang="css" scoped>
.chat-editor > *:not(:first-child) {
  margin: 12px auto;
}
</style>
