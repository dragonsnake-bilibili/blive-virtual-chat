<template>
  <v-card class="picker-container">
    <v-card-text>
      <v-tabs-window v-model="current_tab">
        <v-tabs-window-item
          v-for="[pack_name, pack] in emotes.loaded_packs"
          :key="pack_name"
          class="tab-window"
          :value="`${pack_name}/`"
        >
          <v-row class="mx-auto">
            <v-col
              v-for="[name, image] in pack"
              :key="name"
              class="flex-grow-0"
            >
              <v-img
                height="36px"
                :src="image"
                width="36px"
                @click="emit('pick', name)"
              />
            </v-col>
          </v-row>
        </v-tabs-window-item>
        <v-tabs-window-item class="tab-window" value="new">
          <v-file-input
            label="Pick an emote pack"
            @update:model-value="load_emote"
          />
        </v-tabs-window-item>
      </v-tabs-window>
      <v-tabs v-model="current_tab" show-arrows>
        <v-tab
          v-for="[pack_name, pack] in emotes.loaded_packs"
          :key="pack_name"
          :value="`${pack_name}/`"
        >
          <v-img height="36px" :src="pack.values().next().value" width="36px" />
        </v-tab>
        <v-tab value="new">
          <v-icon icon="mdi-plus-box-outline" size="36px" />
        </v-tab>
      </v-tabs>
    </v-card-text>
  </v-card>
</template>
<script setup lang="ts">
import type { Ref } from "vue";
import { onMounted, ref } from "vue";
import { useEmotes } from "@/stores/emotes";
const emotes = useEmotes();
const emit = defineEmits<{
  pick: [string];
}>();

const current_tab: Ref<string> = ref("new");
onMounted(() => {
  if (emotes.loaded_packs.size > 0) {
    current_tab.value = `${emotes.loaded_packs.keys().next().value!}/`;
  }
});

function load_emote(file_: File | File[] | undefined | null) {
  if (file_ === undefined || file_ === null) {
    return;
  }
  if (Array.isArray(file_) && file_.length === 0) {
    return;
  }
  const file = Array.isArray(file_) ? file_[0]! : file_;
  emotes.load_pack(file);
}
</script>
<style lang="css" scoped>
.picker-container {
  width: 20vw;
}
.tab-window {
  height: 25vh;
  width: 100%;
  overflow-y: scroll;
  scrollbar-width: none;
}
</style>
