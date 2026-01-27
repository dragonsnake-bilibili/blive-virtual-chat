<template>
  <div class="chat-container container">
    <div class="user-info">
      <img class="chat-avatar" :src="chat.shared.avatar" />
      <div class="background-layer" />
      <span class="username">{{ chat.shared.username }}</span>
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
    </div>
    <div class="content-controller">
      <paragraph-display :paragraph="chat.shared.content" />
    </div>
  </div>
</template>
<script setup lang="ts">
import type { ChatConfigures, GlobalConfigures } from "./configures";
import { computed, inject } from "vue";
import { useEmotes } from "@/stores/emotes";
import {
  type FullChatConfigure,
  inj_SharedGlobalConfigurations,
  type ThemeSpecifiedConfiguration,
} from "../interface";

const emotes = useEmotes();
const configuring = inject(inj_SharedGlobalConfigurations)!;
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
  position: relative;
  border-radius: v-bind("`${global.card_radius}px`");
  width: v-bind("`${configuring.chat_width_limit}px`");
  height: v-bind("`${global.card_height}px`");
  padding: v-bind("`${global.card_padding}px`");
  overflow: hidden;
  background: v-bind("global.card_background");
}
.chat-avatar {
  position: absolute;
  top: 50%;
  right: 0;
  transform: translateY(-50%);
  mask-image: linear-gradient(
    to left,
    black 0%,
    transparent v-bind("`${global.transparent_ratio * 100}%`")
  );
}
.user-info {
  margin-bottom: v-bind("`${global.username_to_content}px`");
  font-size: v-bind("`${global.username_font_size}px`");
}
.username {
  color: v-bind("chat.themed.color");
  margin-right: v-bind("`${global.username_to_badge}px`");
}
.chat-logo {
  vertical-align: middle;
  margin-right: v-bind("`${global.badge_gap}px`");
}
.content-controller {
  max-width: v-bind("`${global.content_width}px`");
  line-height: 1.5em;
  max-height: v-bind("`${global.content_lines * 1.5}em`");
  overflow: hidden;
  color: v-bind("`${chat.themed.color}`");
}
</style>
