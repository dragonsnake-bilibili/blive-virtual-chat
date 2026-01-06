<template>
  <div class="container chat-container">
    <v-avatar
      class="chat-avatar"
      color="primary"
      :image="props.config.avatar"
    />
    <div>
      <div class="header">
        <span class="username">{{ props.config.username }}</span>
        <img
          v-if="props.config.logos.manager"
          class="chat-logo"
          :src="emotes.find_emote('special/房管')"
        />
        <img
          v-if="props.config.logos.governor"
          class="chat-logo"
          :src="emotes.find_emote('special/总督')"
        />
        <img
          v-if="props.config.logos.admiral"
          class="chat-logo"
          :src="emotes.find_emote('special/提督')"
        />
        <img
          v-if="props.config.logos.captain"
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
          <template
            v-for="(slice, index) in content"
            :key="`${index}-${slice.key}`"
          >
            <span v-if="slice.type === 'text'">{{ slice.content }}</span>
            <img
              v-else-if="slice.type === 'image'"
              class="chat-content-image"
              :src="slice.src"
            />
            <span
              v-else-if="slice.type === 'space'"
              :style="`width: ${slice.width}; display: inline-block`"
            />
          </template>
        </v-sheet>
        <div class="visual-helper" />
      </div>
    </div>
  </div>
</template>
<script lang="ts"></script>
<script setup lang="ts">
import { computed, onBeforeUnmount } from "vue";
import { useEmotes } from "@/stores/emotes";
export type ChatConfig = {
  id: string;
  username: string;
  avatar: string;
  bubble_color: string;
  name_color: string;
  enter_millisecond: number;
  content: string;
  logos: {
    captain: boolean;
    admiral: boolean;
    governor: boolean;
    manager: boolean;
  };
};
const emotes = useEmotes();
const props = defineProps<{
  config: ChatConfig;
}>();

onBeforeUnmount(() => {
  if (props.config.avatar !== "") {
    URL.revokeObjectURL(props.config.avatar);
  }
});

const content = computed(() => {
  const matcher = /\[:(?<type>[^:]+):(?<parameter>[^:]+):\]/g;
  const matches = props.config.content.matchAll(matcher);
  let offset = 0;
  const result: ((
    | { type: "image"; src: string }
    | { type: "text"; content: string }
    | { type: "space"; width: string }
  ) & { key: string })[] = [];
  for (const match of matches) {
    const special_node = ((): (typeof result)[0] | null => {
      if (match.groups!.type === "emote") {
        const image = emotes.find_emote(match.groups!.parameter!);
        if (image === undefined) {
          return null;
        }
        return { type: "image", src: image, key: `image-${image}` };
      } else if (match.groups!.type === "space") {
        return {
          type: "space",
          width: match.groups!.parameter!,
          key: crypto.randomUUID(),
        };
      }
      return null;
    })();
    if (special_node !== null) {
      if (offset < match.index) {
        result.push({
          type: "text",
          content: props.config.content.slice(offset, match.index),
          key: `text-${props.config.content.slice(offset, match.index)}`,
        });
      }
      result.push(special_node);
      offset = match.index + match[0].length;
    }
  }
  if (offset < props.config.content.length) {
    result.push({
      type: "text",
      content: props.config.content.slice(offset),
      key: `text-${props.config.content.slice(offset)}`,
    });
  }
  return result;
});
</script>
<style lang="css" scoped>
div.container {
  display: inline-flex;
  align-items: start;
  gap: 16px;
  font-family: "HarmonyOS Sans SC";
}
div.header {
  margin-bottom: 12px;
}
span.username {
  color: v-bind("props.config.name_color");
}
div.main {
  position: relative;
  width: fit-content;
}
.chat-content {
  border: none;
  background-color: v-bind("props.config.bubble_color");
  color: black;
}
.visual-helper {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  width: 100%;
  background-color: v-bind("props.config.bubble_color");
}
</style>
