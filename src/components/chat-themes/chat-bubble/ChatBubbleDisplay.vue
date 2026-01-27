<template>
  <div class="container chat-container">
    <v-avatar class="chat-avatar" color="primary" :image="chat.shared.avatar" />
    <div>
      <div class="header">
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
      <div class="main">
        <v-sheet
          class="chat-content"
          elevation="0"
          max-width="100%"
          width="auto"
        >
          <paragraph-display :paragraph="chat.shared.content" />
        </v-sheet>
        <div class="visual-helper" />
      </div>
    </div>
  </div>
</template>
<script lang="ts"></script>
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

const bubble_path = computed(() => {
  const radius = global.value.bubble_radius;
  const start_angle = Math.PI * global.value.start_angle;
  const end_angle = Math.PI * global.value.end_angle;
  const extend_ratio = 1.1;
  function get_coordinate(angle: number): [number, number] {
    const t =
      radius *
      (Math.cos(angle) + Math.sin(angle) - Math.sqrt(Math.sin(2 * angle))) *
      extend_ratio;
    return [t * Math.cos(angle), t * Math.sin(angle)];
  }
  const start_t = get_coordinate(start_angle);
  const end_t = get_coordinate(end_angle);
  return `path("M 0 0 L ${start_t[0]} ${start_t[1]} A ${radius} ${radius} 0 0 0 ${end_t[0]} ${end_t[1]} Z")`;
});
</script>
<style lang="css" scoped>
div.container {
  display: inline-flex;
  align-items: start;
  gap: v-bind("`${global.avatar_gap}px`");
}
div.header {
  margin-bottom: v-bind("`${global.username_to_bubble}px`");
}
span.username {
  color: v-bind("chat.themed.name_color");
  margin-right: v-bind("`${global.username_to_badge}px`");
}
img.chat-logo {
  vertical-align: middle;
  margin-right: v-bind("`${global.badge_gap}px`");
}
div.main {
  position: relative;
  width: fit-content;
}
.chat-content {
  border: none;
  background-color: v-bind("chat.themed.bubble_color");
  padding: v-bind("`${global.bubble_padding}px`");
  border-radius: v-bind("`${global.bubble_radius}px`");
  color: black;
}
.visual-helper {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  width: 100%;
  background-color: v-bind("chat.themed.bubble_color");
  clip-path: v-bind("bubble_path");
}
</style>
