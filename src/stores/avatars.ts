import { defineStore } from "pinia";

type AvatarControlBlock = {
  hash: string;
  url: string;
  references: number;
};

export const useAvatars = defineStore("avatars", () => {
  const hash_view: Map<string, AvatarControlBlock> = new Map();
  const url_view: Map<string, AvatarControlBlock> = new Map();

  async function load_avatar(avatar: Blob) {
    const content = await avatar.arrayBuffer();
    const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", content));
    // @ts-ignore
    const key: string = hash.toBase64();
    const existing = hash_view.get(key);
    if (existing === undefined) {
      const new_avatar = {
        hash: key,
        url: URL.createObjectURL(avatar),
        references: 1,
      };
      hash_view.set(new_avatar.hash, new_avatar);
      url_view.set(new_avatar.url, new_avatar);
      return new_avatar.url;
    } else {
      existing.references += 1;
      return existing.url;
    }
  }

  function register_new_reference(url: string) {
    const target = url_view.get(url);
    if (target === undefined) {
      return;
    }
    target.references += 1;
  }

  function unload_avatar(url: string) {
    const target = url_view.get(url);
    if (target === undefined) {
      return;
    }
    target.references -= 1;
    if (target.references === 0) {
      url_view.delete(target.url);
      hash_view.delete(target.hash);
      URL.revokeObjectURL(target.url);
    }
  }

  async function dump(): Promise<{
    url_mapping: Map<string, string>;
    data: {
      hash: string;
      references: number;
      data: string;
    }[];
  }> {
    const extracts = hash_view
      .values()
      .map(async ({ hash, url, references }) => {
        const load = await fetch(url);
        const bytes = await load.bytes();
        // @ts-ignore
        return { hash, references, data: bytes.toBase64() };
      });
    return {
      url_mapping: new Map<string, string>(
        hash_view.entries().map(([_, { hash, url }]) => [url, hash]),
      ),
      data: await Promise.all(extracts),
    };
  }

  function load(
    extracted: {
      hash: string;
      references: number;
      data: string;
    }[],
  ): Map<string, string> {
    for (const { url } of hash_view.values()) {
      URL.revokeObjectURL(url);
    }
    hash_view.clear();
    url_view.clear();
    for (const { hash, references, data } of extracted) {
      // @ts-ignore
      const raw_avatar: Uint8Array = Uint8Array.fromBase64(data);
      const avatar = new Blob([raw_avatar as BufferSource]);
      const new_avatar = {
        hash,
        url: URL.createObjectURL(avatar),
        references,
      };
      hash_view.set(new_avatar.hash, new_avatar);
      url_view.set(new_avatar.url, new_avatar);
    }
    return new Map<string, string>(
      hash_view.entries().map(([_, { hash, url }]) => [hash, url]),
    );
  }

  return { load_avatar, register_new_reference, unload_avatar, dump, load };
});
