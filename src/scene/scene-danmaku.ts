import type { SceneVariant } from "./typing";
import {
  type FullChatConfigure,
  type FullGlobalConfigure,
  RenderingChat,
} from "@/components/chat-themes/interface";
import { useDialog } from "@/stores/dialog";
import preview_styles from "@/styles/scene-previews.module.css";
import {
  type Coordinate,
  get_flow_sign,
  type RenderTime,
  type Size,
  to_directed_size,
  to_standard_size,
} from "@/utilities/rendering";
import {
  AnimationProgressController,
  ChatControlBlock,
  gather_theme_animations,
  prepare_chats,
  preview_wrapper,
  SceneVideoEncoder,
} from "./utility";

type NotInuseEntry = {
  inuse: false;
};

type InuseEntry = {
  inuse: true;
  user_speed: number;
  user_enter_time: number;
  clear_handle: number;
};

type AvailabilityEntry = {
  start: number;
  size: number;
} & (InuseEntry | NotInuseEntry);

class DanmakuTrackerAllocator {
  #availability_nodes: AvailabilityEntry[];
  #lift_duration: number;
  #enter_duration: number;
  #scene_length: number;
  #counter: number;

  constructor(
    breadth_available: number,
    lift_duration: number,
    enter_duration: number,
    scene_length: number,
  ) {
    this.#availability_nodes = [
      {
        start: 0,
        size: breadth_available,
        inuse: false,
      },
    ];
    this.#lift_duration = lift_duration;
    this.#enter_duration = enter_duration;
    this.#scene_length = scene_length;
    this.#counter = 0;
  }

  // In danmaku mode, enter duration is the time any danmaku required to fully enter the scene
  //  that is the time the danmaku needed to travel n pixels, where n is its length along the main axis
  // Therefore, the speed on any chat can be calculated as v = n / enter_duration
  //  the time it would be visible in the scene is t = (n + m) / v, where m is the length of the scene along
  //  the main axis
  // The lift duration establishes a minimum gap required between two chats that overlaps on the cross axis
  //  the distance along the main axis between such two chats shall never below the distance the the slower
  //  one can travel in such duration

  allocate(
    breadth: number,
    speed: number,
    enter_time: number,
  ): { start: number; handle: number } {
    const [index, node] = ((): [number, AvailabilityEntry] => {
      for (const [index, node] of this.#availability_nodes.entries()) {
        if (node.size < breadth) {
          // just insufficient breadth
          continue;
        }
        if (!node.inuse) {
          return [index, node];
        }
        const reference_speed = Math.min(speed, node.user_speed);
        const gap = reference_speed * this.#lift_duration;
        const distance_ahead =
          node.user_speed *
          (enter_time - node.user_enter_time - this.#enter_duration);
        if (speed <= node.user_speed && distance_ahead <= gap) {
          continue;
        }
        const previous_exit_time =
          node.user_enter_time +
          this.#enter_duration +
          this.#scene_length / node.user_speed;
        const speed_delta = speed - node.user_speed;
        if (
          distance_ahead - speed_delta * (previous_exit_time - enter_time) <=
          gap
        ) {
          continue;
        }
        return [index, node];
      }
      return [-1, this.#availability_nodes[0]!];
    })();
    if (index === -1) {
      // we cannot allocate a track to fulfill the request
      return { start: -1, handle: -1 };
    }

    const handle = this.#counter;
    const allocated_node: AvailabilityEntry = {
      start: node.start,
      size: breadth,
      inuse: true,
      user_enter_time: enter_time,
      user_speed: speed,
      clear_handle: handle,
    };
    this.#counter += 1;

    if (node.size > breadth) {
      node.start = node.start + breadth;
      node.size = node.size - breadth;
      this.#availability_nodes.splice(index, 0, allocated_node);
    } else {
      this.#availability_nodes.splice(index, 1, allocated_node);
    }

    return { start: allocated_node.start, handle };
  }

  free(handle: number) {
    let index = this.#availability_nodes.findIndex(
      (entry) => entry.inuse && entry.clear_handle === handle,
    );
    if (index === -1) {
      return;
    }
    // try to merge with the node before it
    if (index > 0 && this.#availability_nodes[index - 1]!.inuse === false) {
      this.#availability_nodes[index - 1]!.size +=
        this.#availability_nodes[index]!.size;
      this.#availability_nodes.splice(index, 1);
      index = index - 1;
    }
    // try to merge with the node after it
    if (
      index < this.#availability_nodes.length - 1 &&
      this.#availability_nodes[index + 1]!.inuse === false
    ) {
      this.#availability_nodes[index]!.size +=
        this.#availability_nodes[index + 1]!.size;
      this.#availability_nodes.splice(index + 1, 1);
    }
    const node = this.#availability_nodes[index]!;
    if (node.inuse === true) {
      const freed_node: AvailabilityEntry = {
        start: node.start,
        size: node.size,
        inuse: false,
      };
      this.#availability_nodes.splice(index, 1, freed_node);
    }
  }
}

function preview(
  configuring: FullGlobalConfigure,
  chat_configs: FullChatConfigure[],
  scene: HTMLDivElement,
): {
  play: () => Promise<void>;
} {
  const container = scene.firstChild! as HTMLDivElement;
  const chats = prepare_chats(container, chat_configs);

  // send all danmaku to proper ready position by attaching the danmaku class
  for (const { element } of chats) {
    element.classList.add(
      preview_styles.danmaku,
      preview_styles[
        `danmaku-${configuring.shared.main_axis}-${configuring.shared.flow_direction}`
      ],
    );
  }

  const scene_size = to_directed_size(
    {
      width: configuring.shared.scene_width,
      height: configuring.shared.scene_height,
    },
    configuring.shared.main_axis,
  );

  const allocator = new DanmakuTrackerAllocator(
    scene_size.breadth,
    configuring.shared.lift_duration,
    configuring.shared.enter_duration,
    scene_size.length,
  );
  const running_chats: { exit_time: number; handle: number }[] = [];
  const animations: Animation[] = [];
  const reference_animation: {
    exit_time: number;
    animation: Animation | null;
  } = {
    exit_time: -1,
    animation: null,
  };
  let skipped_chats = 0;
  for (const { chat, element } of chats) {
    const current_time = chat.shared.enter_millisecond;
    let chats_to_remove = 0;
    for (const { exit_time, handle } of running_chats) {
      if (exit_time > current_time) {
        break;
      }
      allocator.free(handle);
      chats_to_remove += 1;
    }
    running_chats.splice(0, chats_to_remove);

    const chat_size = to_directed_size(
      {
        width: element.clientWidth,
        height: element.clientHeight,
      },
      configuring.shared.main_axis,
    );

    const breadth = chat_size.breadth + configuring.shared.chat_margin;
    const speed = chat_size.length / configuring.shared.enter_duration;
    const total_duration =
      configuring.shared.enter_duration + scene_size.length / speed;
    const exit_time = current_time + total_duration;
    const { start, handle } = allocator.allocate(breadth, speed, current_time);
    if (start === -1) {
      skipped_chats++;
      continue;
    }
    const func =
      configuring.shared.main_axis === "horizontal"
        ? "translateX"
        : "translateY";
    const ratio = get_flow_sign(configuring.shared.flow_direction);
    const frames = (() => {
      return configuring.shared.main_axis === "horizontal"
        ? [
            {
              top: `${start}px`,
              transform: `${func}(${-ratio * chat_size.length}px)`,
            },
            {
              top: `${start}px`,
              transform: `${func}(${ratio * scene_size.length}px)`,
            },
          ]
        : [
            {
              left: `${start}px`,
              transform: `${func}(${-ratio * chat_size.length}px)`,
            },
            {
              left: `${start}px`,
              transform: `${func}(${ratio * scene_size.length}px)`,
            },
          ];
    })();
    const animation = new Animation(
      new KeyframeEffect(element, frames, {
        duration: total_duration,
        delay: current_time,
        fill: "forwards",
      }),
    );
    animations.push(animation);
    running_chats.push({ exit_time, handle });
    if (exit_time > reference_animation.exit_time) {
      reference_animation.exit_time = exit_time;
      reference_animation.animation = animation;
    }
  }
  useDialog().show_dialog(
    "warning",
    "部分消息发射失败",
    `${skipped_chats}条消息由于入场时刻太接近、最小间隔太大、场景太小而未能发射`,
  );

  // now the individual chats can be animated
  const revokes = gather_theme_animations(chats, animations, configuring);

  return {
    // make the play function, which ...
    play: preview_wrapper(
      configuring.shared.delay_before_start,
      () => {
        // ... activate all the animations
        for (const animation of animations) {
          animation.play();
        }
        // ... wait for the last animation to finish
        return new Promise<void>((resolve) => {
          if (reference_animation.animation === null) {
            resolve();
            return;
          }
          reference_animation.animation.addEventListener("finish", () =>
            resolve(),
          );
        });
      },
      configuring.shared.keep_after_end,
      () => {
        // ... detach all animations
        for (const animation of animations) {
          animation.cancel();
        }
        // ... clear the new class applied
        for (const { element } of chats) {
          element.classList.remove(
            preview_styles.danmaku,
            preview_styles[
              `danmaku-${configuring.shared.main_axis}-${configuring.shared.flow_direction}`
            ],
          );
        }
        for (const revoke of revokes) {
          revoke();
        }
      },
    ),
  };
}

async function render(
  server: number,
  chats: FullChatConfigure[],
  configuring: FullGlobalConfigure,
  update_progress: (ratio: number) => void,
): Promise<string> {
  // prepare sizes and coordinates for rendering
  const scene_size: Size = {
    width: configuring.shared.scene_width,
    height: configuring.shared.scene_height,
  };

  // the canvas for the scene
  const scene_canvas = new OffscreenCanvas(scene_size.width, scene_size.height);
  const scene_context = scene_canvas.getContext("2d")!;
  // create a canvas to do all other work on it
  const helper_canvas = new OffscreenCanvas(0, 0);
  const helper_context = helper_canvas.getContext("2d")!;

  // prepare time metrics
  const fps = configuring.shared.fps;
  //  time between each two frames (ms)
  const frame_interval = 1000 / fps;
  //  number of frames required before playing the scene
  const prefixing_frames = Math.ceil(
    configuring.shared.delay_before_start / frame_interval,
  );
  //  number of frames required by the scene
  //  note that for danmaku setting, the exact number of frames required cannot be calculated in advance since
  //  the exact time a chat need to move out of the scene can only be calculated with the size of the chat
  //  known. We will keep this value a lower bound of the actual number of frames
  let working_frames = Math.ceil(
    (chats.at(-1)!.shared.enter_millisecond +
      configuring.shared.enter_duration) /
      frame_interval,
  );
  //  number of frames required after the scene has finished
  const suffixing_frames = Math.ceil(
    configuring.shared.keep_after_end / frame_interval,
  );
  //  summing all parts up
  let frames = prefixing_frames + working_frames + suffixing_frames;

  // prepare space metrics
  const flow_sign = get_flow_sign(configuring.shared.flow_direction);
  const basic_topleft: Coordinate = {
    x:
      configuring.shared.main_axis === "vertical" ||
      configuring.shared.flow_direction === "inverse"
        ? 0
        : scene_size.width,
    y:
      configuring.shared.main_axis === "horizontal" ||
      configuring.shared.flow_direction === "inverse"
        ? 0
        : scene_size.height,
  };
  const scene_vertexes = {
    topleft: { x: 0, y: 0 },
    bottomright: { x: scene_size.width, y: scene_size.height },
  };
  const directed_scene_size = to_directed_size(
    scene_size,
    configuring.shared.main_axis,
  );
  const allocator = new DanmakuTrackerAllocator(
    directed_scene_size.breadth,
    configuring.shared.lift_duration,
    configuring.shared.enter_duration,
    directed_scene_size.length,
  );

  // prepare the video encoder
  const encoder = await SceneVideoEncoder.build(server, fps, scene_size);

  // prepare progress metrics
  let current_total_frame = 0;

  // send initial frames
  {
    //  clear the canvas
    scene_context.clearRect(0, 0, scene_size.width, scene_size.height);
    scene_context.fillStyle = configuring.shared.background;
    scene_context.fillRect(0, 0, scene_size.width, scene_size.height);
    //  send frames
    for (
      current_total_frame = 0;
      current_total_frame < prefixing_frames;
      current_total_frame++
    ) {
      await encoder.add_frame(scene_context);
      update_progress((current_total_frame / frames) * 100);
    }
  }

  const internal_chats = chats.map(
    (
      chat,
    ): {
      chat: FullChatConfigure;
      ccb: ChatControlBlock | undefined;
      movement_controller: AnimationProgressController | undefined;
      allocation_handle: number | undefined;
    } => ({
      chat,
      ccb: undefined,
      movement_controller: undefined,
      allocation_handle: undefined,
    }),
  );

  const timing: RenderTime = {
    current_frame: 0,
    current_time: 0,
    time_delta: -1,
  };

  scene_context.font = `${configuring.shared.chat_font_size}px "${configuring.shared.font_family}"`;
  scene_context.textRendering = "optimizeLegibility";
  for (
    ;
    timing.current_frame < suffixing_frames + working_frames;
    timing.current_time += frame_interval,
      timing.current_frame += 1,
      timing.time_delta = frame_interval
  ) {
    const preserved_chats: typeof internal_chats = [];
    let evaluated_chats = 0;
    // find chats that should be initialized
    for (const item of internal_chats) {
      const { chat, ccb } = item;
      if (timing.current_time < chat.shared.enter_millisecond) {
        break;
      }
      evaluated_chats += 1;
      if (ccb) {
        preserved_chats.push(item);
        continue;
      }
      const instance =
        await configuring.shared.selected_theme!.prepare_rendering(
          chat,
          configuring,
          helper_context,
        );
      const size =
        instance instanceof RenderingChat
          ? instance.size
          : { height: instance.render.height, width: instance.render.width };
      const directed_size = to_directed_size(
        size,
        configuring.shared.main_axis,
      );
      const breadth = directed_size.breadth + configuring.shared.chat_margin;
      const speed = directed_size.length / configuring.shared.enter_duration;
      const { start, handle } = allocator.allocate(
        breadth,
        speed,
        chat.shared.enter_millisecond,
      );
      if (start === -1) {
        if (instance instanceof RenderingChat) {
          await instance.free();
        } else {
          instance.render.close();
          instance.render_pass2?.image.close();
        }
        continue;
      }
      const exit_time =
        chat.shared.enter_millisecond +
        configuring.shared.enter_duration +
        directed_scene_size.length / speed;
      item.movement_controller = new AnimationProgressController(
        {
          start: chat.shared.enter_millisecond,
          end: exit_time,
        },
        {
          value: {
            start: 0,
            end: directed_size.length + directed_scene_size.length,
          },
        },
      );
      const candidate_working_frames = Math.ceil(exit_time / frame_interval);
      working_frames = Math.max(working_frames, candidate_working_frames);
      frames = Math.max(
        frames,
        prefixing_frames + suffixing_frames + working_frames,
      );
      item.allocation_handle = handle;
      const extra_offset = to_standard_size(
        {
          length: flow_sign === 1 ? -directed_size.length : 0,
          breadth: start * flow_sign,
        },
        configuring.shared.main_axis,
      );
      item.ccb = new ChatControlBlock(instance, {
        x: basic_topleft.x + flow_sign * extra_offset.width,
        y: basic_topleft.y + flow_sign * extra_offset.height,
      });
      preserved_chats.push(item);
    }
    internal_chats.splice(0, evaluated_chats, ...preserved_chats.splice(0));

    // update coordinates and remove chats that is no longer needed
    evaluated_chats = 0;
    for (const item of internal_chats) {
      const { ccb, allocation_handle, movement_controller } = item;
      if (ccb === undefined) {
        break;
      }
      evaluated_chats++;
      const current_offset = to_standard_size(
        {
          length:
            movement_controller!.get_value(timing.current_time) * flow_sign,
          breadth: 0,
        },
        configuring.shared.main_axis,
      );
      const should_remove = await ccb.update_position(
        current_offset,
        scene_vertexes,
      );
      if (should_remove) {
        await ccb.free();
        allocator.free(allocation_handle!);
      } else {
        preserved_chats.push(item);
      }
    }
    internal_chats.splice(0, evaluated_chats, ...preserved_chats.splice(0));

    // render current frame
    scene_context.clearRect(0, 0, scene_size.width, scene_size.height);
    scene_context.fillStyle = configuring.shared.background;
    scene_context.fillRect(0, 0, scene_size.width, scene_size.height);
    for (const { ccb } of internal_chats) {
      if (ccb === undefined) {
        break;
      }
      ccb.render(scene_context, helper_context, timing);
    }
    for (const { ccb } of internal_chats) {
      if (ccb === undefined) {
        break;
      }
      ccb.render_pass2(scene_context, helper_context, timing);
    }
    // save current frame
    await encoder.add_frame(scene_context);
    current_total_frame++;
    update_progress((current_total_frame / frames) * 100);
  }

  // free any ccb that is still active
  for (const { ccb } of internal_chats) {
    if (ccb === undefined) {
      continue;
    }
    ccb.free();
  }

  // close the video
  const result = await encoder.close();
  const response = await result.json();
  return response.name;
}

const variant: SceneVariant = {
  name: "danmaku",
  display_name: "弹幕",
  preview,
  render,
};
export default variant;
