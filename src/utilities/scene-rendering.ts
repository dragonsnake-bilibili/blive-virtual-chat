import type { ChatConfig } from "@/components/Chat.vue";
import type { Configuring } from "@/components/MainView.vue";
import { render_chat } from "./chat-rendering";

function ease_out_sine(x: number): number {
  return Math.sin((x * Math.PI) / 2);
}
function ease_out_cubic(x: number): number {
  return x * x * x;
}

class AnimationProgressController {
  start_time: number;
  end_time: number;
  #easing_function: (t: number) => number;

  constructor(start: number, end: number, easing: (t: number) => number) {
    this.start_time = start;
    this.end_time = end;
    this.#easing_function = easing;
  }

  get_ratio(current_time: number): number {
    if (current_time < this.start_time) {
      return 0;
    }
    if (current_time > this.end_time) {
      return 1;
    }
    return this.#easing_function(
      (current_time - this.start_time) / (this.end_time - this.start_time),
    );
  }

  get_value(current_time: number, start: number, end: number): number {
    return start + (end - start) * this.get_ratio(current_time);
  }
}

class InternalChat {
  chat: ChatConfig;
  animation_progress: AnimationProgressController;
  height: number;
  #blob: Blob | undefined;
  #bitmap: ImageBitmap | undefined;

  constructor(
    chat: ChatConfig,
    image: Blob,
    height: number,
    configuring: Configuring,
  ) {
    this.chat = chat;
    this.height = height;
    this.#blob = image;
    this.#bitmap = undefined;
    const enter_time = chat.enter_millisecond + configuring.lift_duration;
    this.animation_progress = new AnimationProgressController(
      enter_time,
      enter_time + configuring.enter_duration,
      ease_out_sine,
    );
  }

  async get_bitmap() {
    if (this.#bitmap === undefined) {
      this.#bitmap = await window.createImageBitmap(this.#blob!);
      this.#blob = undefined;
    }
    return this.#bitmap;
  }

  release() {
    this.#blob = undefined;
    if (this.#bitmap !== undefined) {
      this.#bitmap.close();
      this.#bitmap = undefined;
    }
  }
}

function build_vertical_animations(
  chats: InternalChat[],
  configuring: Configuring,
): AnimationProgressController[] {
  const result: AnimationProgressController[] = [];
  for (const chat of chats) {
    result.push(
      new AnimationProgressController(
        chat.chat.enter_millisecond,
        chat.chat.enter_millisecond + configuring.lift_duration,
        ease_out_cubic,
      ),
    );
  }
  return result;
}

type FrameRenderState = {
  vertical_offset: number;
  last_time: number;
};

async function render_frame(
  current_time: number,
  context: OffscreenCanvasRenderingContext2D,
  chats: InternalChat[],
  vertical: AnimationProgressController[],
  configuring: Configuring,
  state: FrameRenderState,
): Promise<Blob> {
  // clear the scene
  context.clearRect(0, 0, configuring.scene_width, configuring.scene_height);
  context.fillStyle = configuring.background;
  context.fillRect(0, 0, configuring.scene_width, configuring.scene_height);

  // calculate current vertical offset
  for (const [index, chat] of chats.entries()) {
    if (vertical[index]!.start_time >= current_time) {
      break;
    }
    state.vertical_offset +=
      (chat.height + configuring.chat_margin) *
      (vertical[index]!.get_ratio(current_time) -
        vertical[index]!.get_ratio(state.last_time));
  }

  // remove chats that are out of the view
  let chats_to_remove = 0;
  for (const chat of chats) {
    const full_height = configuring.chat_margin + chat.height;
    if (state.vertical_offset < configuring.scene_height + full_height) {
      break;
    }
    chats_to_remove += 1;
    state.vertical_offset -= full_height;
    chat.release();
  }
  vertical.splice(0, chats_to_remove);
  chats.splice(0, chats_to_remove);

  // render chats to the scene
  let offset_fixing = 0;
  for (const chat of chats) {
    if (current_time <= chat.animation_progress.start_time) {
      break;
    }
    if (state.vertical_offset - offset_fixing <= configuring.chat_margin) {
      break;
    }
    const bottom =
      state.vertical_offset - offset_fixing - configuring.chat_margin;
    const top = configuring.scene_height - bottom;
    const left = chat.animation_progress.get_value(
      current_time,
      -0.6 * configuring.scene_width,
      0,
    );
    const opacity = chat.animation_progress.get_value(current_time, 0, 1);
    context.globalAlpha = opacity;
    context.drawImage(await chat.get_bitmap(), left, top);
    context.globalAlpha = 1;
    offset_fixing += chat.height + configuring.chat_margin;
  }

  // update last time
  state.last_time = current_time;

  return context.canvas.convertToBlob({ type: "image/png" });
}

export async function render_video(
  chats: ChatConfig[],
  configuring: Configuring,
  update_progress: (ratio: number) => void,
): Promise<string> {
  // create a canvas to do all work on it
  const canvas = new OffscreenCanvas(0, 0);
  // prepare image of all chats
  const internal_chats: InternalChat[] = [];
  for (const chat of chats) {
    const image = (await render_chat(chat, configuring, canvas)).image;
    internal_chats.push(
      new InternalChat(chat, image, canvas.height, configuring),
    );
  }
  // prepare canvas for the scene
  canvas.height = configuring.scene_height;
  canvas.width = configuring.scene_width;
  // prepare vertical movements
  const vertical_animation = build_vertical_animations(
    internal_chats,
    configuring,
  );

  // start the video
  await fetch("http://localhost:8020/", {
    method: "POST",
    body: JSON.stringify({
      method: "begin",
      fps: configuring.fps,
      height: configuring.scene_height,
      width: configuring.scene_width,
    }),
    headers: { "Content-Type": "application/json" },
  });

  // calculate number of frames to be generated
  const fps = configuring.fps;
  const frame_interval = 1000 / fps;
  const prefixing_frames = Math.ceil(
    configuring.delay_before_start / frame_interval,
  );
  const working_frames = Math.ceil(
    internal_chats.at(-1)!.animation_progress.end_time / frame_interval,
  );
  const suffixing_frames = Math.ceil(
    configuring.keep_after_end / frame_interval,
  );
  const frames = prefixing_frames + working_frames + suffixing_frames;
  // generate empty frames for the first waiting time
  const context = canvas.getContext("2d")!;
  const state: FrameRenderState = { last_time: 0, vertical_offset: 0 };
  const initial_frame = await render_frame(
    0,
    context,
    internal_chats,
    vertical_animation,
    configuring,
    state,
  );
  let current_frame = 0;
  const submit_frame = async (frame: Blob) => {
    await fetch("http://localhost:8020/", {
      method: "POST",
      body: frame,
      headers: { "Content-Type": "image/png" },
    });
    current_frame += 1;
    update_progress((current_frame / frames) * 100);
  };
  while (current_frame <= prefixing_frames) {
    await submit_frame(initial_frame);
  }
  let frame: Blob | null = null;
  for (
    let current_time = frame_interval;
    current_frame < prefixing_frames + working_frames;
    current_time += frame_interval
  ) {
    frame = await render_frame(
      current_time,
      context,
      internal_chats,
      vertical_animation,
      configuring,
      state,
    );
    await submit_frame(frame);
  }
  for (let i = 0; i < suffixing_frames; i++) {
    await submit_frame(frame!);
  }

  // close the video
  const result = await fetch("http://localhost:8020/", {
    method: "POST",
    body: JSON.stringify({ method: "end" }),
    headers: { "Content-Type": "application/json" },
  });
  const response = await result.json();
  return response.name;
}
