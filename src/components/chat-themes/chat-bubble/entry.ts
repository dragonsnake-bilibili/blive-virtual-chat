import type {
  FlowDirectionType,
  MainAxisDirectionType,
} from "@/components/MainView.vue";
import {
  type FullChatConfigure,
  type FullGlobalConfigure,
  RenderingChat,
  type RenderPreparation,
  type ThemeSpecification,
} from "@/components/chat-themes/interface";
import { AnimationProgressController } from "@/scene/utility";
import { useDialog } from "@/stores/dialog";
import { useEmotes } from "@/stores/emotes";
import easing_functions from "@/utilities/easing-functions";
import {
  canvas_to_blob,
  type Coordinate,
  type DirectedSize,
  draw_line,
  draw_rectangle,
  get_flow_sign,
  prepare_avatar,
  prepare_canvas,
  type RenderSpace,
  type RenderTime,
  type Size,
  to_directed_size,
  to_standard_size,
} from "@/utilities/rendering";
import { render_text } from "@/utilities/text-rendering";
import ChatBubbleDisplay from "./ChatBubbleDisplay.vue";
import ChatBubbleEditor from "./ChatBubbleEditor.vue";
import ChatBubbleGlobalConfig from "./ChatBubbleGlobalConfig.vue";
import { type ChatConfigures, type GlobalConfigures, name } from "./configures";
import styles from "./style.module.css";

const DefaultConfigure: ChatConfigures = {
  name_color: "#000000",
  bubble_color: "#ffffff",
};

async function render_username_line(
  chat: FullChatConfigure,
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  configuring: FullGlobalConfigure,
): Promise<Blob> {
  const themed_configs = configuring.themes.content as GlobalConfigures;
  // measure size of the username
  const measure = context.measureText(chat.shared.username);
  // we make sure the left-most pixel appears on the left boundary
  //  therefore we need to adjust the starting point accordingly
  const x_adjustment = measure.actualBoundingBoxLeft;
  const username_width =
    measure.actualBoundingBoxLeft + measure.actualBoundingBoxRight;
  const username_height =
    measure.fontBoundingBoxAscent + measure.fontBoundingBoxDescent;
  // measure ex
  const ex_measure = context.measureText("x");
  const ex =
    ex_measure.actualBoundingBoxAscent + ex_measure.actualBoundingBoxDescent;
  // calculate full width and full height
  const padding = username_height * 0.25;
  const pure_character_height = username_height + padding * 2;
  const logo_align_line_offset =
    padding + measure.fontBoundingBoxAscent - ex / 2;
  const logo_count = (() => {
    let result = 0;
    if (chat.shared.logos.admiral) {
      result += 1;
    }
    if (chat.shared.logos.captain) {
      result += 1;
    }
    if (chat.shared.logos.governor) {
      result += 1;
    }
    if (chat.shared.logos.manager) {
      result += 1;
    }
    return result;
  })();
  const [character_top, logo_top] = (() => {
    if (logo_count > 0) {
      const difference =
        logo_align_line_offset - configuring.shared.chat_logo_size / 2;
      if (difference < 0) {
        return [-difference, 0];
      }
      return [0, difference];
    }
    return [0, -configuring.shared.chat_logo_size];
  })();
  const total_height = Math.max(
    character_top + pure_character_height,
    logo_top + configuring.shared.chat_logo_size,
  );
  const unadjusted_badge_width =
    (configuring.shared.chat_logo_size + themed_configs.badge_gap) * logo_count;
  const adjusted_badge_width =
    unadjusted_badge_width -
    themed_configs.badge_gap +
    themed_configs.username_to_badge;
  const total_width =
    username_width + (logo_count > 0 ? adjusted_badge_width : 0);
  const baseline_y = character_top + padding + measure.fontBoundingBoxAscent;

  // update canvas
  const font_backup = context.font;
  context.canvas.height = total_height;
  context.canvas.width = total_width;
  context.font = font_backup;
  context.textRendering = "optimizeLegibility";
  context.fillStyle = chat.themed.content.name_color;
  context.strokeStyle = chat.themed.content.name_color;

  // render it
  context.fillText(chat.shared.username, x_adjustment, baseline_y);
  if (logo_count > 0) {
    let current_x =
      x_adjustment + username_width + themed_configs.username_to_badge;
    const emote = useEmotes();
    for (const [included, id] of [
      [chat.shared.logos.manager, "special/房管"],
      [chat.shared.logos.governor, "special/总督"],
      [chat.shared.logos.admiral, "special/提督"],
      [chat.shared.logos.captain, "special/舰长"],
    ] as [boolean, string][]) {
      if (!included) {
        continue;
      }
      const image = emote.find_emote(id)!;
      const image_bytes = await (await fetch(image)).blob();
      const bitmap = await window.createImageBitmap(image_bytes, {
        resizeHeight: configuring.shared.chat_logo_size,
        resizeWidth: configuring.shared.chat_logo_size,
        resizeQuality: "high",
      });
      context.drawImage(bitmap, current_x, logo_top);
      current_x += configuring.shared.chat_logo_size;
      bitmap.close();
      current_x += themed_configs.badge_gap;
    }
  }

  // render debugging helpers
  if (configuring.shared.debug) {
    draw_line(
      context,
      { x: x_adjustment, y: 0 },
      { x: x_adjustment, y: context.canvas.height },
    );
    draw_line(
      context,
      { x: x_adjustment + username_width, y: 0 },
      { x: x_adjustment + username_width, y: context.canvas.height },
    );
    draw_line(
      context,
      { x: 0, y: baseline_y },
      { x: context.canvas.width, y: baseline_y },
    );
  }
  return canvas_to_blob(context.canvas);
}

async function render(
  chat: FullChatConfigure,
  configuring: FullGlobalConfigure,
  canvas?: HTMLCanvasElement | OffscreenCanvas,
): Promise<{ image: Blob; canvas: HTMLCanvasElement | OffscreenCanvas }> {
  // prepare canvas
  const [used_canvas, context] = prepare_canvas(canvas);

  // make it easier to access theme-specific configurations
  const themed_configs = configuring.themes.content as GlobalConfigures;

  // calculate the width available for the content
  const available_bubble_width =
    configuring.shared.chat_width_limit -
    configuring.shared.chat_avatar_size -
    themed_configs.avatar_gap;
  const available_content_width =
    available_bubble_width - themed_configs.bubble_padding * 2;

  if (available_content_width <= 0) {
    useDialog().show_dialog(
      "warning",
      "气泡可用宽度太小了！",
      `宽度只有${available_content_width}，很可能产生奇怪的结果`,
    );
  }

  // render the content first to find out the height we need for this chat
  const { image: content } = await render_text(
    chat.shared.content,
    configuring.shared,
    available_content_width,
    used_canvas,
  );
  const content_height = used_canvas.height;
  const content_width = used_canvas.width;
  const bubble_height = content_height + themed_configs.bubble_padding * 2;
  const bubble_width = content_width + themed_configs.bubble_padding * 2;

  // render username
  const username = await render_username_line(chat, context, configuring);
  const username_height = used_canvas.height;
  const username_width = used_canvas.width;

  // put everything together
  //  calculate the full size of this chat
  const full_width =
    configuring.shared.chat_avatar_size +
    themed_configs.avatar_gap +
    Math.max(bubble_width, username_width);
  const full_height = Math.max(
    configuring.shared.chat_avatar_size,
    username_height + themed_configs.username_to_bubble + bubble_height,
  );
  const font_backup = context.font;

  //  prepare components
  const content_bitmap = await window.createImageBitmap(content);
  const username_bitmap = await window.createImageBitmap(username);
  const avatar_bitmap = await window.createImageBitmap(
    await prepare_avatar(
      chat.shared.avatar,
      context,
      configuring.shared.chat_avatar_size,
    ),
  );

  context.canvas.height = full_height;
  context.canvas.width = full_width;
  context.font = font_backup;
  context.textRendering = "optimizeLegibility";

  //  place username
  context.drawImage(
    username_bitmap,
    configuring.shared.chat_avatar_size + themed_configs.avatar_gap,
    0,
  );

  //  draw the bubble
  const bubble_top_left: Coordinate = {
    x: configuring.shared.chat_avatar_size + themed_configs.avatar_gap,
    y: username_height + themed_configs.username_to_bubble,
  };
  const config_radius = themed_configs.bubble_radius;
  context.fillStyle = chat.themed.content.bubble_color;
  const [_, radius] = draw_rectangle(
    context,
    bubble_top_left,
    { width: bubble_width, height: bubble_height },
    config_radius,
  )[0];
  function get_coordinate(angle: number): [number, number] {
    const t =
      radius *
      (Math.cos(angle) + Math.sin(angle) - Math.sqrt(Math.sin(2 * angle))) *
      1.05;
    return [t * Math.cos(angle), t * Math.sin(angle)];
  }
  function inward_angle_to_outward(angle: number): [number, [number, number]] {
    const coordinate = get_coordinate(angle);
    const difference = Math.acos((radius - coordinate[0]) / radius);
    return [Math.PI + difference, coordinate];
  }
  const [start, start_point] = inward_angle_to_outward(
    Math.PI * themed_configs.start_angle,
  );
  const [end] = inward_angle_to_outward(Math.PI * themed_configs.end_angle);
  context.beginPath();
  context.moveTo(bubble_top_left.x, bubble_top_left.y);
  context.lineTo(
    bubble_top_left.x + start_point[0],
    bubble_top_left.y + start_point[1],
  );
  context.arc(
    bubble_top_left.x + radius,
    bubble_top_left.y + radius,
    radius,
    start,
    end,
    true,
  );
  context.lineTo(bubble_top_left.x, bubble_top_left.y);
  context.closePath();
  context.fill();

  //  place content
  context.drawImage(
    content_bitmap,
    bubble_top_left.x + themed_configs.bubble_padding,
    bubble_top_left.y + themed_configs.bubble_padding,
  );

  //  place avatar
  context.drawImage(avatar_bitmap, 0, 0);

  return { image: await canvas_to_blob(used_canvas), canvas: used_canvas };
}

function prepare_entering_animation(
  chat: FullChatConfigure,
  element: Element,
  configuring: FullGlobalConfigure,
): { animation?: Animation; revoke?: () => void } {
  if (configuring.shared.selected_mode!.name === "danmaku") {
    return {};
  }
  element.classList.add(styles["hide-by-transparent"]);
  const func =
    configuring.shared.main_axis === "horizontal" ? "translateY" : "translateX";
  const ratio = 60 * get_flow_sign(configuring.shared.flow_direction);
  const animation = new Animation(
    new KeyframeEffect(
      element,
      [
        { transform: `${func}(${ratio}%)`, opacity: 0 },
        {
          transform: "none",
          opacity: 1,
        },
      ],
      {
        duration: configuring.shared.enter_duration,
        easing: "ease-out",
        delay: chat.shared.enter_millisecond + configuring.shared.lift_duration,
        fill: "forwards",
      },
    ),
  );
  return {
    animation,
    revoke: () => {
      element.classList.remove(styles["hide-by-transparent"]);
    },
  };
}

class BubbleRenderingChat extends RenderingChat {
  size: Size;
  render_pass2 = undefined;
  #animation_controller: AnimationProgressController;
  #image: ImageBitmap | undefined;
  #directed_size: DirectedSize;
  #main_axis: MainAxisDirectionType;
  #flow_sign: ReturnType<typeof get_flow_sign>;

  constructor(
    image: ImageBitmap,
    animation_controller: AnimationProgressController,
    main_axis: MainAxisDirectionType,
    flow_direction: FlowDirectionType,
  ) {
    super();
    this.size = { width: image.width, height: image.height };
    this.#animation_controller = animation_controller;
    this.#image = image;
    this.#directed_size = to_directed_size(this.size, main_axis);
    this.#main_axis = main_axis;
    this.#flow_sign = get_flow_sign(flow_direction);
  }

  render(
    context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    _helping_context:
      | CanvasRenderingContext2D
      | OffscreenCanvasRenderingContext2D,
    spacing: RenderSpace,
    timing: RenderTime,
  ): ImageBitmap | boolean {
    const ratio = this.#animation_controller.get_ratio(timing.current_time);
    if (ratio === 1) {
      const image = this.#image!;
      this.#image = undefined;
      return image;
    }
    const absolute_translate =
      0.6 * this.#directed_size.breadth * (1 - ratio) * this.#flow_sign;
    const translate = to_standard_size(
      { breadth: absolute_translate, length: 0 },
      this.#main_axis,
    );
    const opacity = ratio;
    const backup_alpha = context.globalAlpha;
    context.globalAlpha = opacity;
    context.drawImage(
      this.#image!,
      spacing.topleft.x + translate.width,
      spacing.topleft.y + translate.height,
    );
    context.globalAlpha = backup_alpha;
    return true;
  }

  async free() {
    if (this.#image) {
      this.#image.close();
      this.#image = undefined;
    }
  }
}

async function prepare_rendering(
  chat: FullChatConfigure,
  configuring: FullGlobalConfigure,
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
): Promise<RenderPreparation> {
  const { image } = await render(chat, configuring, context.canvas);
  const image_bitmap = await window.createImageBitmap(image);
  if (configuring.shared.selected_mode!.name === "danmaku") {
    return { render: image_bitmap, render_pass2: undefined };
  }
  return new BubbleRenderingChat(
    image_bitmap,
    new AnimationProgressController(
      {
        start: chat.shared.enter_millisecond + configuring.shared.lift_duration,
        end:
          chat.shared.enter_millisecond +
          configuring.shared.lift_duration +
          configuring.shared.enter_duration,
      },
      {
        easing: easing_functions.ease_out_sine,
      },
    ),
    configuring.shared.main_axis,
    configuring.shared.flow_direction,
  );
}

const CHAT_BUBBLE: ThemeSpecification = {
  name,
  global_configure: ChatBubbleGlobalConfig,
  editor: ChatBubbleEditor,
  display: ChatBubbleDisplay,
  prepare_chat: (chat: FullChatConfigure) => {
    if (chat.themed.theme !== name) {
      chat.themed.theme = name;
      chat.themed.content = { ...DefaultConfigure };
    }
  },
  render,
  prepare_entering_animation,
  prepare_rendering,
};
export default CHAT_BUBBLE;
