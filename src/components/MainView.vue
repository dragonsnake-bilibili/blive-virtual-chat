<template>
  <v-row id="fullscreen-target" justify="space-between">
    <v-col :class="configuring.running_mode ? '' : 'flex-grow-0'">
      <div class="scene">
        <div id="not-peano-container" class="not-peano-container">
          <chat
            v-for="(chat, index) in chats"
            :id="`chat-${chat.id}`"
            :key="chat.id"
            class="chat"
            :config="chat"
            @click="edit_chat(index)"
          />
        </div>
      </div>
    </v-col>
    <v-col class="flex-grow-1">
      <v-container class="config-area">
        <v-switch v-model="configuring.debug" label="调试模式" />
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
              label="scene width"
              suffix="pixel"
            />
            <v-text-field
              v-model.number="configuring.scene_height"
              class="flex-grow-0"
              hide-details
              label="scene height"
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
              v-model.number="configuring.avatar_gap"
              hide-details
              label="头像到内容间距"
              suffix="pixel"
            />
          </v-col>
          <v-col cols="6">
            <v-text-field
              v-model.number="configuring.bubble_padding"
              hide-details
              label="气泡内间距"
              suffix="pixel"
            />
          </v-col>
          <v-col cols="6">
            <v-text-field
              v-model.number="configuring.bubble_radius"
              hide-details
              label="气泡圆角尺寸"
              suffix="pixel"
            />
          </v-col>
          <v-col cols="6">
            <v-text-field
              v-model.number="configuring.start_angle"
              hide-details
              label="起始角"
              suffix="π"
            />
          </v-col>
          <v-col cols="6">
            <v-text-field
              v-model.number="configuring.end_angle"
              hide-details
              label="终止角"
              suffix="π"
            />
          </v-col>
          <v-col cols="6">
            <v-text-field
              v-model.number="configuring.chat_margin"
              hide-details
              label="chat margin"
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
        </v-row>
        <v-text-field
          v-model.number="configuring.lift_duration"
          hide-details
          label="lift duration"
          suffix="ms"
        />
        <v-text-field
          v-model.number="configuring.enter_duration"
          hide-details
          label="enter duration"
          suffix="ms"
        />
        <v-row>
          <v-col>
            <v-text-field
              v-model.number="configuring.delay_before_start"
              hide-details
              label="delay after the scene is set and before the animation is played"
              suffix="ms"
            />
          </v-col>
          <v-col>
            <v-text-field
              v-model.number="configuring.keep_after_end"
              hide-details
              label="keep final state after end"
              suffix="ms"
            />
          </v-col>
        </v-row>
        <v-divider />
        <chat-editor
          v-if="chat_editor.show"
          v-model="chats[chat_editor.target]!"
          :creating="chat_editor.creating"
          @cancel="cancel_chat"
          @finished="finish_chat"
          @render="render_single_chat"
        />
        <v-btn v-else block @click="new_chat">Add chat</v-btn>
        <v-divider />
        <v-row>
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
                <v-col><v-btn block @click="do_export">导出</v-btn></v-col>
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
                <v-col>
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
      :title="dialog.state.title"
      :type="dialog.state.type"
      closable
      @click:close="dialog.state.show = false"
    >
      {{ dialog.state.content }}
    </v-alert>
  </v-dialog>
</template>

<script setup lang="ts">
import type { Reactive } from "vue";
import { computed, nextTick, reactive } from "vue";
import { useGoTo } from "vuetify";
import { render_chat } from "@/utilities/chat-rendering";
import { render_video } from "@/utilities/scene-rendering";
import Chat, { type ChatConfig } from "./Chat.vue";
import { useDialog } from "@/stores/dialog";
const goto = useGoTo();
const dialog = useDialog();

function build_empty_chat(): ChatConfig {
  return {
    id: crypto.randomUUID(),
    username: "",
    avatar: "",
    bubble_color: "",
    name_color: "",
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

const configuring: Reactive<Configuring> = reactive({
  debug: false,
  running_mode: false,
  scene_width: 400,
  scene_height: 600,
  fps: 60,
  avatar_gap: 16,
  bubble_padding: 20,
  bubble_radius: 24,
  start_angle: 0.05,
  end_angle: 0.4,
  chat_margin: 24,
  chat_avatar_size: 48,
  chat_font_size: 18,
  chat_logo_size: 20,
  chat_emote_size: 24,
  lift_duration: 100,
  enter_duration: 400,
  delay_before_start: 5000,
  keep_after_end: 2000,
  background: "#ffffff",
});

const chats: Reactive<ChatConfig[]> = reactive([]);

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
  chat_editor.target = chats.push(build_empty_chat()) - 1;
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
    ({ enter_millisecond: lhs }, { enter_millisecond: rhs }) => lhs - rhs,
  );
}
function render_single_chat() {
  const chat = chats[chat_editor.target]!;
  render_chat(chat, configuring).then(({ image }) => {
    const url = URL.createObjectURL(image);
    const downloader = document.createElement("a");
    downloader.href = url;
    downloader.download = `${chat.id}.png`;
    downloader.click();
    URL.revokeObjectURL(url);
  });
}

const bubble_path = computed(() => {
  const radius = configuring.bubble_radius;
  const start_angle = Math.PI * configuring.start_angle;
  const end_angle = Math.PI * configuring.end_angle;
  const extend_ratio = 1.1;
  function get_coordinate(angle: number): [number, number] {
    const t =
      radius *
      (Math.cos(angle) + Math.sin(angle) - Math.sqrt(Math.sin(2 * angle))) *
      extend_ratio;
    return [t * Math.cos(angle), t * Math.sin(angle)];
  }
  const start_t = get_coordinate(start_angle);
  const end_t = get_coordinate(end_angle);
  return `path("M 0 0 L ${start_t[0]} ${start_t[1]} A ${radius} ${radius} 0 0 0 ${end_t[0]} ${end_t[1]} Z")`;
});

const total_duration = computed(() => {
  if (chats.length > 0) {
    return (
      chats.at(-1)!.enter_millisecond +
      configuring.lift_duration +
      configuring.enter_duration
    );
  }
  return 0;
});
const lift_duration = computed(
  () => total_duration.value - configuring.enter_duration,
);

function get_chat_elements() {
  return chats.map(({ id }) => document.querySelector(`#chat-${id}`)!);
}

function build_container_frames(): {
  keyframe: Keyframe[];
  start_time: number;
}[] {
  const result: { keyframe: Keyframe[]; start_time: number }[] = [];
  for (const [index, element] of get_chat_elements().entries()) {
    result.push({
      keyframe: [
        {
          transform: "translateY(0px)",
          easing: "ease-in",
        },
        {
          transform: `translateY(${-element.clientHeight - index * configuring.chat_margin}px)`,
        },
      ],
      start_time: chats[index]!.enter_millisecond,
    });
  }
  return result;
}

async function prepare_for_play(): Promise<{
  animations: Animation[];
  new_root: Element;
  core_container: Element;
}> {
  configuring.running_mode = true;
  const container = document.querySelector("#not-peano-container")!;
  const container_frames = build_container_frames();
  const chat_elements = get_chat_elements();
  await nextTick();
  await goto(0);
  await nextTick();
  const scene = container.parentElement!;
  container.remove();
  const root = document.createElement("div");
  root.classList.add("root-peano-container");
  scene.append(root);
  let last_element = root;
  const animations: Animation[] = [];
  const animating_targets: Element[] = [];
  for (const frame of container_frames) {
    const helper_container = document.createElement("div");
    helper_container.classList.add("peano-container");
    animating_targets.push(helper_container);
    last_element.append(helper_container);
    animations.push(
      new Animation(
        new KeyframeEffect(helper_container, frame.keyframe, {
          duration: lift_duration.value,
          fill: "forwards",
        }),
      ),
    );
    last_element = helper_container;
  }
  last_element.append(container);
  for (const [index, element] of chat_elements.entries()) {
    animations.push(
      new Animation(
        new KeyframeEffect(
          element,
          [
            { transform: "none", opacity: 0 },
            {
              transform: `translateX(${configuring.scene_width * 0.6}px)`,
              opacity: 1,
            },
          ],
          {
            duration: configuring.enter_duration,
            easing: "ease-out",
            delay: chats[index]!.enter_millisecond + configuring.lift_duration,
            fill: "forwards",
          },
        ),
      ),
    );
  }
  await new Promise((resolve, _reject) => {
    setTimeout(resolve, configuring.delay_before_start);
  });
  return { animations, new_root: root, core_container: container };
}
async function play(): Promise<void> {
  const { animations, new_root, core_container } = await prepare_for_play();
  for (const animation of animations) {
    animation.play();
  }
  return new Promise<void>((resolve, _reject) => {
    animations.at(-1)!.addEventListener("finish", () => {
      setTimeout(() => {
        for (const animation of animations) {
          animation.cancel();
        }
        configuring.running_mode = false;
        const scene = new_root.parentElement!;
        new_root.remove();
        scene.append(core_container);
        resolve();
      }, configuring.keep_after_end);
    });
  });
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
      throw `无法连接录制程序，请确认是否已经运行？获取程序：${new URL("./video-receiver.py", import.meta.url)}。需要Python运行环境来运行。`;
    }
    return render_video(chats, configuring, (progress) => {
      record_status.progress = progress;
    });
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
    if (chat.avatar === "") {
      return chat;
    }
    const avatar = chat.avatar;
    const load = await fetch(avatar);
    const bytes = await load.bytes();
    return {
      ...chat,
      // @ts-ignore
      avatar: bytes.toBase64(),
    };
  });
  import_export.content = JSON.stringify({
    configuring,
    chats: await Promise.all(convert_chats),
  });
}
function do_import(part: { config: boolean; content: boolean }) {
  const data = JSON.parse(import_export.content);
  if (part.config) {
    for (const [key, value] of Object.entries(data.configuring)) {
      // @ts-ignore
      configuring[key] = value;
    }
  }
  if (part.content) {
    chats.length = 0;
    for (const chat of data.chats) {
      if (chat.avatar === "") {
        chats.push(chat);
      } else {
        chats.push({
          ...chat,
          avatar: URL.createObjectURL(
            // @ts-ignore
            new Blob([Uint8Array.fromBase64(chat.avatar)]),
          ),
        });
      }
    }
  }
}
</script>
<script lang="ts">
export type Configuring = {
  running_mode: boolean;
  debug: boolean;
  scene_width: number;
  scene_height: number;
  fps: number;
  avatar_gap: number;
  bubble_padding: number;
  bubble_radius: number;
  start_angle: number;
  end_angle: number;
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
}
div.not-peano-container {
  width: 100%;
  display: grid;
  grid-template-columns: 100%;
  gap: v-bind("`${configuring.chat_margin}px`");
}
div.root-peano-container {
  width: 100%;
  position: absolute;
  left: 0;
  bottom: 0;
  transform: translate(-60%, 100%);
}
div.peano-container {
  width: 100%;
}
.chat {
  opacity: v-bind("configuring.running_mode ? 0 : 1");
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
}
img.chat-content-image {
  vertical-align: sub;
  height: v-bind("`${configuring.chat_emote_size}px`");
  width: v-bind("`${configuring.chat_emote_size}px`");
}
img.chat-logo {
  vertical-align: middle;
  margin-left: 8px;
  height: v-bind("`${configuring.chat_logo_size}px`");
  width: v-bind("`${configuring.chat_logo_size}px`");
}
.chat-avatar {
  height: v-bind("`${configuring.chat_avatar_size}px`") !important;
  width: v-bind("`${configuring.chat_avatar_size}px`") !important;
}
.chat-content {
  border-radius: v-bind("`${configuring.bubble_radius}px`");
  padding: v-bind("`${configuring.bubble_padding}px`");
}
.visual-helper {
  clip-path: v-bind("bubble_path");
}
</style>
