import type {
  FullChatConfigure,
  FullGlobalConfigure,
  RenderPreparation,
  SharedChatConfigure,
} from "../interface";
import type { ChatConfigures, GlobalConfigures } from "./configures";
import type { Configuring } from "@/components/MainView.vue";
import {
  canvas_to_blob,
  draw_rectangle,
  prepare_badges,
  prepare_canvas,
} from "@/utilities/rendering";
import { render_text } from "@/utilities/text-rendering";

async function prepare_avatar(
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  configuring: Configuring,
  themed_configs: GlobalConfigures,
  chat: SharedChatConfigure,
) {
  context.canvas.height = configuring.chat_avatar_size;
  context.canvas.width = configuring.chat_avatar_size;
  const gradient = context.createLinearGradient(
    (1 - themed_configs.transparent_ratio) * configuring.chat_avatar_size,
    0,
    configuring.chat_avatar_size,
    0,
  );
  gradient.addColorStop(0, "transparent");
  gradient.addColorStop(1, "white");
  context.fillStyle = gradient;
  draw_rectangle(
    context,
    {
      x: 0,
      y: (configuring.chat_avatar_size - themed_configs.card_height) / 2,
    },
    {
      width: configuring.chat_avatar_size,
      height: themed_configs.card_height,
    },
    [0, themed_configs.card_radius, themed_configs.card_radius, 0],
    { fill: true },
  );
  context.globalCompositeOperation = "source-in";
  const avatar = await (await fetch(chat.avatar)).blob();
  const image = await window.createImageBitmap(avatar, {
    resizeHeight: configuring.chat_avatar_size,
    resizeWidth: configuring.chat_avatar_size,
    resizeQuality: "high",
  });
  context.drawImage(image, 0, 0);
  context.globalCompositeOperation = "source-over";
  image.close();
  return await window.createImageBitmap(context.canvas);
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
  const themed_chat = chat.themed.content as ChatConfigures;

  // prepare badges
  const badges = await (async () => {
    const badges = await prepare_badges(
      chat.shared,
      configuring.shared.chat_logo_size,
    );
    if (badges.length === 0) {
      return undefined;
    }
    used_canvas.width =
      configuring.shared.chat_logo_size * badges.length +
      themed_configs.badge_gap * (badges.length - 1) +
      themed_configs.username_to_badge;
    used_canvas.height = configuring.shared.chat_logo_size;
    context.clearRect(0, 0, used_canvas.width, used_canvas.height);
    let current_x = themed_configs.username_to_badge;
    for (const image of badges) {
      context.drawImage(image, current_x, 0);
      current_x += themed_configs.badge_gap + configuring.shared.chat_logo_size;
      image.close();
    }
    return await window.createImageBitmap(used_canvas);
  })();

  // prepare paragraph content
  context.fillStyle = themed_chat.color;
  context.font = `${configuring.shared.chat_font_size}px "${configuring.shared.font_family}"`;
  const { image: raw_content } = await render_text(
    chat.shared.content,
    configuring.shared,
    themed_configs.content_width,
    used_canvas,
    {
      limit_height: {
        maximum_lines: themed_configs.content_lines,
        ellipsis: false,
      },
      algorithm: "knuth-plass",
    },
  );
  const content = await window.createImageBitmap(raw_content);

  // prepare avatar
  const avatar = await prepare_avatar(
    context,
    configuring.shared,
    themed_configs,
    chat.shared,
  );

  // put everything together
  used_canvas.width = configuring.shared.chat_width_limit;
  used_canvas.height = themed_configs.card_height;
  context.font = `${themed_configs.username_font_size}px "${configuring.shared.font_family}"`;
  //  draw background
  context.fillStyle = themed_configs.card_background;
  draw_rectangle(
    context,
    { x: 0, y: 0 },
    { width: used_canvas.width, height: used_canvas.height },
    themed_configs.card_radius,
    { fill: true },
  );
  //  draw username line
  context.fillStyle = themed_chat.color;
  const measurement = context.measureText(chat.shared.username);
  context.fillText(
    chat.shared.username,
    themed_configs.card_padding + measurement.actualBoundingBoxLeft,
    themed_configs.card_padding + measurement.fontBoundingBoxAscent,
  );
  if (badges !== undefined) {
    const ex_measure = context.measureText("x");
    const ex =
      ex_measure.actualBoundingBoxAscent + ex_measure.actualBoundingBoxDescent;
    context.drawImage(
      badges,
      themed_configs.card_padding +
        measurement.actualBoundingBoxLeft +
        measurement.actualBoundingBoxRight +
        themed_configs.username_to_badge,
      themed_configs.card_padding +
        measurement.fontBoundingBoxAscent -
        ex / 2 -
        badges.height / 2,
    );
    badges.close();
  }
  //  draw content
  context.drawImage(
    content,
    themed_configs.card_padding,
    themed_configs.card_padding +
      measurement.fontBoundingBoxAscent +
      measurement.fontBoundingBoxDescent +
      themed_configs.username_to_content,
  );
  content.close();
  //  draw avatar
  context.drawImage(
    avatar,
    used_canvas.width - avatar.width,
    (used_canvas.height - avatar.height) / 2,
  );
  avatar.close();

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
