<template>
  <v-row id="fullscreen-target" justify="space-between">
    <v-col :class="configuring.running_mode ? '' : 'flex-grow-0'">
      <div class="scene">
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
                  <p style="text-align: center">Background</p>
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
                  label="chat font size"
                />
              </v-col>
              <v-col cols="6">
                <v-text-field
                  v-model.number="configuring.chat_logo_size"
                  hide-details
                  label="chat logo size"
                  suffix="pixel"
                />
              </v-col>
              <v-col cols="6">
                <v-text-field
                  v-model.number="configuring.chat_emote_size"
                  hide-details
                  label="chat emote size"
                  suffix="pixel"
                />
              </v-col>
              <v-col cols="6">
                <v-text-field
                  v-model.number="configuring.lift_duration"
                  hide-details
                  label="lift duration"
                  suffix="ms"
                />
              </v-col>
              <v-col cols="6">
                <v-text-field
                  v-model.number="configuring.enter_duration"
                  hide-details
                  label="enter duration"
                  suffix="ms"
                />
              </v-col>
              <v-col cols="6">
                <v-text-field
                  v-model.number="configuring.delay_before_start"
                  hide-details
                  label="delay after the scene is set and before the animation is played"
                  suffix="ms"
                />
              </v-col>
              <v-col cols="6">
                <v-text-field
                  v-model.number="configuring.keep_after_end"
                  hide-details
                  label="keep final state after end"
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
          <v-card-title>弹幕设置</v-card-title>
          <v-card-text>
            <chat-editor v-model="chats[chat_editor.target]!.shared" />
            <v-divider />
            <component
              :is="configuring.selected_theme!.editor"
              v-if="chat_editor.show"
              v-model="chats[chat_editor.target]!.themed"
            />
          </v-card-text>
          <v-card-actions>
            <v-row>
              <v-col>
                <v-btn block @click="render_single_chat"> 渲染 </v-btn>
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
          新弹幕
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
              <v-textarea v-model="import_export.content" />
              <v-row>
                <v-col v-if="configuring.selected_theme !== null">
                  <v-btn block @click="do_export">导出</v-btn>
                </v-col>
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
import type {
  FullChatConfigure,
  FullGlobalConfigure,
  SharedChatConfigure,
  ThemeSpecification,
  ThemeSpecifiedConfiguration,
} from "./chat-themes/interface";
import { computed, nextTick, reactive, ref, shallowReactive } from "vue";
import { useGoTo } from "vuetify";
import SceneVariants from "@/scene";
import { useDialog } from "@/stores/dialog";
import CHAT_THEMES from "./chat-themes";
const goto = useGoTo();
const dialog = useDialog();

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
  selected_mode: null,
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
  lift_duration: 100,
  enter_duration: 400,
  delay_before_start: 500,
  keep_after_end: 500,
  background: "#ffffff",
});
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
function cancel_chat() {
  chat_editor.show = false;
  chats.splice(chat_editor.target, 1);
}
function finish_chat() {
  chat_editor.show = false;
  chats.sort(
    (lhs, rhs) => lhs.shared.enter_millisecond - rhs.shared.enter_millisecond,
  );
}

function render_single_chat() {
  const chat = chats[chat_editor.target]!;
  configuring
    .selected_theme!.render(chat, full_global_configure.value)
    .then(({ image }) => {
      const url = URL.createObjectURL(image);
      const downloader = document.createElement("a");
      downloader.href = url;
      downloader.download = `${chat.shared.username}.png`;
      downloader.click();
      URL.revokeObjectURL(url);
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

function record() {
  record_status.progress = 0;
  record_status.recording = true;
  (async () => {
    try {
      await fetch("http://localhost:8020/", {
        method: "POST",
        body: JSON.stringify({ method: "ping" }),
        headers: { "Content-Type": "application/json" },
      });
    } catch {
      const separator = import.meta.env.BASE_URL.endsWith("/") ? "" : "/";
      const path = `${import.meta.env.BASE_URL}${separator}video-receiver.py`;
      const url = new URL(path, import.meta.url).href;
      throw `无法连接录制程序，请确认是否已经运行？获取程序：${url}。需要Python运行环境来运行。`;
    }
    return configuring.selected_mode!.render(
      chats,
      full_global_configure.value,
      (progress) => {
        record_status.progress = progress;
      },
    );
  })()
    .then((path) => {
      dialog.show_dialog("success", "渲染成功", `视频已保存到 ${path}`);
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
  content: string;
}> = reactive({
  show: false,
  content: "",
});

async function do_export() {
  const convert_chats = chats.map(async (chat) => {
    if (chat.shared.avatar === "") {
      return chat;
    }
    const avatar = chat.shared.avatar;
    const load = await fetch(avatar);
    const bytes = await load.bytes();
    return {
      shared: {
        ...chat.shared,
        // @ts-ignore
        avatar: bytes.toBase64(),
      },
      themed: chat.themed,
    };
  });
  import_export.content = JSON.stringify({
    configuring: {
      shared: {
        ...configuring,
        selected_theme: configuring.selected_theme!.name,
        preselected_theme: undefined,
        selected_mode: configuring.selected_mode!.name,
      },
      themed: themed_configuring.value,
    },
    chats: await Promise.all(convert_chats),
  });
}
async function do_import(part: { config: boolean; content: boolean }) {
  const data = JSON.parse(import_export.content);
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
    for (const chat of data.chats) {
      if (chat.shared.avatar === "") {
        chats.push(chat);
      } else {
        chats.push({
          shared: {
            ...chat.shared,
            avatar: URL.createObjectURL(
              // @ts-ignore
              new Blob([Uint8Array.fromBase64(chat.shared.avatar)]),
            ),
          },
          themed: chat.themed,
        });
      }
    }
  }
}
</script>
<script lang="ts">
const MainAxisDirection = { vertical: "垂直", horizontal: "水平" } as const;
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
  display: grid;
  grid-auto-flow: row;
  grid-auto-columns: auto;
  grid-auto-rows: min-content;
  justify-items: start;
  gap: v-bind("`${configuring.chat_margin}px`");
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
