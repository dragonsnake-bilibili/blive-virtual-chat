<template>
  <div class="chat-container container">
    <div class="username-line">
      <div class="username-marker" />
      <div class="username-content">{{ chat.shared.username }}</div>
      <div class="username-marker" />
      <diamond class="star large-star username-side animated" />
      <diamond class="star small-star username-side animated" />
    </div>
    <div class="divider" />
    <div class="content-side-star-helper">
      <span class="content">
        <paragraph-display :paragraph="chat.shared.content" />
      </span>
      <diamond class="star large-star content-side animated" />
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
import diamond from "./diamond.svg?component";

const props = defineProps<{
  chatConfig: FullChatConfigure;
  globalConfig: ThemeSpecifiedConfiguration;
}>();
const chat = computed(() => ({
  shared: props.chatConfig.shared,
  themed: props.chatConfig.themed.content as ChatConfigures,
}));
const global = computed(() => props.globalConfig.content as GlobalConfigures);
const marker_clip = computed(() => {
  const unit_size = global.value.username_marker_size / 5;
  return `path("M ${unit_size * 2} 0 L ${unit_size * 3} 0 L ${unit_size * 3} ${unit_size * 2} L ${unit_size * 5} ${unit_size * 2} L ${unit_size * 5} ${unit_size * 3} L ${unit_size * 3} ${unit_size * 3} L ${unit_size * 3} ${unit_size * 5} L ${unit_size * 2} ${unit_size * 5} L ${unit_size * 2} ${unit_size * 3} L 0 ${unit_size * 3} L 0 ${unit_size * 2} L ${unit_size * 2} ${unit_size * 2} Z")`;
});
</script>
<style lang="css" scoped>
.container {
  color: white;
  padding: v-bind("`${global.box_padding}px`");
}
.username-line {
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: v-bind("`${global.username_marker_gap}px`");
}
.username-marker {
  height: v-bind("`${global.username_marker_size}px`");
  width: v-bind("`${global.username_marker_size}px`");
  background-color: white;
  clip-path: v-bind("marker_clip");
}
.divider {
  background-color: white;
  height: v-bind("`${global.divider_height}px`");
  width: v-bind("`${global.divider_width}px`");
  margin: v-bind("`${global.divider_margin}px`") auto;
}
.content-side-star-helper {
  position: relative;
  margin: 0 auto;
  text-align: center;
}
.content {
  display: inline-block;
  max-width: v-bind("`${global.content_width}px`");
}

@keyframes blink {
  0% {
    filter: opacity(1);
  }
  50% {
    filter: opacity(0);
  }
  100% {
    filter: opacity(1);
  }
}

.star {
  position: absolute;
  fill: white;
  animation-timing-function: ease-in-out;
  animation-iteration-count: infinite;
}
.star.animated {
  animation-name: blink;
}
.large-star {
  height: v-bind("`${global.larger_star_size}px`");
  width: v-bind("`${global.larger_star_size}px`");
}
.small-star {
  height: v-bind("`${global.smaller_star_size}px`");
  width: v-bind("`${global.smaller_star_size}px`");
}
.username-side {
  animation-duration: v-bind("`${global.username_star_blink_rate}ms`");
}
.username-side.small-star {
  left: 0.25ex;
  bottom: 0.25ex;
}
.username-side.large-star {
  left: 0.5em;
  bottom: calc(0.25em + 0.5ex);
}
.content-side {
  right: 0;
  top: 0.25em;
  animation-duration: v-bind("`${global.content_star_blink_rate}ms`");
}
</style>
