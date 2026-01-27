import type { Coordinate, RenderTime, Size } from "@/utilities/rendering";
import {
  type FullChatConfigure,
  type FullGlobalConfigure,
  RenderingChat,
  type RenderPreparation,
} from "@/components/chat-themes/interface";

export function prepare_chats(
  container: HTMLDivElement,
  chat_configs: FullChatConfigure[],
): {
  chat: FullChatConfigure;
  element: Element;
}[] {
  const chat_elements = [...container.children];
  return chat_elements.map((element, index) => ({
    chat: chat_configs[index]!,
    element,
  }));
}

export function gather_theme_animations(
  chats: ReturnType<typeof prepare_chats>,
  animations: Animation[],
  configuring: FullGlobalConfigure,
) {
  const revokes: (() => void)[] = [];
  for (const { chat, element } of chats) {
    const { animation, revoke } =
      configuring.shared.selected_theme!.prepare_entering_animation(
        chat,
        element,
        configuring,
      );
    if (animation) {
      animations.push(...animation);
    }
    if (revoke) {
      revokes.push(revoke);
    }
  }
  return revokes;
}

// wrapper to do waitings before and after the preview
export function preview_wrapper(
  delay_before_start: number,
  play_preview: () => Promise<void>,
  delay_after_play: number,
  end_preview: () => void,
): () => Promise<void> {
  return async () => {
    // delay by the specified duration before doing anything else
    await new Promise((resolve, _reject) => {
      setTimeout(resolve, delay_before_start);
    });

    // start the preview and wait for it
    await play_preview();

    // delay before cleanups
    await new Promise((resolve, _reject) => {
      setTimeout(resolve, delay_after_play);
    });

    // do cleanup
    end_preview();
  };
}

// helper class to communicate with the video encoder
export class SceneVideoEncoder {
  static #url = "http://localhost:8020/";

  private constructor() {}

  static async build(fps: number, size: Size) {
    await fetch(SceneVideoEncoder.#url, {
      method: "POST",
      body: JSON.stringify({
        method: "begin",
        fps,
        height: size.height,
        width: size.width,
      }),
      headers: { "Content-Type": "application/json" },
    });
    return new SceneVideoEncoder();
  }

  async add_frame(
    context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  ) {
    const image = context.getImageData(
      0,
      0,
      context.canvas.width,
      context.canvas.height,
    );
    return await fetch(SceneVideoEncoder.#url, {
      method: "POST",
      body: image.data,
      headers: { "Content-Type": "application/octet-stream" },
    });
  }

  async close() {
    return await fetch(SceneVideoEncoder.#url, {
      method: "POST",
      body: JSON.stringify({ method: "end" }),
      headers: { "Content-Type": "application/json" },
    });
  }
}

function has_overlap(
  rect1: { topleft: Coordinate; bottomright: Coordinate },
  rect2: { topleft: Coordinate; bottomright: Coordinate },
): boolean {
  if (rect1.topleft.x > rect2.bottomright.x) {
    return false;
  }
  if (rect1.bottomright.x < rect2.topleft.x) {
    return false;
  }
  if (rect1.topleft.y > rect2.bottomright.y) {
    return false;
  }
  if (rect1.bottomright.y < rect2.topleft.y) {
    return false;
  }
  return true;
}

export class ChatControlBlock {
  #rendering_chat: RenderingChat | undefined = undefined;
  #initial_topleft: Coordinate;
  #topleft: Coordinate;
  #image: ImageBitmap | undefined = undefined;
  #image_pass2: { image: ImageBitmap; offset?: Size } | undefined = undefined;
  #entered_scene: { pass1: boolean; pass2: boolean } = {
    pass1: false,
    pass2: false,
  };

  #out_of_scene = false;
  #pending_remove = false;

  constructor(preparation: RenderPreparation, topleft: Coordinate) {
    if (preparation instanceof RenderingChat) {
      this.#rendering_chat = preparation;
    } else {
      this.#image = preparation.render;
      this.#image_pass2 = preparation.render_pass2;
    }
    this.#topleft = { ...topleft };
    this.#initial_topleft = { ...topleft };
  }

  // update the position of the bounding box and return if current block should be removed
  async update_position(
    delta: Size,
    scene: { topleft: Coordinate; bottomright: Coordinate },
  ): Promise<boolean> {
    this.#topleft.x = this.#initial_topleft.x + delta.width;
    this.#topleft.y = this.#initial_topleft.y + delta.height;

    if (this.#rendering_chat || this.#image) {
      const bounding_box_size = this.#rendering_chat?.size ?? {
        height: this.#image!.height,
        width: this.#image!.width,
      };
      const bounding_box = {
        topleft: this.#topleft,
        bottomright: {
          x: this.#topleft.x + bounding_box_size.width,
          y: this.#topleft.y + bounding_box_size.height,
        },
      };
      if (has_overlap(scene, bounding_box)) {
        this.#entered_scene.pass1 = true;
      } else if (this.#entered_scene.pass1) {
        this.#out_of_scene = true;
        if (this.#image) {
          this.#image.close();
          this.#image = undefined;
        }
      }
    }

    if (this.#image_pass2) {
      const bounding_box = {
        topleft: {
          x: this.#topleft.x + (this.#image_pass2.offset?.width ?? 0),
          y: this.#topleft.y + (this.#image_pass2.offset?.height ?? 0),
        },
        bottomright: {
          x:
            this.#topleft.x +
            (this.#image_pass2.offset?.width ?? 0) +
            this.#image_pass2.image.width,
          y:
            this.#topleft.y +
            (this.#image_pass2.offset?.height ?? 0) +
            this.#image_pass2.image.height,
        },
      };
      if (has_overlap(scene, bounding_box)) {
        this.#entered_scene.pass2 = true;
      } else if (this.#entered_scene.pass2) {
        this.#image_pass2.image.close();
        this.#image_pass2 = undefined;
      }
    }

    if (this.#rendering_chat) {
      if (
        this.#image &&
        (!this.#rendering_chat.render_pass2 || this.#image_pass2)
      ) {
        await this.#rendering_chat.free();
        this.#rendering_chat = undefined;
      } else {
        return this.#pending_remove;
      }
    }
    return this.#image === undefined && this.#image_pass2 === undefined;
  }

  render(
    context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    helping_context:
      | CanvasRenderingContext2D
      | OffscreenCanvasRenderingContext2D,
    timing: RenderTime,
  ) {
    if (this.#rendering_chat && !this.#image) {
      const result = this.#rendering_chat.render(
        context,
        helping_context,
        { topleft: this.#topleft, out_of_scene: this.#out_of_scene },
        timing,
      );
      if (result === false) {
        this.#pending_remove = true;
      } else if (result instanceof ImageBitmap) {
        this.#image = result;
        context.drawImage(this.#image, this.#topleft.x, this.#topleft.y);
      }
    }
    if (this.#image) {
      context.drawImage(this.#image, this.#topleft.x, this.#topleft.y);
    }
  }

  render_pass2(
    context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    helping_context:
      | CanvasRenderingContext2D
      | OffscreenCanvasRenderingContext2D,
    timing: RenderTime,
  ) {
    if (
      this.#rendering_chat &&
      this.#rendering_chat.render_pass2 &&
      !this.#image_pass2
    ) {
      const result = this.#rendering_chat.render_pass2(
        context,
        helping_context,
        { topleft: this.#topleft, out_of_scene: this.#out_of_scene },
        timing,
      );
      if (result === false) {
        this.#pending_remove = true;
      } else if (result !== true) {
        this.#image_pass2 = result;
      }
    }

    if (this.#image_pass2) {
      const image = this.#image_pass2.image;
      const offset = this.#image_pass2.offset ?? { height: 0, width: 0 };
      context.drawImage(
        image,
        this.#topleft.x + offset.width,
        this.#topleft.y + offset.height,
      );
    }
  }

  async free() {
    if (this.#rendering_chat) {
      await this.#rendering_chat.free();
    }
    if (this.#image) {
      this.#image.close();
    }
    if (this.#image_pass2) {
      this.#image_pass2.image.close();
    }
  }
}

export class AnimationProgressController {
  time: { start: number; end: number };
  #easing_function: (t: number) => number;
  #value: { start: number; end: number } | undefined;

  constructor(
    time: { start: number; end: number },
    options?: {
      easing?: (t: number) => number;
      value?: { start: number; end: number };
    },
  ) {
    this.time = time;
    this.#easing_function = options?.easing ?? ((x) => x);
    this.#value = options?.value;
  }

  get_ratio(current_time: number): number {
    const clamped_time = (() => {
      if (current_time < this.time.start) {
        return this.time.start;
      }
      if (current_time > this.time.end) {
        return this.time.end;
      }
      return current_time;
    })();
    return this.#easing_function(
      (clamped_time - this.time.start) / (this.time.end - this.time.start),
    );
  }

  get_value(current_time: number, start?: number, end?: number): number {
    const real_start = start ?? this.#value?.start;
    const real_end = end ?? this.#value?.end;
    if (real_start === undefined || real_end === undefined) {
      return 0;
    }
    return real_start + (real_end - real_start) * this.get_ratio(current_time);
  }
}
