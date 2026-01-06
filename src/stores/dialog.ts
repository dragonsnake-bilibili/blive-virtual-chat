import type { Reactive } from "vue";
import { defineStore } from "pinia";
import { reactive } from "vue";

export const useDialog = defineStore("dialog", () => {
  type DialogType = "success" | "info" | "warning" | "error";
  const state: Reactive<{ show: boolean; type: DialogType; title: string; content: string }> = reactive({
    show: false,
    type: "success",
    title: "",
    content: "",
  });
  function show_dialog(type: DialogType, title: string, content?: string) {
    state.type = type;
    state.title = title;
    state.content = content ?? "";
    state.show = true;
  }
  return { state, show_dialog };
});
