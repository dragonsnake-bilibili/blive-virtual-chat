import type { SharedChatConfigure } from "@/components/chat-themes/interface";
import type {
  FlowDirectionType,
  MainAxisDirectionType,
} from "@/components/MainView.vue";
import { useEmotes } from "@/stores/emotes";

// time information for reference during the rendering procedure
//
// Time elapsed and frames generated during the wait (delay) before the scene starts is never counted
// Time and frames after the scene finished (during the wait / delay afterwards) are counted in order to make
//  animations possible in that period since some chat may still be visible
export type RenderTime = {
  // index of current frame which is being rendered
  // Such indices starts with 0 which refers to the first frame being rendered
  // Note: this value may be -1, which indicates that this time point is not align with a video frame.
  //  This might be helpful for certain themes.
  current_frame: number;

  // duration after the scene starts
  current_time: number;

  // duration between last and current rendering
  // If this is the first rendering, this value will be -1
  time_delta: number;
};

// space information for reference during the rendering procedure
export type RenderSpace = {
  // the coordinate at which the top-left corner of the rendered element should be aligned to
  topleft: Coordinate;

  // if the bounding box of the element being rendered shares no common area with the scene
  //  the element being rendered can judge if it can be released now
  out_of_scene: boolean;
};

// Create a (offscreen) canvas if one is not supplied and return the canvas used with a rendering context
export function prepare_canvas(
  canvas?: HTMLCanvasElement | OffscreenCanvas,
): [
  HTMLCanvasElement | OffscreenCanvas,
  CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
] {
  const used_canvas = canvas ?? new OffscreenCanvas(0, 0);
  const context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D =
    used_canvas.getContext("2d")! as any;
  return [used_canvas, context];
}

export type Coordinate = { x: number; y: number };
export type Shape = {
  width: number;
  above_baseline: number;
  below_baseline: number;
};
export type Size = {
  width: number;
  height: number;
};

// The scene has two axises, the main axis and the cross axis
// The main axis is the axis alone which the chats travels: for stack mode, this is the direction to stack
//  chats; for danmaku mode, this is the direction chats are fired towards. Also check the figure below.
// +--------------+ ^        <-------------------- main -------------------->
// |    Chat i    | | m        +------------+ ---
// +--------------+ | a        |   Chat i   |  ---
// +--------------+ | i        +------------+   ---  +------------+ ---
// |    Chat j    | | n                              |   Chat j   |  ---
// +--------------+ v                                +------------+   ---
//
//    stack mode                               danmaku mode
//
// The cross axis is simply the axis orthogonal to the main axis
// The word `length' refers to the size of an element along the main axis,
//  while `breadth' refers to the size along the cross axis.
export type DirectedSize = {
  length: number; // size along the main axis
  breadth: number; // size along the cross axis
};

// convert size to directed size according to the main axis configuration
export function to_directed_size(
  size: Size,
  main_axis: MainAxisDirectionType,
): DirectedSize {
  switch (main_axis) {
    case "horizontal": {
      return { length: size.width, breadth: size.height };
    }
    case "vertical": {
      return { length: size.height, breadth: size.width };
    }
  }
}

// convert directed size to standard size
export function to_standard_size(
  size: DirectedSize,
  main_axis: MainAxisDirectionType,
): Size {
  switch (main_axis) {
    case "horizontal": {
      return { width: size.length, height: size.breadth };
    }
    case "vertical": {
      return { width: size.breadth, height: size.length };
    }
  }
}

// get the sign of flow direction on the main axis
export function get_flow_sign(flow: FlowDirectionType): 1 | -1 {
  switch (flow) {
    case "default": {
      return -1;
    }
    case "inverse": {
      return 1;
    }
  }
}

// convert avatar from an URL to Blob with proper cropping
//
// This function will load the avatar from the URL specified and convert it into an Blob.
// The result ImageBitmap will be cropped with a circle at the center.
export async function prepare_avatar(
  avatar: string,
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  size: number,
): Promise<Blob> {
  const avatar_bitmap = await window.createImageBitmap(
    await (await fetch(avatar)).blob(),
    {
      resizeHeight: size,
      resizeWidth: size,
      resizeQuality: "high",
    },
  );
  context.canvas.height = size;
  context.canvas.width = size;
  context.beginPath();
  context.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2, true);
  context.clip();
  context.drawImage(avatar_bitmap, 0, 0);

  const canvas = context.canvas;
  const build_image =
    canvas instanceof OffscreenCanvas
      ? canvas.convertToBlob({ type: "image/png" })
      : new Promise<Blob>((resolve, _reject) => {
          canvas.toBlob((blob) => resolve(blob!), "image/png");
        });
  return await build_image;
}

// Render a rectangle with rounded corners
//
// The size of rounded corners can be specified as either one or four numbers
//  A single number: the size of all four rounded corners
//  Four numbers: the size of rounded corner at top-left, top-right, bottom-right and bottom-left
// This function returns the coordinate of the center of each circles with the actual radius picked.
//  The radius picked can be less than the specified value if the size of the rectangle is not large enough
export function draw_rectangle(
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  top_left: Coordinate,
  size: Size,
  rounded_corder: number | [number, number, number, number],
  options?: {
    stroke?: boolean;
    fill?: boolean;
  },
) {
  const maximum_radius = Math.min(size.height, size.width) / 2;
  const radius = (
    Array.isArray(rounded_corder)
      ? rounded_corder.map((r) => Math.min(r, maximum_radius))
      : Array.from({ length: 4 }).fill(Math.min(rounded_corder, maximum_radius))
  ) as [number, number, number, number];
  const centers: [Coordinate, Coordinate, Coordinate, Coordinate] = [
    { x: top_left.x + radius[0], y: top_left.y + radius[0] },
    { x: top_left.x + size.width - radius[1], y: top_left.y + radius[1] },
    {
      x: top_left.x + size.width - radius[2],
      y: top_left.y + size.height - radius[2],
    },
    { x: top_left.x + radius[3], y: top_left.y + size.height - radius[3] },
  ];
  const result = centers.map((center, index) => [center, radius[index]]) as [
    [Coordinate, number],
    [Coordinate, number],
    [Coordinate, number],
    [Coordinate, number],
  ];
  context.beginPath();
  for (const [index, [center, radius]] of result.entries()) {
    const modifier = (Math.PI / 2) * index;
    context.arc(
      center.x,
      center.y,
      radius,
      Math.PI + modifier,
      (Math.PI * 3) / 2 + modifier,
      false,
    );
  }
  context.closePath();
  if (options?.fill) {
    context.fill();
  }
  if (options?.stroke) {
    context.stroke();
  }
  return result;
}

// helper to draw lines easily, majorly used when debugging
export function draw_line(
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  start: Coordinate,
  end: Coordinate,
  color = "#c64dbe",
) {
  const backup = context.strokeStyle;
  context.strokeStyle = color;
  context.beginPath();
  context.moveTo(start.x, start.y);
  context.lineTo(end.x, end.y);
  context.stroke();
  context.closePath();
  context.strokeStyle = backup;
}

// render a smooth curve through specified sequence of points
//
// This function uses cubic Bézier curves to connect the specified sequence of points where the final curve
//  is smooth (has continuous first-order derivative). Specifying less than 2 points in the sequence will be
//  a no-op.
// The first-order derivative at every specified point is decided by the slope of line connecting the previous
//  and next point in the sequence, on which line the second control point for the Bézier curves from the
//  previous point to current point and the first control point for the one from current point to next point
//  is placed. control_point_scale configures how far these control points is placed away from current point.
// Due to how the first-order derivative is calculated, the input sequence must be padded so that the first
//  control point and the last control point of the whole curve can be placed. boundary controls how dummy
//  point is padded, which can take one of the following values:
//  duplicate: duplicate the first and last point as padded points
//  mirror: move the second point towards the first point by a distance equal to twice the distance between
//   them; the same applies to the end of the sequence
//  cycle: duplicate the first point after the last one and the last one before the first one. This is a
//   special mode: the curve is closed automatically in this mode
export function bezier_through(
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  points: Coordinate[],
  options?: {
    control_point_scale?: { first?: number; second?: number };
    boundary?: "duplicate" | "mirror" | "cycle";
  },
) {
  if (points.length <= 1) {
    return;
  }
  const helper_points = ((): [Coordinate, Coordinate] => {
    const boundary = options?.boundary ?? "duplicate";
    switch (boundary) {
      case "duplicate": {
        return [points.at(0)!, points.at(-1)!];
      }
      case "mirror": {
        function mirror(source: Coordinate, by: Coordinate): Coordinate {
          const { x: x_source, y: y_source } = source;
          const { x: x_mirror, y: y_mirror } = by;
          return {
            x: x_mirror + x_mirror - x_source,
            y: y_mirror + y_mirror - y_source,
          };
        }
        return [
          mirror(points.at(1)!, points.at(0)!),
          mirror(points.at(-2)!, points.at(-1)!),
        ];
      }
      case "cycle": {
        return [points.at(-1)!, points.at(0)!];
      }
    }
  })();
  const padded_points = [helper_points[0], ...points, helper_points[1]];
  const a = options?.control_point_scale?.first ?? 0.25;
  const b = options?.control_point_scale?.second ?? 0.25;
  const full_points: Coordinate[] = [];
  for (let i = 1; i <= points.length; i++) {
    const { x: x_last, y: y_last } = padded_points[i - 1]!;
    const { x: x_current, y: y_current } = padded_points[i]!;
    const { x: x_next, y: y_next } = padded_points[i + 1]!;

    const vector: [number, number] = [x_next - x_last, y_next - y_last];
    full_points.push(
      {
        x: x_current - b * vector[0],
        y: y_current - b * vector[1],
      },
      { x: x_current, y: y_current },
      {
        x: x_current + a * vector[0],
        y: y_current + a * vector[1],
      },
    );
  }
  const final_points =
    (options?.boundary ?? "duplicate") === "cycle"
      ? [...full_points.slice(2), ...full_points.slice(0, 2)]
      : full_points.slice(2, -1);
  context.beginPath();
  context.moveTo(points[0]!.x, points[0]!.y);
  for (let i = 0; i < final_points.length; i += 3) {
    const { x: x_a, y: y_a } = final_points[i]!;
    const { x: x_b, y: y_b } = final_points[i + 1]!;
    const { x, y } = final_points[i + 2]!;
    context.bezierCurveTo(x_a, y_a, x_b, y_b, x, y);
  }
  context.stroke();
}

// prepare images used to render badges
//
// This function takes a shared chat configuration and checks badges applied to it. The corresponding images
//  are then loaded from the emote provider and resized to the specified size. Note that if some image cannot
//  be loaded, it will not appear in the array returned.
export async function prepare_badges(
  chat: SharedChatConfigure,
  size: number,
): Promise<ImageBitmap[]> {
  const result: ImageBitmap[] = [];
  const emote = useEmotes();
  for (const [included, id] of [
    [chat.logos.manager, "special/房管"],
    [chat.logos.governor, "special/总督"],
    [chat.logos.admiral, "special/提督"],
    [chat.logos.captain, "special/舰长"],
  ] as [boolean, string][]) {
    if (!included) {
      continue;
    }
    const image = emote.find_emote(id);
    if (image === undefined) {
      continue;
    }
    const image_bytes = await (await fetch(image)).blob();
    const bitmap = await window.createImageBitmap(image_bytes, {
      resizeHeight: size,
      resizeWidth: size,
      resizeQuality: "high",
    });
    result.push(bitmap);
  }
  return result;
}

export async function canvas_to_blob(
  canvas: HTMLCanvasElement | OffscreenCanvas,
): Promise<Blob> {
  const build_image =
    canvas instanceof OffscreenCanvas
      ? canvas.convertToBlob({ type: "image/png" })
      : new Promise<Blob>((resolve, _reject) => {
          canvas.toBlob((blob) => resolve(blob!), "image/png");
        });
  return build_image;
}

// helper to save / restore / transfer drawing state, possibly across canvas resizes
//  note that this class only handles a limited set of drawing states that we use
export class CanvasDrawingState {
  #state: {
    font: CanvasRenderingContext2D["font"];
    fill_style: CanvasRenderingContext2D["fillStyle"];
    stroke_style: CanvasRenderingContext2D["strokeStyle"];
    text_rendering: CanvasRenderingContext2D["textRendering"];
    global_alpha: CanvasRenderingContext2D["globalAlpha"];
  };

  constructor(
    context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  ) {
    this.#state = {
      font: context.font,
      fill_style: context.fillStyle,
      stroke_style: context.strokeStyle,
      text_rendering: context.textRendering,
      global_alpha: context.globalAlpha,
    };
  }

  apply(context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D) {
    context.font = this.#state.font;
    context.fillStyle = this.#state.fill_style;
    context.strokeStyle = this.#state.stroke_style;
    context.textRendering = this.#state.text_rendering;
    context.globalAlpha = this.#state.global_alpha;
  }
}
