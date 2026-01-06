import type { Configuring } from "@/components/MainView.vue";
import { useEmotes } from "@/stores/emotes";

type CharacterType =
  | "Space"
  | "Digit"
  | "CJK"
  | "Japanese"
  | "Latin"
  | "Hyphen"
  | "AvoidEnd"
  | "AvoidStart"
  | "Other";
function classify_character(character: string): CharacterType {
  if (/\p{White_Space}/u.test(character)) {
    return "Space";
  }
  if (/\p{Number}/u.test(character)) {
    return "Digit";
  }
  if (/\p{Script=Han}/u.test(character)) {
    return "CJK";
  }
  if (/\p{Script=Hiragana}|\p{Script=Katakana}/u.test(character)) {
    return "Japanese";
  }
  if (/[A-Za-z]/.test(character)) {
    return "Latin";
  }
  if (/[-\u2010\u2011\u2012\u2013\u2014\u2212\uFF0D]/.test(character)) {
    return "Hyphen";
  }
  const avoid_list_for_end = "([{<（〔［｛〈《「『【“‘";
  const avoid_list_for_start = ")]}>）〕］｝〉》」』】”’!,.:;?！，。：；？";
  if (avoid_list_for_end.includes(character)) {
    return "AvoidEnd";
  }
  if (avoid_list_for_start.includes(character)) {
    return "AvoidStart";
  }
  return "Other";
}
type Coordinate = { x: number; y: number };
type Shape = { width: number; above_baseline: number; below_baseline: number };
function draw_line(
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
const get_next_color = (() => {
  let state = false;
  return () => {
    const color = state ? "yellow" : "blue";
    state = !state;
    return color;
  };
})();
// a box in typesetting, which may contain a (sequence of) character(s), a horizontal blank of fixed length,
//  an image (emote) or several boxes. This structure may fold for no more than two levels
abstract class Box {
  abstract shape: Shape;
  abstract space_after: boolean; // if an optional space should be added after this box
  abstract treat_as_cjk: [boolean, boolean];
  append(other: Box): Box {
    const combined = new CombinationBox(this);
    return combined.append(other);
  }

  async render(
    context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    baseline_start: Coordinate,
    configuring: Configuring,
  ): Promise<void> {
    if (configuring.debug) {
      const color = get_next_color();
      draw_line(
        context,
        {
          x: baseline_start.x,
          y: baseline_start.y + this.shape.below_baseline,
        },
        {
          x: baseline_start.x,
          y: baseline_start.y - this.shape.above_baseline,
        },
        color,
      );
      draw_line(
        context,
        {
          x: baseline_start.x + this.shape.width,
          y: baseline_start.y + this.shape.below_baseline,
        },
        {
          x: baseline_start.x + this.shape.width,
          y: baseline_start.y - this.shape.above_baseline,
        },
        color,
      );
      draw_line(
        context,
        {
          x: baseline_start.x,
          y: baseline_start.y + this.shape.below_baseline,
        },
        {
          x: baseline_start.x + this.shape.width,
          y: baseline_start.y + this.shape.below_baseline,
        },
        color,
      );
      draw_line(
        context,
        {
          x: baseline_start.x,
          y: baseline_start.y - this.shape.above_baseline,
        },
        {
          x: baseline_start.x + this.shape.width,
          y: baseline_start.y - this.shape.above_baseline,
        },
        color,
      );
    }
  }

  abstract calculate_shape(
    context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    configuring: Configuring,
  ): void;
}

class CombinationBox extends Box {
  treat_as_cjk: [boolean, boolean] = [false, false];
  space_after = false;
  shape: Shape = { width: 0, above_baseline: 0, below_baseline: 0 };
  #elements: Box[];
  #spaces: number[];

  constructor(first_element: Box) {
    super();
    this.#elements = [first_element];
    this.#spaces = [];
    this.treat_as_cjk = [...first_element.treat_as_cjk];
    this.shape = first_element.shape;
    this.space_after = first_element.space_after;
  }

  async render(
    context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    baseline_start: Coordinate,
    configuring: Configuring,
    total_width = 0,
    no_space_adjustment = true,
  ) {
    const space_width =
      context.measureText("a a").width - context.measureText("aa").width;
    this.#preprocess_spaces();

    if (configuring.debug) {
      console.log(this.#elements, this.#spaces);
    }

    const extra_space =
      this.#elements.length === 0 || no_space_adjustment
        ? 0
        : (total_width - this.shape.width) / (this.#elements.length - 1);

    let current_x = baseline_start.x;
    for (const [index, item] of this.#elements.entries()) {
      if (configuring.debug) {
        draw_line(
          context,
          { x: current_x, y: baseline_start.y },
          {
            x: current_x + this.#spaces[index]! * space_width,
            y: baseline_start.y,
          },
          "green",
        );
      }
      current_x += this.#spaces[index]! * space_width;
      await item.render(
        context,
        { x: current_x, y: baseline_start.y },
        configuring,
      );
      current_x += item.shape.width + extra_space;
    }
  }

  calculate_shape(
    context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    configuring: Configuring,
  ) {
    const space_width =
      context.measureText("a a").width - context.measureText("aa").width;
    this.#preprocess_spaces();
    this.shape = { width: 0, above_baseline: 0, below_baseline: 0 };
    for (const [index, item] of this.#elements.entries()) {
      item.calculate_shape(context, configuring);
      this.shape.width += this.#spaces[index]! * space_width + item.shape.width;
      this.shape.above_baseline = Math.max(
        this.shape.above_baseline,
        item.shape.above_baseline,
      );
      this.shape.below_baseline = Math.max(
        this.shape.below_baseline,
        item.shape.below_baseline,
      );
    }
  }

  append(other: Box): Box {
    this.treat_as_cjk[1] = other.treat_as_cjk[1];
    this.space_after = other.space_after;
    this.#elements.push(other);
    return this;
  }

  #preprocess_spaces() {
    this.#spaces.splice(0);
    this.#spaces = [0];
    let space_if: boolean | null = null;
    for (const [index, item] of this.#elements.entries()) {
      if (space_if !== null) {
        this.#spaces.push(space_if === item.treat_as_cjk[0] ? 0.25 : 0);
      }
      space_if = !item.treat_as_cjk[1];
      if (item.space_after && index !== this.#elements.length - 1) {
        this.#spaces.push(1);
        space_if = null;
      }
    }
  }
}

class StringBox extends Box {
  treat_as_cjk: [boolean, boolean] = [false, false];
  space_after = false;
  shape: Shape = { width: 0, above_baseline: 0, below_baseline: 0 };
  #content: string;

  constructor(content: string) {
    super();
    this.#content = content;
  }

  async render(
    context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    baseline_start: Coordinate,
    configuring: Configuring,
  ) {
    super.render(context, baseline_start, configuring);
    context.fillText(this.#content, baseline_start.x, baseline_start.y);
  }

  calculate_shape(
    context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    _configuring: Configuring,
  ) {
    const measure = context.measureText(this.#content);
    this.shape = {
      width: measure.actualBoundingBoxRight,
      above_baseline: measure.fontBoundingBoxAscent,
      below_baseline: measure.fontBoundingBoxDescent,
    };
  }
}

class SpaceBox extends Box {
  space_after = false;
  treat_as_cjk: [boolean, boolean] = [false, false];
  shape: Shape = { width: 0, above_baseline: 0, below_baseline: 0 };
  #size: string;

  constructor(size: string) {
    super();
    const value = Number.parseFloat(size);
    if (Number.isNaN(value)) {
      this.#size = "0px";
      return;
    }
    this.#size = size.endsWith("em") ? `${value}em` : `${value}px`;
  }

  async render(
    context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    baseline_start: Coordinate,
    configuring: Configuring,
  ) {
    super.render(context, baseline_start, configuring);
  }

  calculate_shape(
    context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    _configuring: Configuring,
  ) {
    if (this.#size.endsWith("px")) {
      this.shape = {
        width: Number.parseFloat(this.#size),
        below_baseline: 0,
        above_baseline: 0,
      };
    } else {
      const measure = context.measureText("");
      this.shape = {
        width:
          Number.parseFloat(this.#size) *
          (measure.emHeightAscent + measure.emHeightDescent),
        below_baseline: 0,
        above_baseline: 0,
      };
    }
  }
}

class EmoteBox extends Box {
  space_after = false;
  treat_as_cjk: [boolean, boolean] = [false, false];
  shape: Shape = { width: 0, above_baseline: 0, below_baseline: 0 };
  #id: string;

  constructor(id: string) {
    super();
    this.#id = id;
  }

  async render(
    context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    baseline_start: Coordinate,
    configuring: Configuring,
  ) {
    super.render(context, baseline_start, configuring);
    const image = useEmotes().find_emote(this.#id)!;
    const image_bytes = await (await fetch(image)).blob();
    const bitmap = await window.createImageBitmap(image_bytes, {
      resizeHeight: this.shape.width,
      resizeWidth: this.shape.width,
      resizeQuality: "high",
    });
    context.drawImage(
      bitmap,
      baseline_start.x,
      baseline_start.y - this.shape.above_baseline,
    );
    bitmap.close();
  }

  calculate_shape(
    context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    configuring: Configuring,
  ) {
    const backup = context.textBaseline;
    context.textBaseline = "bottom";
    const descent = context.measureText("").alphabeticBaseline;
    context.textBaseline = backup;
    this.shape = {
      width: configuring.chat_emote_size,
      above_baseline: configuring.chat_emote_size - descent,
      below_baseline: descent,
    };
  }
}

function process_paragraph(paragraph: string): Box[] {
  const special_matcher = /^\[:(?<type>[^:]+):(?<parameter>[^:]+):\]/;

  const result: Box[] = [];
  let latin_sequence_start = -1;
  let latin_sequence_end = -1;
  let last_avoid_end = false;
  const commit_latin_sequence = () => {
    if (latin_sequence_start < latin_sequence_end) {
      const box = new StringBox(
        paragraph.slice(latin_sequence_start, latin_sequence_end),
      );
      if (last_avoid_end) {
        const last = result.pop()!;
        result.push(last.append(box));
        last_avoid_end = false;
      } else {
        result.push(box);
      }
      latin_sequence_start = -1;
      latin_sequence_end = -1;
    }
  };
  const build_box = (
    i: number,
  ): [
    (
      | { box: Box; action: "normal" | "append"; avoid_end: boolean }
      | { box: undefined; action: "normal" | "break"; avoid_end: undefined }
    ),
    number,
  ] => {
    if (paragraph[i] === "[") {
      const match_result = paragraph.slice(i).match(special_matcher);
      if (match_result !== null) {
        if (match_result.groups!.type === "emote") {
          return [
            {
              box: new EmoteBox(match_result.groups!.parameter!),
              action: "normal",
              avoid_end: false,
            },
            i + match_result[0].length - 1,
          ];
        } else if (match_result.groups!.type === "space") {
          return [
            {
              box: new SpaceBox(match_result.groups!.parameter!),
              action: "normal",
              avoid_end: false,
            },
            i + match_result[0].length - 1,
          ];
        }
      }
    }
    const tag = classify_character(paragraph[i]!);
    if (["Digit", "Latin", "Hyphen"].includes(tag)) {
      if (latin_sequence_start >= latin_sequence_end) {
        latin_sequence_start = i;
      }
      latin_sequence_end = i + 1;
      return [{ box: undefined, action: "normal", avoid_end: undefined }, i];
    } else if (tag === "Space" && result.at(-1) !== undefined) {
      result.at(-1)!.space_after = true;
      return [{ box: undefined, action: "break", avoid_end: undefined }, i];
    } else if (tag === "AvoidStart" && result.at(-1) !== undefined) {
      return [
        {
          box: new StringBox(paragraph[i]!),
          action: "append",
          avoid_end: false,
        },
        i,
      ];
    } else if (tag === "AvoidEnd") {
      return [
        {
          box: new StringBox(paragraph[i]!),
          action: "normal",
          avoid_end: true,
        },
        i,
      ];
    } else if (["CJK", "Japanese"].includes(tag)) {
      const box = new StringBox(paragraph[i]!);
      box.treat_as_cjk = [true, true];
      return [{ box, action: "normal", avoid_end: false }, i];
    } else {
      return [
        {
          box: new StringBox(paragraph[i]!),
          action: "normal",
          avoid_end: false,
        },
        i,
      ];
    }
  };
  for (let i = 0; i < paragraph.length; i++) {
    const [{ box, action, avoid_end }, update_index] = build_box(i);
    i = update_index;
    if (box !== undefined || (box === undefined && action === "break")) {
      commit_latin_sequence();
    }
    if (box !== undefined && (last_avoid_end || action === "append")) {
      const last = result.pop()!;
      result.push(last.append(box));
      last_avoid_end = false;
    } else if (box !== undefined) {
      result.push(box);
    }
    if (avoid_end !== undefined) {
      last_avoid_end = avoid_end;
    }
  }
  commit_latin_sequence();
  return result;
}
function knuth_plass(
  boxes: Box[],
  max_width: number,
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  configuring: Configuring,
): [CombinationBox[], number] {
  const best = Array.from<number>({ length: boxes.length + 1 }).fill(
    Number.POSITIVE_INFINITY,
  );
  best[0] = 0;
  const previous = Array.from<number>({ length: boxes.length + 1 }).fill(-1);

  for (let i = 0; i <= boxes.length; i++) {
    for (let j = 0; j < i; j++) {
      const helper = new CombinationBox(boxes[j]!);
      for (const box of boxes.slice(j + 1, i)) {
        helper.append(box);
      }
      helper.calculate_shape(context, configuring);
      const length = helper.shape.width;
      if (length > max_width) {
        continue;
      }
      const badness = i === boxes.length ? 0 : Math.pow(max_width - length, 3);
      const cost = best[j]! + badness;
      if (cost < best[i]!) {
        best[i] = cost;
        previous[i] = j;
      }
    }
  }

  const lines: CombinationBox[] = [];
  let index = boxes.length;
  while (index > 0) {
    const next = previous[index]!;
    const helper = new CombinationBox(boxes[next]!);
    for (const box of boxes.slice(next + 1, index)) {
      helper.append(box);
    }
    lines.push(helper);
    index = next;
  }
  lines.reverse();
  return [lines, best[boxes.length]!];
}

export async function render_text(
  paragraph: string,
  configuring: Configuring,
  width: number,
  canvas?: HTMLCanvasElement | OffscreenCanvas,
): Promise<{ image: Blob; canvas: HTMLCanvasElement | OffscreenCanvas }> {
  const used_canvas = canvas ?? new OffscreenCanvas(0, 0);
  used_canvas.width = width;
  used_canvas.height = 1; // we do not really know what the height should be for now
  const context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D =
    used_canvas.getContext("2d")! as any;
  context.font = `${configuring.chat_font_size}px "HarmonyOS Sans SC"`;
  const boxes = process_paragraph(paragraph);
  const [lines, badness] = knuth_plass(boxes, width, context, configuring);
  if (configuring.debug) {
    console.log(lines, badness);
  }
  let height = 0;
  for (const line of lines) {
    line.calculate_shape(context, configuring);
    height += line.shape.above_baseline + line.shape.below_baseline;
  }

  used_canvas.height = height;
  context.font = `${configuring.chat_font_size}px "HarmonyOS Sans SC"`;
  context.strokeStyle = "black";
  context.fillStyle = "black";
  context.textRendering = "optimizeLegibility";

  if (configuring.debug) {
    draw_line(context, { x: 0, y: 0 }, { x: 0, y: height });
    draw_line(context, { x: width, y: 0 }, { x: width, y: height });
  }

  height = 0;
  for (const [index, line] of lines.entries()) {
    height += line.shape.above_baseline;
    await line.render(
      context,
      { x: 0, y: height },
      configuring,
      width,
      index === lines.length - 1,
    );
    height += line.shape.below_baseline;
  }
  const build_image =
    used_canvas instanceof OffscreenCanvas
      ? used_canvas.convertToBlob({ type: "image/png" })
      : new Promise<Blob>((resolve, _reject) => {
          used_canvas.toBlob((blob) => resolve(blob!), "image/png");
        });
  return { image: await build_image, canvas: used_canvas };
}
