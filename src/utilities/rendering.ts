import type {
  FlowDirectionType,
  MainAxisDirectionType,
} from "@/components/MainView.vue";

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
  context.fill();
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
