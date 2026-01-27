import type { GlobalConfigures } from "./configures";
import type { Configuring } from "@/components/MainView.vue";
import { AnimationProgressController } from "@/scene/utility";
import easing_functions from "@/utilities/easing-functions";
import {
  canvas_to_blob,
  CanvasDrawingState,
  type Coordinate,
  prepare_canvas,
  type RenderSpace,
  type RenderTime,
  type Size,
} from "@/utilities/rendering";
import { prepare_text_rendering } from "@/utilities/text-rendering";
import {
  type FullChatConfigure,
  type FullGlobalConfigure,
  RenderingChat,
  type RenderPreparation,
  type SharedChatConfigure,
} from "../interface";
import { diamond } from "./GlobalConfig.vue";

// measure username and prepare for rendering
//  return the bounding box of the username and a function render that, when called with a anchor,
//  renders the username by placing the bottom-center point of the username bounding box at that coordinate
function prepare_username(
  chat: SharedChatConfigure,
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
): {
  size: Size;
  render: (
    context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    anchor: Coordinate,
  ) => void;
} {
  const measurement = context.measureText(chat.username);
  const size: Size = {
    height:
      measurement.fontBoundingBoxAscent + measurement.fontBoundingBoxDescent,
    width:
      measurement.actualBoundingBoxLeft + measurement.actualBoundingBoxRight,
  };
  return {
    size,
    render: (context, anchor) => {
      context.fillText(
        chat.username,
        anchor.x - size.width / 2 - measurement.actualBoundingBoxLeft,
        anchor.y - measurement.fontBoundingBoxDescent,
      );
    },
  };
}

// render username to a canvas
//  anchor is where the top-left point of the bounding box of the marker should be placed
function render_mark(
  configuring: GlobalConfigures,
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  anchor: Coordinate,
) {
  const step_size = configuring.username_marker_size / 5;
  context.beginPath();
  context.moveTo(anchor.x + 2 * step_size, anchor.y + 0 * step_size);
  context.lineTo(anchor.x + 3 * step_size, anchor.y + 0 * step_size);
  context.lineTo(anchor.x + 3 * step_size, anchor.y + 2 * step_size);
  context.lineTo(anchor.x + 5 * step_size, anchor.y + 2 * step_size);
  context.lineTo(anchor.x + 5 * step_size, anchor.y + 3 * step_size);
  context.lineTo(anchor.x + 3 * step_size, anchor.y + 3 * step_size);
  context.lineTo(anchor.x + 3 * step_size, anchor.y + 5 * step_size);
  context.lineTo(anchor.x + 2 * step_size, anchor.y + 5 * step_size);
  context.lineTo(anchor.x + 2 * step_size, anchor.y + 3 * step_size);
  context.lineTo(anchor.x + 0 * step_size, anchor.y + 3 * step_size);
  context.lineTo(anchor.x + 0 * step_size, anchor.y + 2 * step_size);
  context.lineTo(anchor.x + 2 * step_size, anchor.y + 2 * step_size);
  context.closePath();
  context.fill();
}

// render a star
//  anchor is where the top-left point of the bounding box of the star should be placed
function render_diamond(
  size: number,
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  anchor: Coordinate,
) {
  context.drawImage(diamond, anchor.x, anchor.y, size, size);
}

// prepare components of the rendered image
//  all of returned rendering functions take three parameters: the context to render to, the topleft
//   coordinate of the WHOLE BOUNDING BOX and offset to apply to the coordinate.
//  render_username_diamond is special, which takes an extra parameter, scale, that controls the scaling when
//   rendering the diamond
async function prepare_components(
  chat: SharedChatConfigure,
  configuring: { shared: Configuring; themed: GlobalConfigures },
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
) {
  const measurement = context.measureText("x");
  const ex =
    measurement.actualBoundingBoxAscent + measurement.actualBoundingBoxDescent;
  const { size: username_size, render: render_username } = prepare_username(
    chat,
    context,
  );
  const {
    size: content_size,
    render: render_content,
    release,
  } = await prepare_text_rendering(
    chat.content,
    configuring.shared,
    configuring.themed.content_width,
    context.canvas,
    { alignment: "center" },
  );
  const username_line_size: Size = {
    width:
      username_size.width +
      (configuring.themed.username_marker_gap +
        configuring.themed.username_marker_size) *
        2,
    height: Math.max(
      configuring.themed.username_marker_size,
      username_size.height,
    ),
  };
  const bounding_box: Size = {
    width:
      Math.max(
        username_line_size.width,
        configuring.themed.divider_width,
        content_size.width,
      ) +
      2 * configuring.themed.box_padding,
    height:
      username_line_size.height +
      configuring.themed.divider_height +
      configuring.themed.divider_margin * 2 +
      content_size.height +
      2 * configuring.themed.box_padding,
  };

  return {
    bounding_box,
    username: {
      size: username_size,
      render: (
        context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
        anchor: Coordinate,
        offset: Size,
      ) => {
        const basic_anchor: Coordinate = {
          x: anchor.x + bounding_box.width / 2,
          y:
            anchor.y +
            configuring.themed.box_padding +
            (username_line_size.height + username_size.height) / 2,
        };
        render_username(context, {
          x: basic_anchor.x + offset.width,
          y: basic_anchor.y + offset.height,
        });
      },
    },
    content: {
      size: content_size,
      render: (
        context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
        anchor: Coordinate,
        offset: Size,
      ) => {
        const basic_anchor: Coordinate = {
          x: anchor.x + (bounding_box.width - content_size.width) / 2,
          y:
            anchor.y +
            configuring.themed.box_padding +
            username_line_size.height +
            configuring.themed.divider_margin * 2 +
            configuring.themed.divider_height,
        };
        render_content(context, {
          x: basic_anchor.x + offset.width,
          y: basic_anchor.y + offset.height,
        });
      },
      release,
    },
    render_mark: (
      context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
      anchor: Coordinate,
      offset: Size,
    ) => {
      const basic_central_anchor: Coordinate = {
        x: anchor.x + bounding_box.width / 2,
        y:
          anchor.y +
          configuring.themed.box_padding +
          (username_line_size.height -
            configuring.themed.username_marker_size) /
            2,
      };
      render_mark(configuring.themed, context, {
        x:
          basic_central_anchor.x -
          username_size.width / 2 -
          configuring.themed.username_marker_gap -
          configuring.themed.username_marker_size +
          offset.width,
        y: basic_central_anchor.y + offset.height,
      });
      render_mark(configuring.themed, context, {
        x:
          basic_central_anchor.x +
          username_size.width / 2 +
          configuring.themed.username_marker_gap +
          offset.width,
        y: basic_central_anchor.y + offset.height,
      });
    },
    render_divider: (
      context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
      anchor: Coordinate,
      offset: Size,
    ) => {
      const basic_anchor: Coordinate = {
        x:
          anchor.x +
          (bounding_box.width - configuring.themed.divider_width) / 2,
        y:
          anchor.y +
          configuring.themed.box_padding +
          username_line_size.height +
          configuring.themed.divider_margin,
      };
      context.fillRect(
        basic_anchor.x + offset.width,
        basic_anchor.y + offset.height,
        configuring.themed.divider_width,
        configuring.themed.divider_height,
      );
    },
    render_username_diamond: (
      context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
      anchor: Coordinate,
      offset: Size,
      scale: number,
    ) => {
      const reference: Coordinate = {
        x: anchor.x + configuring.themed.box_padding + offset.width,
        y:
          anchor.y +
          configuring.themed.box_padding +
          username_line_size.height +
          offset.height,
      };

      const smaller_center: Coordinate = {
        x: reference.x + ex / 4 + configuring.themed.smaller_star_size / 2,
        y: reference.y - ex / 4 - configuring.themed.smaller_star_size / 2,
      };
      const smaller_size = configuring.themed.smaller_star_size * scale;
      render_diamond(smaller_size, context, {
        x: smaller_center.x - smaller_size / 2,
        y: smaller_center.y - smaller_size / 2,
      });

      const larger_center: Coordinate = {
        x:
          reference.x +
          configuring.shared.chat_font_size / 2 +
          configuring.themed.larger_star_size / 2,
        y:
          reference.y -
          configuring.shared.chat_font_size / 4 -
          ex / 2 -
          configuring.themed.larger_star_size / 2,
      };
      const larger_size = configuring.themed.larger_star_size * scale;
      render_diamond(larger_size, context, {
        x: larger_center.x - larger_size / 2,
        y: larger_center.y - larger_size / 2,
      });
    },
    render_content_diamond: (
      context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
      anchor: Coordinate,
      offset: Size,
    ) => {
      render_diamond(configuring.themed.larger_star_size, context, {
        x:
          anchor.x +
          bounding_box.width -
          configuring.themed.box_padding -
          configuring.themed.larger_star_size +
          offset.width,
        y:
          anchor.y +
          configuring.themed.box_padding +
          username_line_size.height +
          configuring.themed.divider_margin * 2 +
          configuring.themed.divider_height +
          configuring.shared.chat_font_size / 4 +
          offset.height,
      });
    },
  };
}

export async function render(
  chat: FullChatConfigure,
  configuring: FullGlobalConfigure,
  canvas?: HTMLCanvasElement | OffscreenCanvas,
): Promise<{
  image: Blob;
  canvas: HTMLCanvasElement | OffscreenCanvas;
}> {
  const [used_canvas, context] = prepare_canvas(canvas);
  const themed_configs = configuring.themes.content as GlobalConfigures;

  context.font = `${configuring.shared.chat_font_size}px "${configuring.shared.font_family}"`;
  context.textRendering = "optimizeLegibility";
  context.fillStyle = "white";
  const state = new CanvasDrawingState(context);

  const components = await prepare_components(
    chat.shared,
    { shared: configuring.shared, themed: themed_configs },
    context,
  );

  used_canvas.height = components.bounding_box.height;
  used_canvas.width = components.bounding_box.width;
  state.apply(context);

  const anchor: Coordinate = { x: 0, y: 0 };
  const offset: Size = { width: 0, height: 0 };
  components.render_username_diamond(context, anchor, offset, 1);
  components.render_content_diamond(context, anchor, offset);
  components.render_mark(context, anchor, offset);
  components.username.render(context, anchor, offset);
  components.render_divider(context, anchor, offset);
  components.content.render(context, anchor, offset);
  await components.content.release();

  return { image: await canvas_to_blob(used_canvas), canvas: used_canvas };
}

class Rendering extends RenderingChat {
  size: Size;

  render_pass2 = undefined;

  #components: Awaited<ReturnType<typeof prepare_components>>;
  #large_diamond_size: number;
  #marker_size: number;
  #divider_size: number;

  #blinking_timers: {
    username: (time: number) => number;
    content: (time: number) => number;
  };

  #entering_timers:
    | {
        username: AnimationProgressController;
        other: AnimationProgressController;
      }
    | undefined;

  constructor(
    components: Awaited<ReturnType<typeof prepare_components>>,
    chat: SharedChatConfigure,
    configuring: {
      shared: Configuring;
      themed: GlobalConfigures;
    },
  ) {
    super();
    this.#components = components;
    this.size = this.#components.bounding_box;
    this.#large_diamond_size = configuring.themed.larger_star_size;
    this.#marker_size = configuring.themed.username_marker_size;
    this.#divider_size = configuring.themed.divider_width;
    {
      const username_timer = new AnimationProgressController(
        { start: 0, end: configuring.themed.username_star_blink_rate / 2 },
        {
          easing: easing_functions.ease_in_out_quad,
          value: { start: 0, end: 1 },
        },
      );
      const content_timer = new AnimationProgressController(
        { start: 0, end: configuring.themed.content_star_blink_rate / 2 },
        {
          easing: easing_functions.ease_in_out_quad,
          value: { start: 0, end: 1 },
        },
      );
      const username_initial_phase = Math.round(
        Math.random() * configuring.themed.username_star_blink_rate,
      );
      const content_initial_phase = Math.round(
        Math.random() * configuring.themed.content_star_blink_rate,
      );

      this.#blinking_timers = {
        username: (time) => {
          const effective_time =
            (username_initial_phase + time) %
            configuring.themed.username_star_blink_rate;
          const used_time =
            effective_time %
            Math.round(configuring.themed.username_star_blink_rate / 2);
          const raw = username_timer.get_value(used_time);
          return used_time < effective_time ? raw : 1 - raw;
        },
        content: (time) => {
          const effective_time =
            (content_initial_phase + time) %
            configuring.themed.content_star_blink_rate;
          const used_time =
            effective_time %
            Math.round(configuring.themed.content_star_blink_rate / 2);
          const raw = content_timer.get_value(used_time);
          return used_time < effective_time ? raw : 1 - raw;
        },
      };
    }
    this.#entering_timers =
      configuring.shared.selected_mode!.name === "danmaku"
        ? undefined
        : {
            username: new AnimationProgressController(
              {
                start:
                  chat.enter_millisecond + configuring.shared.lift_duration,
                end:
                  chat.enter_millisecond +
                  configuring.shared.lift_duration +
                  configuring.shared.enter_duration,
              },
              {
                easing: (t) => 1 - 4 * Math.pow(t - 0.5, 2),
              },
            ),
            other: new AnimationProgressController(
              {
                start:
                  chat.enter_millisecond + configuring.shared.lift_duration,
                end:
                  chat.enter_millisecond +
                  configuring.shared.lift_duration +
                  configuring.shared.enter_duration,
              },
              {
                easing: easing_functions.ease_out_cubic,
              },
            ),
          };
  }

  render(
    context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    _helping_context:
      | CanvasRenderingContext2D
      | OffscreenCanvasRenderingContext2D,
    spacing: RenderSpace,
    timing: RenderTime,
  ): ImageBitmap | boolean {
    if (spacing.out_of_scene) {
      return false;
    }
    context.fillStyle = "white";
    if (this.#entering_timers === undefined) {
      const offset: Size = { width: 0, height: 0 };
      const backup = context.globalAlpha;
      context.globalAlpha = this.#blinking_timers.username(timing.current_time);
      this.#components.render_username_diamond(
        context,
        spacing.topleft,
        offset,
        1,
      );
      context.globalAlpha = this.#blinking_timers.content(timing.current_time);
      this.#components.render_content_diamond(context, spacing.topleft, offset);
      context.globalAlpha = backup;
      this.#components.render_mark(context, spacing.topleft, offset);
      this.#components.username.render(context, spacing.topleft, offset);
      this.#components.render_divider(context, spacing.topleft, offset);
      this.#components.content.render(context, spacing.topleft, offset);
    } else {
      const backup = context.globalAlpha;
      const general_ratio = this.#entering_timers.other.get_ratio(
        timing.current_time,
      );
      const total_alpha = general_ratio;
      context.globalAlpha =
        total_alpha * this.#blinking_timers.username(timing.current_time);
      this.#components.render_username_diamond(
        context,
        spacing.topleft,
        { width: 0, height: 0 },
        0.6 + 0.4 * general_ratio,
      );
      context.globalAlpha =
        total_alpha * this.#blinking_timers.content(timing.current_time);
      this.#components.render_content_diamond(context, spacing.topleft, {
        width: 0,
        height: 0.4 * this.#large_diamond_size * (1 - general_ratio),
      });
      context.globalAlpha = total_alpha;
      this.#components.render_mark(context, spacing.topleft, {
        width: 0,
        height: this.#marker_size * (general_ratio - 1),
      });
      this.#components.username.render(context, spacing.topleft, {
        width: 0,
        height:
          -this.#components.username.size.height *
          0.4 *
          this.#entering_timers.username.get_ratio(timing.current_time),
      });
      this.#components.render_divider(context, spacing.topleft, {
        width: 0.1 * this.#divider_size * (general_ratio - 1),
        height: 0,
      });
      this.#components.content.render(context, spacing.topleft, {
        width: 0.4 * this.#components.content.size.width * (1 - general_ratio),
        height: 0,
      });
      context.globalAlpha = backup;

      if (this.#entering_timers.other.time.end <= timing.current_time) {
        this.#entering_timers = undefined;
      }
    }
    return true;
  }

  async free(): Promise<void> {
    await this.#components.content.release();
  }
}

export async function prepare_rendering(
  chat: FullChatConfigure,
  configuring: FullGlobalConfigure,
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
): Promise<RenderPreparation> {
  // prepare components for rendering entering animations
  context.font = `${configuring.shared.chat_font_size}px "${configuring.shared.font_family}"`;
  context.textRendering = "optimizeLegibility";
  const components = await prepare_components(
    chat.shared,
    { shared: configuring.shared, themed: configuring.themes.content as any },
    context,
  );

  return new Rendering(components, chat.shared, {
    shared: configuring.shared,
    themed: configuring.themes.content as any,
  });
}
