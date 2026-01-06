import type { ChatConfig } from "@/components/Chat.vue";
import type { Configuring } from "@/components/MainView.vue";
import { useEmotes } from "@/stores/emotes";
import { render_text } from "./text-rendering";

async function render_username_line(
  chat: ChatConfig,
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  configuring: Configuring,
): Promise<Blob> {
  // measure size of the username
  const measure = context.measureText(chat.username);
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
    if (chat.logos.admiral) {
      result += 1;
    }
    if (chat.logos.captain) {
      result += 1;
    }
    if (chat.logos.governor) {
      result += 1;
    }
    if (chat.logos.manager) {
      result += 1;
    }
    return result;
  })();
  const [character_top, logo_top] = (() => {
    if (logo_count > 0) {
      const difference =
        logo_align_line_offset - configuring.chat_logo_size / 2;
      if (difference < 0) {
        return [-difference, 0];
      }
      return [0, difference];
    }
    return [0, -configuring.chat_logo_size];
  })();
  const total_height = Math.max(
    character_top + pure_character_height,
    logo_top + configuring.chat_logo_size,
  );
  const total_width =
    username_width + (8 + configuring.chat_logo_size) * logo_count;
  const baseline_y = character_top + padding + measure.fontBoundingBoxAscent;

  // update canvas
  const font_backup = context.font;
  context.canvas.height = total_height;
  context.canvas.width = total_width;
  context.font = font_backup;
  context.textRendering = "optimizeLegibility";
  context.fillStyle = chat.name_color;
  context.strokeStyle = chat.name_color;

  // render it
  context.fillText(chat.username, x_adjustment, baseline_y);
  if (logo_count > 0) {
    let current_x = x_adjustment + username_width;
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
      current_x += 8;
      const image = emote.find_emote(id)!;
      const image_bytes = await (await fetch(image)).blob();
      const bitmap = await window.createImageBitmap(image_bytes, {
        resizeHeight: configuring.chat_logo_size,
        resizeWidth: configuring.chat_logo_size,
        resizeQuality: "high",
      });
      context.drawImage(bitmap, current_x, logo_top);
      current_x += configuring.chat_logo_size;
      bitmap.close();
    }
  }
  const canvas = context.canvas;
  const build_image =
    canvas instanceof OffscreenCanvas
      ? canvas.convertToBlob({ type: "image/png" })
      : new Promise<Blob>((resolve, _reject) => {
          canvas.toBlob((blob) => resolve(blob!), "image/png");
        });
  return await build_image;
}

async function prepare_avatar(
  chat: ChatConfig,
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  configuring: Configuring,
): Promise<Blob> {
  const avatar_bitmap = await window.createImageBitmap(
    await (await fetch(chat.avatar)).blob(),
    {
      resizeHeight: configuring.chat_avatar_size,
      resizeWidth: configuring.chat_avatar_size,
      resizeQuality: "high",
    },
  );
  context.canvas.height = configuring.chat_avatar_size;
  context.canvas.width = configuring.chat_avatar_size;
  context.beginPath();
  context.arc(
    configuring.chat_avatar_size / 2,
    configuring.chat_avatar_size / 2,
    configuring.chat_avatar_size / 2,
    0,
    Math.PI * 2,
    true,
  );
  context.clip();
  context.drawImage(avatar_bitmap, 0, 0);

  // context.beginPath();
  // context.rect(
  //   0,
  //   0,
  //   configuring.chat_avatar_size,
  //   configuring.chat_avatar_size,
  // );
  // context.fillStyle = "blue";
  // context.fillRect(
  //   0,
  //   0,
  //   configuring.chat_avatar_size,
  //   configuring.chat_avatar_size,
  // );
  const canvas = context.canvas;
  const build_image =
    canvas instanceof OffscreenCanvas
      ? canvas.convertToBlob({ type: "image/png" })
      : new Promise<Blob>((resolve, _reject) => {
          canvas.toBlob((blob) => resolve(blob!), "image/png");
        });
  return await build_image;
}

export async function render_chat(
  chat: ChatConfig,
  configuring: Configuring,
  canvas?: HTMLCanvasElement | OffscreenCanvas,
): Promise<{ image: Blob; canvas: HTMLCanvasElement | OffscreenCanvas }> {
  // prepare canvas
  const used_canvas = canvas ?? new OffscreenCanvas(0, 0);
  const context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D =
    used_canvas.getContext("2d")! as any;
  // calculate the width available for the content
  const bubble_width =
    configuring.scene_width -
    configuring.chat_avatar_size -
    configuring.avatar_gap;
  const content_width = bubble_width - configuring.bubble_padding * 2;
  // render the content first to find out the height we need for this chat
  const { image: content } = await render_text(
    chat.content,
    configuring,
    content_width,
    used_canvas,
  );
  const content_height = used_canvas.height;
  const bubble_height = content_height + configuring.bubble_padding * 2;

  // render username
  const username = await render_username_line(chat, context, configuring);
  const username_height = used_canvas.height;

  // put everything together
  //  calculate the full size of this chat
  const full_width = configuring.scene_width;
  const full_height = Math.max(
    configuring.chat_avatar_size,
    username_height + 12 + bubble_height,
  );
  const font_backup = context.font;

  //  prepare components
  const content_bitmap = await window.createImageBitmap(content);
  const username_bitmap = await window.createImageBitmap(username);
  const avatar_bitmap = await window.createImageBitmap(
    await prepare_avatar(chat, context, configuring),
  );

  context.canvas.height = full_height;
  context.canvas.width = full_width;
  context.font = font_backup;
  context.textRendering = "optimizeLegibility";

  //  place username
  context.drawImage(
    username_bitmap,
    configuring.chat_avatar_size + configuring.avatar_gap,
    0,
  );

  //  draw the bubble
  const bubble_top_left = [
    configuring.chat_avatar_size + configuring.avatar_gap,
    username_height + 12,
  ] as [number, number];
  const radius = configuring.bubble_radius;
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
    Math.PI * configuring.start_angle,
  );
  const [end] = inward_angle_to_outward(Math.PI * configuring.end_angle);
  context.fillStyle = chat.bubble_color;
  context.beginPath();
  context.moveTo(bubble_top_left[0], bubble_top_left[1]);
  context.lineTo(
    bubble_top_left[0] + start_point[0],
    bubble_top_left[1] + start_point[1],
  );
  context.arc(
    bubble_top_left[0] + radius,
    bubble_top_left[1] + radius,
    radius,
    start,
    end,
    true,
  );
  context.lineTo(bubble_top_left[0], bubble_top_left[1]);
  context.closePath();
  context.fill();

  context.fillRect(
    bubble_top_left[0] + radius,
    bubble_top_left[1],
    bubble_width - radius * 2,
    bubble_height,
  );
  context.fillRect(
    bubble_top_left[0],
    bubble_top_left[1] + radius,
    bubble_width,
    bubble_height - radius * 2,
  );

  context.beginPath();
  context.arc(
    bubble_top_left[0] + radius,
    bubble_top_left[1] + radius,
    radius,
    0,
    Math.PI * 2,
    true,
  );
  context.fill();
  context.beginPath();
  context.arc(
    bubble_top_left[0] + bubble_width - radius,
    bubble_top_left[1] + radius,
    radius,
    0,
    Math.PI * 2,
    true,
  );
  context.fill();
  context.beginPath();
  context.arc(
    bubble_top_left[0] + radius,
    bubble_top_left[1] + bubble_height - radius,
    radius,
    0,
    Math.PI * 2,
    true,
  );
  context.fill();
  context.beginPath();
  context.arc(
    bubble_top_left[0] + bubble_width - radius,
    bubble_top_left[1] + bubble_height - radius,
    radius,
    0,
    Math.PI * 2,
    true,
  );
  context.fill();

  //  place content
  context.drawImage(
    content_bitmap,
    bubble_top_left[0] + configuring.bubble_padding,
    bubble_top_left[1] + configuring.bubble_padding,
  );

  //  place avatar
  context.drawImage(avatar_bitmap, 0, 0);

  const build_image =
    used_canvas instanceof OffscreenCanvas
      ? used_canvas.convertToBlob({ type: "image/png" })
      : new Promise<Blob>((resolve, _reject) => {
          used_canvas.toBlob((blob) => resolve(blob!), "image/png");
        });
  return { image: await build_image, canvas: used_canvas };
}
