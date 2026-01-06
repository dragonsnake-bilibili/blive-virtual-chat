import type { Reactive } from "vue";
import { defineStore } from "pinia";
import { reactive } from "vue";

export const useEmotes = defineStore("emotes", () => {
  const loaded_packs: Reactive<Map<string, Map<string, string>>> = reactive(new Map());

  function load_pack_direct(pack: { name: string; emoji: { name: string; image: string }[] }) {
    const { name, emoji } = pack;
    const emotes = new Map<string, string>(emoji.map(({ name: emote_name, image }) => {
      // @ts-ignore
      const raw = new Blob([Uint8Array.fromBase64(image)]);
      return [`${name}/${emote_name}`, URL.createObjectURL(raw)];
    }));
    loaded_packs.set(name, emotes);
  }

  async function load_pack(pack: Blob) {
    const { name, emoji } = JSON.parse(new TextDecoder().decode(await pack.bytes()));
    if (loaded_packs.has(name)) {
      return;
    }
    load_pack_direct({ name, emoji });
  }

  function find_emote(name: string): string | undefined {
    const delimiter = name.indexOf("/");
    if (delimiter === -1) {
      return undefined;
    }
    const pack = name.slice(0, delimiter);
    const pack_content = loaded_packs.get(pack);
    if (pack_content === undefined) {
      return undefined;
    }
    return pack_content.get(name);
  }
  return { loaded_packs, load_pack_direct, load_pack, find_emote };
});
