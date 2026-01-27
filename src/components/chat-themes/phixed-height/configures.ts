import type { FullChatConfigure } from "../interface";

export const name = "菲可变高度卡片";
export type GlobalConfigures = {
  card_height: number;
  card_radius: number;
  card_padding: number;
  content_width: number;
  content_lines: number;
  card_background: string;
  transparent_ratio: number;
  username_font_size: number;
  username_to_badge: number;
  username_to_content: number;
  badge_gap: number;
};
export type ChatConfigures = {
  color: string;
};
export function set_default_configuration(chat: FullChatConfigure): void {
  if (chat.themed.theme !== name) {
    const default_value: ChatConfigures = {
      color: "#ffffff",
    };
    chat.themed.content = {
      ...default_value,
    };
  }
}
