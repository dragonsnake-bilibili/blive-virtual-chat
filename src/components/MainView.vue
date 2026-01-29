<template>
  <v-row id="fullscreen-target" justify="space-between">
    <v-col :class="configuring.running_mode ? '' : 'flex-grow-0'">
      <div class="scene">
        <div class="chat-list-container chat-list-container-default">
          <component
            :is="configuring.selected_theme.display"
            v-for="(chat, index) in chats"
            v-if="configuring.selected_theme !== null"
            :id="`chat-${chat.shared.id}`"
            :key="chat.shared.id"
            :chat-config="chat"
            :global-config="themed_configuring"
            @click="edit_chat(index)"
          />
        </div>
      </div>
    </v-col>
    <v-col class="flex-grow-1">
      <v-container class="config-area">
        <v-switch
          v-model="configuring.debug"
          color="secondary"
          label="调试模式"
        />
        <v-select
          v-model="configuring.preselected_theme"
          item-title="name"
          :items="CHAT_THEMES"
          label="选择主题"
          return-object
          @update:model-value="switch_theme"
        />
        <v-row>
          <v-col>
            <v-select
              v-model="configuring.selected_mode"
              item-title="display_name"
              :items="SceneVariants"
              label="场景模式"
              return-object
            />
          </v-col>
          <v-col>
            <v-select
              v-model="configuring.main_axis"
              :items="
                Object.entries(MainAxisDirection).map(([k, v]) => ({
                  title: v,
                  value: k,
                }))
              "
              label="主轴方向"
            />
          </v-col>
          <v-col>
            <v-select
              v-model="configuring.flow_direction"
              :items="
                Object.entries(FlowDirection).map(([k, v]) => ({
                  title: v,
                  value: k,
                }))
              "
              label="移动方向"
            />
          </v-col>
        </v-row>
        <v-card>
          <v-card-title>共享全局设置</v-card-title>
          <v-card-subtitle>对所有主题下的所有弹幕生效</v-card-subtitle>
          <v-card-text>
            <v-row>
              <v-col>
                <div>
                  <p style="text-align: center">场景背景</p>
                  <v-color-picker
                    v-model="configuring.background"
                    class="mx-auto"
                  />
                </div>
              </v-col>
              <v-col
                style="
                  display: flex;
                  flex-direction: column;
                  justify-content: space-around;
                "
              >
                <v-text-field
                  v-model.number="configuring.scene_width"
                  class="flex-grow-0"
                  hide-details
                  label="场景宽度"
                  suffix="pixel"
                />
                <v-text-field
                  v-model.number="configuring.scene_height"
                  class="flex-grow-0"
                  hide-details
                  label="场景高度"
                  suffix="pixel"
                />
                <v-text-field
                  v-model.number="configuring.fps"
                  class="flex-grow-0"
                  hide-details
                  label="录制帧率"
                />
              </v-col>
            </v-row>
            <v-row>
              <v-col cols="6">
                <v-text-field
                  v-model.number="configuring.chat_width_limit"
                  hide-details
                  label="消息最大宽度"
                  suffix="pixel"
                />
              </v-col>
              <v-col cols="6">
                <v-text-field
                  v-model.number="configuring.chat_margin"
                  hide-details
                  label="消息间距"
                  suffix="pixel"
                />
              </v-col>
              <v-col cols="6">
                <v-text-field
                  v-model.number="configuring.chat_avatar_size"
                  hide-details
                  label="头像尺寸"
                />
              </v-col>
              <v-col cols="6">
                <v-text-field
                  v-model.number="configuring.chat_font_size"
                  hide-details
                  label="字体大小"
                />
              </v-col>
              <v-col cols="6">
                <v-text-field
                  v-model.number="configuring.chat_logo_size"
                  hide-details
                  label="徽章尺寸"
                  suffix="pixel"
                />
              </v-col>
              <v-col cols="6">
                <v-text-field
                  v-model.number="configuring.chat_emote_size"
                  hide-details
                  label="表情尺寸"
                  suffix="pixel"
                />
              </v-col>
              <v-col cols="6">
                <v-text-field
                  v-model.number="configuring.lift_duration"
                  hide-details
                  label="消息位置调整时长"
                  suffix="ms"
                />
              </v-col>
              <v-col cols="6">
                <v-text-field
                  v-model.number="configuring.enter_duration"
                  hide-details
                  label="消息入场时长"
                  suffix="ms"
                />
              </v-col>
              <v-col cols="6">
                <v-text-field
                  v-model.number="configuring.delay_before_start"
                  hide-details
                  label="开始前延迟时长"
                  suffix="ms"
                />
              </v-col>
              <v-col cols="6">
                <v-text-field
                  v-model.number="configuring.keep_after_end"
                  hide-details
                  label="结束后保持时长"
                  suffix="ms"
                />
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>
        <v-card v-if="configuring.selected_theme !== null">
          <v-card-title>主题全局设置</v-card-title>
          <v-card-subtitle>
            对{{ configuring.selected_theme.name }}主题下的所有弹幕生效
          </v-card-subtitle>
          <v-card-text>
            <component
              :is="configuring.selected_theme.global_configure"
              v-if="configuring.selected_theme !== null"
              v-model="themed_configuring"
            />
          </v-card-text>
        </v-card>
        <v-divider v-if="configuring.selected_theme !== null" />
        <v-card v-if="configuring.selected_theme !== null && chat_editor.show">
          <v-card>
            <v-card-title>通用消息设置</v-card-title>
            <v-card-subtitle>
              消息的基础信息，切换主题不变且总有意义
            </v-card-subtitle>
            <v-card-text>
              <chat-editor v-model="chats[chat_editor.target]!.shared" />
            </v-card-text>
          </v-card>
          <v-divider />
          <v-card>
            <v-card-title>主题消息设置</v-card-title>
            <v-card-subtitle>
              仅在当前主题下生效的设置，切换后会消失
            </v-card-subtitle>
            <v-card-text>
              <component
                :is="configuring.selected_theme!.editor"
                v-if="chat_editor.show"
                v-model="chats[chat_editor.target]!.themed"
              />
            </v-card-text>
          </v-card>
          <v-card-actions>
            <v-row>
              <v-col>
                <v-btn block @click="render_single_chat"> 渲染 </v-btn>
              </v-col>
              <v-col>
                <v-btn block @click="duplicate_chat"> 复制 </v-btn>
              </v-col>
              <v-col>
                <v-btn block color="warning" @click="cancel_chat">
                  {{ chat_editor.creating ? "取消" : "删除" }}
                </v-btn>
              </v-col>
              <v-col>
                <v-btn block color="primary" @click="finish_chat">完成</v-btn>
              </v-col>
            </v-row>
          </v-card-actions>
        </v-card>
        <v-btn
          v-else-if="configuring.selected_theme !== null"
          block
          @click="new_chat"
        >
          新消息
        </v-btn>
        <v-divider v-if="configuring.selected_theme !== null" />
        <v-row v-if="configuring.selected_theme !== null">
          <v-col>
            <v-btn block :disabled="chats.length === 0" @click="play">
              预览
            </v-btn>
          </v-col>
          <v-col style="display: flex">
            <v-spacer v-if="record_status.recording" />
            <v-progress-circular
              v-if="record_status.recording"
              v-model="record_status.progress"
            />
            <v-btn v-else block :disabled="chats.length === 0" @click="record">
              录制
            </v-btn>
            <v-spacer v-if="record_status.recording" />
          </v-col>
        </v-row>
        <v-divider />
        <v-expansion-panels>
          <v-expansion-panel v-model="import_export.show">
            <v-expansion-panel-title>导入/导出</v-expansion-panel-title>
            <v-expansion-panel-text>
              <v-file-input
                v-model="import_export.content"
                label="选择文件开始导入"
              />
              <v-row>
                <v-col v-if="configuring.selected_theme !== null">
                  <v-btn block @click="do_export">导出</v-btn>
                </v-col>
                <template
                  v-if="
                    import_export.content !== null &&
                    import_export.content !== undefined &&
                    (!Array.isArray(import_export.content) ||
                      import_export.content.length > 0)
                  "
                >
                  <v-col>
                    <v-btn
                      block
                      @click="do_import({ config: true, content: true })"
                    >
                      导入
                    </v-btn>
                  </v-col>
                  <v-col>
                    <v-btn
                      block
                      @click="do_import({ config: true, content: false })"
                    >
                      仅导入配置
                    </v-btn>
                  </v-col>
                  <v-col v-if="configuring.selected_theme !== null">
                    <v-btn
                      block
                      @click="do_import({ config: false, content: true })"
                    >
                      仅导入内容
                    </v-btn>
                  </v-col>
                </template>
              </v-row>
            </v-expansion-panel-text>
          </v-expansion-panel>
        </v-expansion-panels>
      </v-container>
    </v-col>
  </v-row>

  <v-dialog v-model="dialog.state.show" width="auto">
    <v-alert
      border="start"
      closable
      max-width="60vw"
      :title="dialog.state.title"
      :type="dialog.state.type"
      @click:close="dialog.state.show = false"
    >
      {{ dialog.state.content }}
    </v-alert>
  </v-dialog>
</template>

<script setup lang="ts">
import type { Reactive, Ref, ShallowReactive } from "vue";
import {
  computed,
  nextTick,
  provide,
  reactive,
  ref,
  shallowReactive,
  toRaw,
} from "vue";
import { useGoTo } from "vuetify";
import SceneVariants from "@/scene";
import { useAvatars } from "@/stores/avatars";
import { useDialog } from "@/stores/dialog";
import versioning from "@/versioning.json";
import CHAT_THEMES from "./chat-themes";
import {
  type FullChatConfigure,
  type FullGlobalConfigure,
  inj_SharedGlobalConfigurations,
  type SharedChatConfigure,
  type ThemeSpecification,
  type ThemeSpecifiedConfiguration,
} from "./chat-themes/interface";
const goto = useGoTo();
const dialog = useDialog();
const avatars = useAvatars();

function build_empty_chat(): SharedChatConfigure {
  return {
    id: crypto.randomUUID(),
    username: "",
    avatar: "",
    enter_millisecond: 0,
    content: "",
    logos: {
      captain: false,
      admiral: false,
      governor: false,
      manager: false,
    },
  };
}

const configuring: ShallowReactive<Configuring> = shallowReactive({
  debug: false,
  running_mode: false,
  selected_theme: null,
  preselected_theme: null,
  selected_mode: SceneVariants[0] ?? null,
  main_axis: "vertical",
  flow_direction: "default",
  scene_width: 400,
  scene_height: 600,
  fps: 60,
  chat_width_limit: 400,
  chat_margin: 24,
  chat_avatar_size: 48,
  chat_font_size: 18,
  chat_logo_size: 20,
  chat_emote_size: 24,
  font_family: "HarmonyOS Sans SC",
  lift_duration: 100,
  enter_duration: 400,
  delay_before_start: 500,
  keep_after_end: 500,
  background: "#ffffff",
});
provide(inj_SharedGlobalConfigurations, configuring);
const themed_configuring: Ref<ThemeSpecifiedConfiguration> = ref({
  theme: "",
  content: {},
});

const chats: Reactive<FullChatConfigure[]> = reactive([]);

const full_global_configure = computed(
  (): FullGlobalConfigure => ({
    shared: configuring,
    themes: themed_configuring.value,
  }),
);

function switch_theme() {
  if (configuring.preselected_theme === null) {
    return;
  }
  for (const chat of chats) {
    configuring.preselected_theme.prepare_chat(chat);
    chat.themed.theme = configuring.selected_theme!.name;
  }
  configuring.selected_theme = configuring.preselected_theme;
}

const chat_editor: Reactive<{
  show: boolean;
  creating: boolean;
  target: number;
}> = reactive({
  show: false,
  creating: true,
  target: -1,
});

function new_chat() {
  const base = {
    shared: build_empty_chat(),
    themed: { theme: "", content: {} },
  };
  configuring.selected_theme!.prepare_chat(base);
  base.themed.theme = configuring.selected_theme!.name;
  chat_editor.target = chats.push(base) - 1;
  chat_editor.creating = true;
  chat_editor.show = true;
}
function edit_chat(index: number) {
  if (chat_editor.show) {
    return;
  }
  chat_editor.creating = false;
  chat_editor.target = index;
  chat_editor.show = true;
}
function duplicate_chat() {
  const source = chats[chat_editor.target]!;
  const new_chat: FullChatConfigure = structuredClone(toRaw(source));
  new_chat.shared.id = crypto.randomUUID();
  avatars.register_new_reference(new_chat.shared.avatar);
  chats.splice(chat_editor.target + 1, 0, new_chat);
  chat_editor.target = chat_editor.target + 1;
}
function cancel_chat() {
  chat_editor.show = false;
  const target = chats[chat_editor.target]!;
  avatars.unload_avatar(target.shared.avatar);
  chats.splice(chat_editor.target, 1);
}
function finish_chat() {
  chat_editor.show = false;
  const sorted_chats = chats.toSorted(
    (lhs, rhs) => lhs.shared.enter_millisecond - rhs.shared.enter_millisecond,
  );
  chats.splice(0, chats.length, ...sorted_chats);
}

function save_file(content: Blob, name: string) {
  const url = URL.createObjectURL(content);
  const downloader = document.createElement("a");
  downloader.href = url;
  downloader.download = name;
  downloader.click();
  URL.revokeObjectURL(url);
}

function render_single_chat() {
  const chat = chats[chat_editor.target]!;
  configuring
    .selected_theme!.render(chat, full_global_configure.value)
    .then(({ image }) => {
      save_file(image, `${chat.shared.username}.png`);
    });
}

async function play(): Promise<void> {
  const scene = document.querySelector(".scene")! as HTMLDivElement;
  const { play } = configuring.selected_mode!.preview(
    full_global_configure.value,
    chats,
    scene,
  );

  configuring.running_mode = true;
  await goto(0);
  await goto(0, { container: scene });
  await nextTick();
  await play();
  configuring.running_mode = false;
}

const record_status: Reactive<{
  recording: boolean;
  progress: number;
}> = reactive({
  recording: false,
  progress: 0,
});

const _PORTS = [
  26_282, 42_523, 54_266, 29_095, 42_503, 55_729, 50_431, 56_421, 41_246,
  16_171,
] as const;
const helping_server: { port_index: number } = { port_index: 0 };
function get_helper_program_address() {
  const separator = import.meta.env.BASE_URL.endsWith("/") ? "" : "/";
  const path = `${import.meta.env.BASE_URL}${separator}video-receiver.py`;
  return new URL(path, import.meta.url).href;
}
async function ping_server(
  port: number,
): Promise<{ connected: false } | { connected: true; usable: boolean }> {
  try {
    const response = await fetch(`http://localhost:${port}/`, {
      method: "POST",
      body: JSON.stringify({ method: "ping" }),
      headers: { "Content-Type": "application/json" },
    });
    const data = await response.json();
    if (data.interface === undefined) {
      return { connected: false };
    }
    if (
      data.interface !== -1 &&
      data.interface !== versioning["recorder-interface"]
    ) {
      dialog.show_dialog(
        "error",
        "辅助程序版本不匹配",
        `已连接到辅助程序（端口号${port}），但两者接口版本不同（辅助程序：${data.interface}，本程序：${versioning["recorder-interface"]}）。请从${get_helper_program_address()}重新获取辅助程序`,
      );
      return { connected: true, usable: false };
    }
    return { connected: true, usable: true };
  } catch {
    return { connected: false };
  }
}
async function find_server(): Promise<number | undefined> {
  let index = helping_server.port_index;
  do {
    const ping = await ping_server(_PORTS[index]!);
    if (ping.connected) {
      if (ping.usable) {
        helping_server.port_index = index;
        return _PORTS[index]!;
      } else {
        return undefined;
      }
    }
    index = (index + 1) % _PORTS.length;
  } while (index !== helping_server.port_index);
  const url = get_helper_program_address();
  dialog.show_dialog(
    "error",
    "无法找到录制辅助程序",
    `进行录制需要运行本地辅助程序，请检查是否已经运行。获取程序：${url}。需要Python运行环境来运行`,
  );
  return undefined;
}
function record() {
  record_status.progress = 0;
  record_status.recording = true;
  (async () => {
    const server_port = await find_server();
    if (server_port === undefined) {
      return;
    }
    return configuring.selected_mode!.render(
      server_port,
      chats,
      full_global_configure.value,
      (progress) => {
        record_status.progress = progress;
      },
    );
  })()
    .then((path) => {
      if (path !== undefined) {
        dialog.show_dialog("success", "渲染成功", `视频已保存到 ${path}`);
      }
    })
    .catch((error) => {
      dialog.show_dialog("error", "渲染失败", `遇到了如下错误：${error}`);
    })
    .finally(() => {
      record_status.recording = false;
    });
}

const import_export: Reactive<{
  show: boolean;
  content: File[] | File | undefined | null;
}> = reactive({
  show: false,
  content: null,
});

async function do_export() {
  const { data: dumped_avatar, url_mapping } = await avatars.dump();
  const convert_chats = chats.map((chat) => {
    if (chat.shared.avatar === "") {
      return chat;
    }
    return {
      shared: {
        ...chat.shared,
        avatar: url_mapping.get(chat.shared.avatar),
      },
      themed: chat.themed,
    };
  });
  const result = JSON.stringify({
    configuring: {
      shared: {
        ...configuring,
        selected_theme: configuring.selected_theme!.name,
        preselected_theme: undefined,
        selected_mode: configuring.selected_mode!.name,
      },
      themed: themed_configuring.value,
    },
    avatars: dumped_avatar,
    chats: await Promise.all(convert_chats),
  });
  save_file(
    new Blob([new TextEncoder().encode(result)], { type: "application/json" }),
    "saved-chats.json",
  );
}
async function do_import(part: { config: boolean; content: boolean }) {
  if (import_export.content === null || import_export.content === undefined) {
    return;
  }
  if (
    Array.isArray(import_export.content) &&
    import_export.content.length === 0
  ) {
    return;
  }
  const source = Array.isArray(import_export.content)
    ? import_export.content[0]!
    : import_export.content;
  import_export.content = null;
  const raw_data = await source.bytes();
  const data = JSON.parse(new TextDecoder().decode(raw_data));
  if (part.config) {
    for (const [key, value] of Object.entries(data.configuring.shared)) {
      if (["selected_theme", "selected_mode"].includes(key)) {
        continue;
      }
      // @ts-ignore
      configuring[key] = value;
    }
    const theme_name = data.configuring.shared.selected_theme as string;
    for (const theme of CHAT_THEMES) {
      if (theme.name === theme_name) {
        configuring.preselected_theme = theme;
        switch_theme();
        break;
      }
    }
    const mode_name = data.configuring.shared.selected_mode as string;
    for (const mode of SceneVariants) {
      if (mode.name === mode_name) {
        configuring.selected_mode = mode;
        break;
      }
    }
    await nextTick();
    for (const [key, value] of Object.entries(data.configuring.themed)) {
      // @ts-ignore
      themed_configuring.value[key] = value;
    }
  }
  if (part.content) {
    chats.splice(0);
    const url_mapping: Map<string, string> = avatars.load(data.avatars);
    for (const chat of data.chats) {
      if (chat.shared.avatar === "" || chat.shared.avatar === undefined) {
        chats.push(chat);
      } else {
        chats.push({
          shared: {
            ...chat.shared,
            avatar: url_mapping.get(chat.shared.avatar) ?? "",
          },
          themed: chat.themed,
        });
      }
    }
  }
}
</script>
<script lang="ts">
const MainAxisDirection = { vertical: "竖直", horizontal: "水平" } as const;
export type MainAxisDirectionType = keyof typeof MainAxisDirection;
const FlowDirection = { default: "默认", inverse: "反向" } as const;
export type FlowDirectionType = keyof typeof FlowDirection;
export type Configuring = {
  running_mode: boolean;
  debug: boolean;
  selected_theme: ThemeSpecification | null;
  preselected_theme: ThemeSpecification | null;
  selected_mode: (typeof SceneVariants)[0] | null;
  main_axis: MainAxisDirectionType;
  flow_direction: FlowDirectionType;
  scene_width: number;
  scene_height: number;
  fps: number;
  chat_width_limit: number;
  chat_margin: number;
  chat_avatar_size: number;
  chat_font_size: number;
  chat_logo_size: number;
  chat_emote_size: number;
  font_family: string;
  lift_duration: number;
  enter_duration: number;
  delay_before_start: number;
  keep_after_end: number;
  background: string;
};
</script>
<style lang="css">
div.scene {
  position: relative;
  overflow-y: v-bind("configuring.running_mode ? 'hidden' : 'scroll'");
  scrollbar-width: none;
  width: v-bind("`${configuring.scene_width}px`");
  height: v-bind("`${configuring.scene_height}px`");
  margin: 0 auto;
  background-color: v-bind("configuring.background");
  border-style: v-bind("configuring.debug ? 'solid' : 'none'");
  border-color: rgb(var(--v-theme-primary));
}
div.chat-list-container {
  display: flex;
  gap: v-bind("`${configuring.chat_margin}px`");
  align-items: flex-start;
}
div.chat-list-container-default {
  flex-direction: column;
}

.config-area {
  height: 100vh;
  overflow-y: scroll;
}

.config-area > *:not(:first-child) {
  margin-top: 24px;
}
.chat-container {
  font-size: v-bind("`${configuring.chat_font_size}px`");
  max-width: v-bind("`${configuring.chat_width_limit}px`");
  font-family: v-bind("configuring.font_family");
  flex-shrink: 0;
}
img.chat-content-image {
  vertical-align: sub;
  height: v-bind("`${configuring.chat_emote_size}px`");
  width: v-bind("`${configuring.chat_emote_size}px`");
}
img.chat-logo {
  height: v-bind("`${configuring.chat_logo_size}px`");
  width: v-bind("`${configuring.chat_logo_size}px`");
}
.chat-avatar {
  height: v-bind("`${configuring.chat_avatar_size}px`") !important;
  width: v-bind("`${configuring.chat_avatar_size}px`") !important;
}
</style>
