import type {
  FullChatConfigure,
  FullGlobalConfigure,
} from "@/components/chat-themes/interface";

type Previewer = (
  configuring: FullGlobalConfigure,
  chat_configs: FullChatConfigure[],
  scene: HTMLDivElement,
) => {
  play: () => Promise<void>;
};

type Rendering = (
  chats: FullChatConfigure[],
  configuring: FullGlobalConfigure,
  update_progress: (ratio: number) => void,
) => Promise<string>;

export type SceneVariant = {
  name: string;
  display_name: string;
  preview: Previewer;
  render: Rendering;
};
