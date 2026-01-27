<template>
  <div class="chat-container container">
    <v-avatar class="chat-avatar" :image="chat.shared.avatar" />
    <div>
      <span class="user-info">
        <span class="username">{{ chat.shared.username }}：</span>
        <img
          v-if="chat.shared.logos.manager"
          class="chat-logo"
          :src="emotes.find_emote('special/房管')"
        />
        <img
          v-if="chat.shared.logos.governor"
          class="chat-logo"
          :src="emotes.find_emote('special/总督')"
        />
        <img
          v-if="chat.shared.logos.admiral"
          class="chat-logo"
          :src="emotes.find_emote('special/提督')"
        />
        <img
          v-if="chat.shared.logos.captain"
          class="chat-logo"
          :src="emotes.find_emote('special/舰长')"
        />
      </span>
      <paragraph-display :paragraph="chat.shared.content" />
    </div>
  </div>
</template>
<script setup lang="ts">
import type {
  FullChatConfigure,
  ThemeSpecifiedConfiguration,
} from "../interface";
import type { ChatConfigures, GlobalConfigures } from "./configures";
import { computed } from "vue";
import { useEmotes } from "@/stores/emotes";

const emotes = useEmotes();
const props = defineProps<{
  chatConfig: FullChatConfigure;
  globalConfig: ThemeSpecifiedConfiguration;
}>();
const chat = computed(() => ({
  shared: props.chatConfig.shared,
  themed: props.chatConfig.themed.content as ChatConfigures,
}));
const global = computed(() => props.globalConfig.content as GlobalConfigures);
</script>
<style lang="css" scoped>
.container {
  display: flex;
  align-items: start;
  gap: v-bind("`${global.avatar_gap}px`");
}
.username {
  color: v-bind("chat.themed.name_color");
}
.user-info {
  margin-right: v-bind("`${global.content_gap}px`");
}
.chat-logo {
  vertical-align: text-bottom;
}
.chat-logo:nth-child(2) {
  margin-left: v-bind("`${global.username_to_badge}px`");
}
.chat-logo:not(:nth-child(2)) {
  margin-left: v-bind("`${global.badge_gap}px`");
}
</style>
