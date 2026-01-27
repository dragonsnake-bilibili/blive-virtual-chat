import type { FullChatConfigure } from "../interface";

export const name = "简洁轻动画";
export type GlobalConfigures = {
  box_padding: number;
  username_marker_size: number;
  username_marker_gap: number;
  divider_margin: number;
  divider_width: number;
  divider_height: number;
  content_width: number;
  larger_star_size: number;
  smaller_star_size: number;
  username_star_blink_rate: number;
  content_star_blink_rate: number;
};
export type ChatConfigures = {};
export function set_default_configuration(chat: FullChatConfigure): void {
  if (chat.themed.theme !== name) {
    chat.themed.content = {};
  }
}
