import type { FullChatConfigure } from "../interface";

export const name = "极简紧凑";
export type GlobalConfigures = {
  avatar_gap: number;
  username_to_badge: number;
  content_gap: number;
  badge_gap: number;
};
export type ChatConfigures = {
  name_color: string;
};
export function set_default_configuration(chat: FullChatConfigure): void {
  if (chat.themed.theme !== name) {
    const default_value: ChatConfigures = {
      name_color: "#ffffff",
    };
    chat.themed.content = {
      ...default_value,
    };
  }
}
