<template>
  <v-form class="border-thin pa-4 chat-editor">
    <v-text-field v-model="chat.id" disabled hide-details label="ID" readonly />
    <v-text-field
      v-model.number="chat.enter_millisecond"
      hide-details
      label="enter time"
      suffix="ms"
    />
    <v-text-field v-model="chat.username" hide-details label="username" />
    <v-row>
      <v-col><v-switch v-model="chat.logos.manager" label="manager" /></v-col>
      <v-col><v-switch v-model="chat.logos.governor" label="governor" /></v-col>
      <v-col><v-switch v-model="chat.logos.admiral" label="admiral" /></v-col>
      <v-col><v-switch v-model="chat.logos.captain" label="captain" /></v-col>
    </v-row>
    <v-file-input
      hide-details
      label="avatar"
      @update:model-value="update_avatar"
    />
    <v-textarea
      ref="content-input"
      v-model="chat.content"
      clearable
      hide-details
      label="content"
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
    URL.revokeObjectURL(chat.value.avatar);
  }
  chat.value.avatar = URL.createObjectURL(source);
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
