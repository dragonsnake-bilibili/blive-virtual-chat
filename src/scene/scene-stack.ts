import type { SceneVariant } from "./typing";
import {
  type FullChatConfigure,
  type FullGlobalConfigure,
  RenderingChat,
} from "@/components/chat-themes/interface";
import preview_styles from "@/styles/scene-previews.module.css";
import easing_functions from "@/utilities/easing-functions";
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

function build_stack_container_frames(
  configuring: FullGlobalConfigure,
  chats: {
    chat: FullChatConfigure;
    element: Element;
  }[],
): {
  keyframe: Keyframe[];
  start_time: number;
}[] {
  const result: { keyframe: Keyframe[]; start_time: number }[] = [];
  for (const [index, { chat, element }] of chats.entries()) {
    const size = to_directed_size(
      { width: element.clientWidth, height: element.clientHeight },
      configuring.shared.main_axis,
    );
    const base_translate = size.length;
    const extra_translate = index === 0 ? 0 : configuring.shared.chat_margin;
    const final_translate =
      get_flow_sign(configuring.shared.flow_direction) *
      (base_translate + extra_translate);
    const func =
      configuring.shared.main_axis === "horizontal"
        ? "translateX"
        : "translateY";
    result.push({
      keyframe: [
        {
          transform: "none",
          easing: "ease-in",
        },
        {
          transform: `${func}(${final_translate}px)`,
        },
      ],
      start_time: chat.shared.enter_millisecond,
    });
  }
  return result;
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
  const container_frames = build_stack_container_frames(configuring, chats);

  // insert multiple helper layers
  // This is done to allow multiple chats to enter at the same time. CSS animation requires absolute values,
  //  not relative values, which means you cannot specify bottom: (original value)+12px, which complicates the
  //  case when multiple chats enter the scene together: you must calculate the effect of each chat separately
  //  and sum them up to get a single final value. We instead create multiple intermediate elements, one for
  //  each chat, and apply translations caused by each chat to exact one of the layered intermediate elements.
  //  This act like specifying relative value to the translations since the final position of the innermost
  //  element will be the sum of all intermediate elements.
  const root = document.createElement("div");
  root.classList.add(
    preview_styles["root-peano-container"],
    preview_styles[
      `root-peano-container-${configuring.shared.main_axis}-${configuring.shared.flow_direction}`
    ],
  );
  scene.append(root);
  let last_element = root;
  const animations: Animation[] = [];
  const animating_targets: Element[] = [];
  for (const frame of container_frames) {
    const helper_container = document.createElement("div");
    animating_targets.push(helper_container);
    // note the element must be added to the DOM tree before an animation is attached to it
    //  the animation will otherwise be ignored (dropped)
    last_element.append(helper_container);
    animations.push(
      new Animation(
        new KeyframeEffect(helper_container, frame.keyframe, {
          delay: frame.start_time,
          duration: configuring.shared.lift_duration,
          fill: "forwards",
        }),
      ),
    );
    last_element = helper_container;
  }
  last_element.append(container);
  container.classList.remove("chat-list-container-default");
  container.classList.add(
    preview_styles[
      `chat-list-container-${configuring.shared.main_axis}-${configuring.shared.flow_direction}`
    ],
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
          animations.at(-1)!.addEventListener("finish", () => resolve());
        });
      },
      configuring.shared.keep_after_end,
      () => {
        // ... detach all animations
        for (const animation of animations) {
          animation.cancel();
        }
        // ... undo modifications to the DOM
        scene.append(container);
        root.remove();
        container.classList.add("chat-list-container-default");
        container.classList.remove(
          preview_styles[
            `chat-list-container-${configuring.shared.main_axis}-${configuring.shared.flow_direction}`
          ],
        );
        for (const revoke of revokes) {
          revoke();
        }
      },
    ),
  };
}

async function render(
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
  const working_frames = Math.ceil(
    (chats.at(-1)!.shared.enter_millisecond +
      configuring.shared.enter_duration +
      configuring.shared.lift_duration) /
      frame_interval,
  );
  //  number of frames required after the scene has finished
  const suffixing_frames = Math.ceil(
    configuring.shared.keep_after_end / frame_interval,
  );
  //  summing all parts up
  const frames = prefixing_frames + working_frames + suffixing_frames;

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

  // prepare the video encoder
  const encoder = await SceneVideoEncoder.build(fps, scene_size);

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
    (chat): { chat: FullChatConfigure; ccb: ChatControlBlock | undefined } => ({
      chat,
      ccb: undefined,
    }),
  );

  const active_offset_adjustments: AnimationProgressController[] = [];

  const timing: RenderTime = {
    current_frame: 0,
    current_time: 0,
    time_delta: -1,
  };

  let summed_length = 0;
  let fixed_length = 0;
  scene_context.font = `${configuring.shared.chat_font_size}px "${configuring.shared.font_family}"`;
  scene_context.textRendering = "optimizeLegibility";
  for (
    ;
    timing.current_frame < suffixing_frames + working_frames;
    timing.current_time += frame_interval,
      timing.current_frame += 1,
      timing.time_delta = frame_interval
  ) {
    // find chats that should be initialized
    for (const item of internal_chats) {
      const { chat, ccb } = item;
      if (timing.current_time < chat.shared.enter_millisecond) {
        break;
      }
      if (ccb) {
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
      active_offset_adjustments.push(
        new AnimationProgressController(
          {
            start: chat.shared.enter_millisecond,
            end:
              chat.shared.enter_millisecond + configuring.shared.lift_duration,
          },
          {
            easing: easing_functions.ease_out_cubic,
            value: {
              start: 0,
              end: directed_size.length + configuring.shared.chat_margin,
            },
          },
        ),
      );
      const extra_offset = to_standard_size(
        {
          length:
            summed_length +
            configuring.shared.chat_margin +
            (flow_sign === 1 ? directed_size.length : 0),
          breadth: 0,
        },
        configuring.shared.main_axis,
      );
      item.ccb = new ChatControlBlock(instance, {
        x: basic_topleft.x - flow_sign * extra_offset.width,
        y: basic_topleft.y - flow_sign * extra_offset.height,
      });
      summed_length += configuring.shared.chat_margin + directed_size.length;
    }

    // calculate current length offset and count number of animation controller that should be removed
    let animation_controllers_removed = 0;
    let current_length_offset = fixed_length;
    for (const controller of active_offset_adjustments) {
      const offset = controller.get_value(timing.current_time);
      current_length_offset += offset;
      if (timing.current_time >= controller.time.end) {
        fixed_length += offset;
        animation_controllers_removed++;
      }
    }
    // remove animation controllers
    active_offset_adjustments.splice(0, animation_controllers_removed);

    // convert length offset to standard offset
    const current_offset = to_standard_size(
      { length: current_length_offset * flow_sign, breadth: 0 },
      configuring.shared.main_axis,
    );

    // update coordinates and remove chats that is no longer needed
    const preserved_chats: typeof internal_chats = [];
    let evaluated_chats = 0;
    for (const item of internal_chats) {
      const { ccb } = item;
      if (ccb === undefined) {
        break;
      }
      evaluated_chats++;
      const should_remove = await ccb.update_position(
        current_offset,
        scene_vertexes,
      );
      if (should_remove) {
        await ccb.free();
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
  name: "stack",
  display_name: "堆叠",
  preview,
  render,
};
export default variant;
