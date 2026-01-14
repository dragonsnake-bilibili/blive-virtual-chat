<template>
  <template v-for="(slice, index) in content" :key="`${index}-${slice.key}`">
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
</template>
<script setup lang="ts">
import { computed } from "vue";
import { useEmotes } from "@/stores/emotes";
const emotes = useEmotes();
const props = defineProps<{ paragraph: string }>();
const content = computed(() => {
  const matcher = /\[:(?<type>[^:]+):(?<parameter>[^:]+):\]/g;
  const matches = props.paragraph.matchAll(matcher);
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
          content: props.paragraph.slice(offset, match.index),
          key: `text-${props.paragraph.slice(offset, match.index)}`,
        });
      }
      result.push(special_node);
      offset = match.index + match[0].length;
    }
  }
  if (offset < props.paragraph.length) {
    result.push({
      type: "text",
      content: props.paragraph.slice(offset),
      key: `text-${props.paragraph.slice(offset)}`,
    });
  }
  return result;
});
</script>
