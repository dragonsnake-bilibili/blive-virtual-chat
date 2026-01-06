<template>
  <main-view />
</template>

<script lang="ts">
import { useEmotes } from "@/stores/emotes";
</script>
<script lang="ts" setup>
import { onMounted } from "vue";
const emotes = useEmotes();
async function load_default_emotes() {
  const pack_loaders = import.meta.glob("@/assets/emote-packs/*.json");
  for (const pack_loader of Object.values(pack_loaders)) {
    const pack = await pack_loader();
    emotes.load_pack_direct(pack as any);
  }
}
onMounted(() => {
  load_default_emotes();
});
</script>
