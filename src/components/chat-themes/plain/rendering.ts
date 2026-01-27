import type {
  FullChatConfigure,
  FullGlobalConfigure,
  RenderPreparation,
} from "../interface";
import type { GlobalConfigures } from "./configures";
import { useEmotes } from "@/stores/emotes";
import {
  canvas_to_blob,
  prepare_avatar,
  prepare_canvas,
} from "@/utilities/rendering";
import {
  build_inline_image_box,
  render_text,
} from "@/utilities/text-rendering";

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

  // render badges
  const badges = await (async () => {
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
    if (logo_count === 0) {
      return { content: "", url: "" };
    }
    used_canvas.height = configuring.shared.chat_logo_size;
    used_canvas.width =
      configuring.shared.chat_logo_size * logo_count +
      (logo_count - 1) * themed_configs.badge_gap +
      themed_configs.username_to_badge;
    let x = themed_configs.username_to_badge;
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
      context.drawImage(bitmap, x, 0);
      bitmap.close();
      x += configuring.shared.chat_logo_size + themed_configs.badge_gap;
    }
    return await build_inline_image_box(
      await canvas_to_blob(used_canvas),
      { width: used_canvas.width, height: used_canvas.height },
      1,
      "sub",
      undefined,
      { before: false, after: false },
    );
  })();

  context.font = `${configuring.shared.chat_font_size}px "${configuring.shared.font_family}"`;
  context.textRendering = "optimizeLegibility";
  context.fillStyle = "white";

  // construct full content
  const space_available =
    configuring.shared.chat_width_limit -
    configuring.shared.chat_avatar_size -
    themed_configs.avatar_gap;
  const color_helper =
    chat.themed.content.name_color.toLowerCase() === "#ffffff"
      ? ""
      : `[:color:${chat.themed.content.name_color}:]`;
  const color_resetter =
    chat.themed.content.name_color.toLowerCase() === "#ffffff"
      ? ""
      : "[:color:#ffffff:]";
  const content = `${color_helper}${chat.shared.username}：${color_resetter}${badges.content}[:space:${themed_configs.content_gap}px:]${chat.shared.content}`;
  const { image: content_render } = await render_text(
    content,
    configuring.shared,
    space_available,
    used_canvas,
  );
  URL.revokeObjectURL(badges.url);
  const avatar = await prepare_avatar(
    chat.shared.avatar,
    context,
    configuring.shared.chat_avatar_size,
  );
  const avatar_bitmap = await window.createImageBitmap(avatar);
  const content_bitmap = await window.createImageBitmap(content_render);
  used_canvas.height = Math.max(avatar_bitmap.height, content_bitmap.height);
  used_canvas.width =
    avatar_bitmap.width + themed_configs.avatar_gap + content_bitmap.width;
  context.drawImage(avatar_bitmap, 0, 0);
  context.drawImage(
    content_bitmap,
    avatar_bitmap.width + themed_configs.avatar_gap,
    0,
  );
  return { image: await canvas_to_blob(used_canvas), canvas: used_canvas };
}

export async function prepare_rendering(
  chat: FullChatConfigure,
  configuring: FullGlobalConfigure,
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
): Promise<RenderPreparation> {
  return {
    render: await window.createImageBitmap(
      (await render(chat, configuring, context.canvas)).image,
    ),
  };
}
