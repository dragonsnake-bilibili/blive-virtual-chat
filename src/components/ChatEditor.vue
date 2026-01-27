<template>
  <v-form class="border-thin pa-4 chat-editor">
    <v-text-field
      v-model.number="chat.enter_millisecond"
      hide-details
      label="入场时刻"
      suffix="ms"
    />
    <v-text-field v-model="chat.username" hide-details label="用户名" />
    <v-row>
      <v-col>
        <v-switch v-model="chat.logos.manager" color="primary" label="管理" />
      </v-col>
      <v-col>
        <v-switch v-model="chat.logos.governor" color="primary" label="总督" />
      </v-col>
      <v-col>
        <v-switch v-model="chat.logos.admiral" color="primary" label="提督" />
      </v-col>
      <v-col>
        <v-switch v-model="chat.logos.captain" color="primary" label="舰长" />
      </v-col>
    </v-row>
    <v-file-input
      hide-details
      label="头像"
      @update:model-value="update_avatar"
    />
    <v-textarea
      ref="content-input"
      v-model="chat.content"
      clearable
      hide-details
      label="内容"
      variant="outlined"
    >
      <template #prepend-inner>
        <v-overlay
          activator="parent"
          location="top center"
          location-strategy="connected"
          open-on-click
          :scrim="false"
        >
          <template #activator="{ props: activator }">
            <v-btn
              v-bind="activator"
              icon="mdi-emoticon-outline"
              variant="plain"
            />
          </template>
          <emote-picker @pick="insert_emote" />
        </v-overlay>
      </template>
    </v-textarea>
  </v-form>
</template>
<script setup lang="ts">
import type { SharedChatConfigure } from "./chat-themes/interface";
import { useAvatars } from "@/stores/avatars";

const avatars = useAvatars();

const chat = defineModel<SharedChatConfigure>({ required: true });

const content_input = useTemplateRef("content-input");

async function update_avatar(file: File | File[] | undefined | null) {
  if (file === null || file === undefined) {
    return;
  }
  if (Array.isArray(file) && file.length === 0) {
    return;
  }
  const source = Array.isArray(file) ? file[0]! : file;
  if (chat.value.avatar !== "") {
    avatars.unload_avatar(chat.value.avatar);
  }
  chat.value.avatar = await avatars.load_avatar(source);
}

function insert_emote(emote: string) {
  if (content_input.value === null) {
    return;
  }
  const underlying: HTMLTextAreaElement =
    content_input.value.$el.querySelector("textarea");
  chat.value.content = `${chat.value.content.slice(0, underlying.selectionStart)}[:emote:${emote}:]${chat.value.content.slice(underlying.selectionEnd)}`;
}
</script>
<style lang="css" scoped>
.chat-editor > *:not(:first-child) {
  margin: 12px auto;
}
</style>
