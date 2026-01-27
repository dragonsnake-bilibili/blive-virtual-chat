// Utility for typesetting paragraphs
// use prepare_text_rendering to get a render which may called for multiple times, rendering the same content
// use render_text to render immediately
//
// Handling of different levels of spacing
// This list represents the order of calculation
//  1. fixed-length spaces ([:space:...:]) are special boxes. They can be placed at the beginning or ending of
//     lines and no auto-space or space padding will be added around it. This is handled by SpaceBoxes.
//  2. spaces within the paragraph will be removed: no box will be created for them, but a mark will be added
//     to the boxes before these spaces, indicating that if such boxes has a successor on the same line, a
//     space will be added between them. This means that multiple continual spaces will be treated as if there
//     was only a single one, and leading spaces of a paragraph or spaces that happened to be arranged at the
//     end of a line will simply disappear. This is handled by CombinationBoxes.
//  3. auto-space will be added between adjacent boxes on the same line with different auto space class. There
//     are two exception cases that no auto-space will be apply: if one of which has undefined as its class,
//     or a space that came from one directly in the paragraph has already been inserted between them. This is
//     handled by CombinationBoxes.
//  4. space padding will try to make sure that width of each affected box be exactly 1em. If the target width
//     would be exceeded in such case, the width padded is reduced. This is handled by CombinationBoxes.
//  5. finally, if requested, space is added evenly between boxes to make the boundaries of the leftmost and
//     the rightmost boxes align with the line boundary decided by the target line width. This is handled by
//     CombinationBoxes.
//
// About debugging mode:
//  1. calculated left/right boundary of the whole paragraph is visualized in #c64dbe
//  2. blank created due to justification is visualized in #00ffff on baseline
//  3. blank created due to a space in the paragraph is visualized in #ff0000 on baseline
//  4. blank created due to auto-space is visualized in #00ff00 on baseline
//  5. boundary of boxes (except the combination box) are visualized in #ffff00 or #0000ff alternatingly
//  6. blank created due to space padding is visualized in #ff00ff on baseline
import type { Configuring } from "@/components/MainView.vue";
import { useDialog } from "@/stores/dialog";
import { useEmotes } from "@/stores/emotes";
import {
  canvas_to_blob,
  CanvasDrawingState,
  type Coordinate,
  draw_line,
  type Shape,
  type Size,
} from "./rendering";

type AutoSpaceClass = "CJK" | "non-CJK";
type SpacePadding = {
  before: { ratio: number; reducible_to?: number };
  after: { ratio: number; reducible_to?: number };
};
type CharacterProperty =
  | {
      space: true;
    }
  | {
      space: false;
      latin_cluster: boolean;
      // if this character should not be placed at the start or end of a line
      avoid: {
        start: boolean;
        end: boolean;
      };
      // if two adjacent characters have different auto_space_class (which must not be undefined), space will
      //  be inserted automatically between them, whose width is one fourth of a normal space
      auto_space_class?: AutoSpaceClass;
      // if optional space can be padded before or after the character when rendering
      //  this enlarges the bounding box of the character box up to 1em
      //  note that it is always the maximum width that will be padded: the only reason that the padded width
      //   is reduced is that the width of the full line must be limited within the maximum line width.
      space_padding: SpacePadding;
    };
function classify_character(character: string): CharacterProperty {
  if (/\p{White_Space}/u.test(character)) {
    return { space: true };
  }
  if (/\p{Number}/u.test(character)) {
    return {
      space: false,
      latin_cluster: true,
      avoid: { start: false, end: false },
      auto_space_class: "non-CJK",
      space_padding: { before: { ratio: 0 }, after: { ratio: 0 } },
    };
  }
  if (/\p{Script=Han}/u.test(character)) {
    return {
      space: false,
      latin_cluster: false,
      avoid: { start: false, end: false },
      auto_space_class: "CJK",
      space_padding: { before: { ratio: 0.5 }, after: { ratio: 0.5 } },
    };
  }
  if (/\p{Script=Hiragana}|\p{Script=Katakana}/u.test(character)) {
    return {
      space: false,
      latin_cluster: false,
      avoid: { start: false, end: false },
      auto_space_class: "CJK",
      space_padding: { before: { ratio: 0.5 }, after: { ratio: 0.5 } },
    };
  }
  if (/[A-Za-z]/.test(character)) {
    return {
      space: false,
      latin_cluster: true,
      avoid: { start: false, end: false },
      auto_space_class: "non-CJK",
      space_padding: { before: { ratio: 0 }, after: { ratio: 0 } },
    };
  }
  if (/[-\u2010\u2011\u2012\u2013\u2014\u2212\uFF0D]/.test(character)) {
    return {
      space: false,
      latin_cluster: true,
      avoid: { start: false, end: false },
      auto_space_class: "non-CJK",
      space_padding: { before: { ratio: 0 }, after: { ratio: 0 } },
    };
  }
  if ("([{<".includes(character)) {
    return {
      space: false,
      latin_cluster: false,
      avoid: { start: false, end: true },
      auto_space_class: "non-CJK",
      space_padding: { before: { ratio: 0 }, after: { ratio: 0 } },
    };
  }
  if ("（〔［｛〈《「『【“‘".includes(character)) {
    return {
      space: false,
      latin_cluster: false,
      avoid: { start: false, end: true },
      space_padding: {
        before: { ratio: 0.8, reducible_to: 0.4 },
        after: { ratio: 0.2 },
      },
    };
  }
  if (")]}>!,.:;?".includes(character)) {
    return {
      space: false,
      latin_cluster: false,
      avoid: { start: true, end: false },
      auto_space_class: "non-CJK",
      space_padding: { before: { ratio: 0 }, after: { ratio: 0 } },
    };
  }
  if ("）〕］｝〉》」』】”’！，。：；？".includes(character)) {
    return {
      space: false,
      latin_cluster: false,
      avoid: { start: true, end: false },
      space_padding: {
        before: { ratio: 0.2 },
        after: { ratio: 0.8, reducible_to: 0.4 },
      },
    };
  }
  return {
    space: false,
    latin_cluster: false,
    avoid: { start: false, end: false },
    space_padding: { before: { ratio: 0 }, after: { ratio: 0 } },
  };
}
const get_next_color = (() => {
  let state = false;
  return () => {
    const color = state ? "yellow" : "blue";
    state = !state;
    return color;
  };
})();

type CommonMeasurements = {
  em: number;
  ex: number;
  space: number;
  font_ascent: number;
  font_descent: number;
  maximum_line_width: number;
  target_line_width: number;
};
function measure(
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  configuring: UsedConfigurations,
): CommonMeasurements {
  const space_width =
    context.measureText("a a").width - context.measureText("aa").width;
  const x_measurement = context.measureText("x");
  return {
    em: configuring.chat_font_size,
    ex:
      x_measurement.actualBoundingBoxAscent +
      x_measurement.actualBoundingBoxDescent,
    space: space_width,
    font_ascent: x_measurement.fontBoundingBoxAscent,
    font_descent: x_measurement.fontBoundingBoxDescent,
    maximum_line_width: 0,
    target_line_width: 0,
  };
}

type TextRenderingStates = {
  operations: { fill: boolean; stroke: boolean };
  alignment: "left" | "center" | "right";
  justification: {
    normal: boolean;
    last: number;
  };
};
// a box in typesetting, which may contain a (sequence of) character(s), a horizontal blank of fixed length,
//  an image (emote) or several boxes. This structure may fold for no more than two levels
abstract class Box {
  abstract shape: Shape;
  abstract space_after: boolean; // if an optional space should be added after this box

  abstract auto_space_class: [
    AutoSpaceClass | undefined,
    AutoSpaceClass | undefined,
  ];

  abstract space_padding: SpacePadding;

  append(other: Box): Box {
    const combined = new CombinationBox(this);
    return combined.append(other);
  }

  render(
    context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    baseline_start: Coordinate,
    configuring: UsedConfigurations,
    _state: TextRenderingStates,
    _common_measurements: CommonMeasurements,
  ): void {
    if (configuring.debug) {
      // [visualize] boundary of boxes
      const color = get_next_color();
      const backup = context.strokeStyle;
      context.strokeStyle = color;
      context.strokeRect(
        baseline_start.x,
        baseline_start.y - this.shape.above_baseline,
        this.shape.width,
        this.shape.above_baseline + this.shape.below_baseline,
      );
      context.strokeStyle = backup;
    }
  }

  abstract calculate_shape(
    context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    configuring: UsedConfigurations,
    common_measurements: CommonMeasurements,
  ): void;

  abstract prepare_resources(resources: {
    images: Map<string, ImageBitmap>;
  }): Promise<void>;
}

class CombinationBox extends Box {
  shape: Shape = { width: 0, above_baseline: 0, below_baseline: 0 };
  space_after = false;

  auto_space_class: [AutoSpaceClass | undefined, AutoSpaceClass | undefined] = [
    undefined,
    undefined,
  ];

  space_padding: SpacePadding = {
    before: { ratio: 0 },
    after: { ratio: 0 },
  };

  #elements: Box[];
  #spaces: number[];
  #reduce_ratio: number | undefined;

  #last_combination_box: CombinationBox | undefined;

  constructor(first_element: Box) {
    super();
    this.#elements = [];
    this.#spaces = [];

    this.shape = first_element.shape;
    this.space_after = first_element.space_after;
    this.auto_space_class = [...first_element.auto_space_class];

    this.#append_implement(first_element);
  }

  render(
    context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    baseline_start: Coordinate,
    configuring: UsedConfigurations,
    state: TextRenderingStates,
    common_measurements: CommonMeasurements,
    extras?: {
      is_toplevel: boolean;
      is_last_line: boolean;
    },
  ) {
    if (configuring.debug) {
      console.log(this.#elements, this.#spaces);
    }

    const justification_space = (() => {
      if (this.#elements.length === 1) {
        return 0;
      }
      if (!extras?.is_toplevel) {
        return 0;
      }
      if (state.alignment === "center") {
        return 0;
      }
      const target_width = common_measurements.target_line_width;
      if (
        extras.is_last_line &&
        this.shape.width < target_width * state.justification.last
      ) {
        return 0;
      }
      if (!extras.is_last_line && !state.justification.normal) {
        return 0;
      }
      return (target_width - this.shape.width) / (this.#elements.length - 1);
    })();
    const final_width =
      this.shape.width + (this.#elements.length - 1) * justification_space;

    let current_x = (() => {
      if (!extras?.is_toplevel) {
        return baseline_start.x;
      }
      switch (state.alignment) {
        case "left": {
          return baseline_start.x;
        }
        case "center": {
          return (
            baseline_start.x +
            (common_measurements.target_line_width - final_width) / 2
          );
        }
        case "right": {
          return (
            baseline_start.x +
            common_measurements.target_line_width -
            final_width
          );
        }
      }
    })();
    const reduce_ratio = this.#reduce_ratio ?? 1;
    for (const [index, item] of this.#elements.entries()) {
      if (configuring.debug && this.#spaces[index]! > 0) {
        draw_line(
          context,
          { x: current_x, y: baseline_start.y },
          {
            x: current_x + this.#spaces[index]! * common_measurements.space,
            y: baseline_start.y,
          },
          this.#spaces[index]! === 1 ? "red" : "green",
        );
      }
      current_x += this.#spaces[index]! * common_measurements.space;
      const padding_width: { before: number; after: number } = (() => {
        const full_width = Math.max(
          0,
          common_measurements.em - item.shape.width,
        );
        const minimum_ratio_before =
          item.space_padding.before.reducible_to ??
          item.space_padding.before.ratio;
        const minimum_ratio_after =
          item.space_padding.after.reducible_to ??
          item.space_padding.after.ratio;
        const variable_ratio_before =
          item.space_padding.before.ratio - minimum_ratio_before;
        const variable_ratio_after =
          item.space_padding.after.ratio - minimum_ratio_after;
        return {
          before:
            full_width *
            (minimum_ratio_before + variable_ratio_before * reduce_ratio),
          after:
            full_width *
            (minimum_ratio_after + variable_ratio_after * reduce_ratio),
        };
      })();
      if (padding_width.before > 0 && index !== 0) {
        if (configuring.debug) {
          draw_line(
            context,
            { x: current_x, y: baseline_start.y },
            {
              x: current_x + padding_width.before,
              y: baseline_start.y,
            },
            "#ff00ff",
          );
        }
        current_x += padding_width.before;
      }
      item.render(
        context,
        { x: current_x, y: baseline_start.y },
        configuring,
        state,
        common_measurements,
      );
      current_x += item.shape.width;
      if (padding_width.after > 0 && index !== this.#elements.length - 1) {
        if (configuring.debug) {
          draw_line(
            context,
            { x: current_x, y: baseline_start.y },
            {
              x: current_x + padding_width.after,
              y: baseline_start.y,
            },
            "#ff00ff",
          );
        }
        current_x += padding_width.after;
      }
      if (configuring.debug && index !== this.#elements.length - 1) {
        draw_line(
          context,
          { x: current_x, y: baseline_start.y },
          {
            x: current_x + justification_space,
            y: baseline_start.y,
          },
          "#00ffff",
        );
      }
      current_x += justification_space;
    }
  }

  calculate_shape(
    context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    configuring: UsedConfigurations,
    common_measurements: CommonMeasurements,
  ) {
    this.#preprocess_spaces();
    this.shape = { width: 0, above_baseline: 0, below_baseline: 0 };
    let reducible_padding = 0;
    for (const [index, item] of this.#elements.entries()) {
      item.calculate_shape(context, configuring, common_measurements);
      this.shape.width += this.#spaces[index]! * common_measurements.space;
      const padding = Math.max(0, common_measurements.em - item.shape.width);
      if (index !== 0) {
        const minimum_ratio =
          item.space_padding.before.reducible_to ??
          item.space_padding.before.ratio;
        this.shape.width += padding * minimum_ratio;
        reducible_padding +=
          padding * (item.space_padding.before.ratio - minimum_ratio);
      }
      if (index !== this.#elements.length - 1) {
        const minimum_ratio =
          item.space_padding.after.reducible_to ??
          item.space_padding.after.ratio;
        this.shape.width += padding * minimum_ratio;
        reducible_padding +=
          padding * (item.space_padding.after.ratio - minimum_ratio);
      }
      this.shape.width += item.shape.width;
      this.shape.above_baseline = Math.max(
        this.shape.above_baseline,
        item.shape.above_baseline,
      );
      this.shape.below_baseline = Math.max(
        this.shape.below_baseline,
        item.shape.below_baseline,
      );
    }
    this.shape.width += reducible_padding;
    if (this.shape.width > common_measurements.maximum_line_width) {
      const difference =
        this.shape.width - common_measurements.maximum_line_width;
      if (difference <= reducible_padding) {
        this.shape.width = common_measurements.maximum_line_width;
        this.#reduce_ratio =
          (reducible_padding - difference) / reducible_padding;
      } else {
        this.shape.width -= reducible_padding;
        this.#reduce_ratio = 0;
      }
    } else {
      this.#reduce_ratio = undefined;
    }
  }

  async prepare_resources(resources: {
    images: Map<string, ImageBitmap>;
  }): Promise<void> {
    for (const element of this.#elements) {
      await element.prepare_resources(resources);
    }
  }

  append(other: Box): Box {
    this.auto_space_class[1] = other.auto_space_class[1];
    this.space_after = other.space_after;
    this.#append_implement(other);
    return this;
  }

  pop(): Box | undefined {
    if (this.#last_combination_box === undefined) {
      return this.#elements.pop();
    }
    const last_box = this.#last_combination_box;
    this.#last_combination_box = undefined;
    this.#elements = this.#elements.slice(0, -last_box.#elements.length);
    return last_box;
  }

  // flatten the content
  #append_implement(other: Box) {
    if (other instanceof CombinationBox) {
      this.#elements.push(...other.#elements);
      this.#last_combination_box = other;
    } else {
      this.#elements.push(other);
      this.#last_combination_box = undefined;
    }
  }

  // handle spaces in the paragraph and auto-spaces
  #preprocess_spaces() {
    this.#spaces.splice(0);
    let last_space_class: AutoSpaceClass | undefined = undefined;
    let skip = false; // skip next push since a space is already inserted
    for (const [index, item] of this.#elements.entries()) {
      if (!skip) {
        if (
          last_space_class === undefined ||
          item.auto_space_class[0] === undefined ||
          last_space_class === item.auto_space_class[0]
        ) {
          this.#spaces.push(0);
        } else {
          this.#spaces.push(0.25);
        }
      }
      skip = false;
      last_space_class = item.auto_space_class[1];
      if (item.space_after && index !== this.#elements.length - 1) {
        this.#spaces.push(1);
        skip = true;
      }
    }
  }
}

class StringBox extends Box {
  shape: Shape = { width: 0, above_baseline: 0, below_baseline: 0 };
  space_after = false;

  auto_space_class: [AutoSpaceClass | undefined, AutoSpaceClass | undefined] = [
    undefined,
    undefined,
  ];

  space_padding: SpacePadding = {
    before: { ratio: 0 },
    after: { ratio: 0 },
  };

  #content: string;
  #start_adjustment: number | undefined;

  constructor(content: string) {
    super();
    this.#content = content;
  }

  render(
    context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    baseline_start: Coordinate,
    configuring: UsedConfigurations,
    state: TextRenderingStates,
    common_measurements: CommonMeasurements,
  ) {
    super.render(
      context,
      baseline_start,
      configuring,
      state,
      common_measurements,
    );
    const start_adjustment = this.#start_adjustment ?? 0;
    if (state.operations.fill) {
      context.fillText(
        this.#content,
        baseline_start.x + start_adjustment,
        baseline_start.y,
      );
    }
    if (state.operations.stroke) {
      context.strokeText(
        this.#content,
        baseline_start.x + start_adjustment,
        baseline_start.y,
      );
    }
  }

  calculate_shape(
    context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    _configuring: UsedConfigurations,
  ) {
    const measure = context.measureText(this.#content);
    if (
      this.space_padding.before.ratio > 0 ||
      this.space_padding.after.ratio > 0
    ) {
      this.#start_adjustment = measure.actualBoundingBoxLeft;
      this.shape = {
        width: measure.actualBoundingBoxRight + measure.actualBoundingBoxLeft,
        above_baseline: measure.fontBoundingBoxAscent,
        below_baseline: measure.fontBoundingBoxDescent,
      };
    } else {
      this.shape = {
        width: measure.actualBoundingBoxRight,
        above_baseline: measure.fontBoundingBoxAscent,
        below_baseline: measure.fontBoundingBoxDescent,
      };
    }
  }

  async prepare_resources(_resources: {
    images: Map<string, ImageBitmap>;
  }): Promise<void> {}
}

class SpaceBox extends Box {
  shape: Shape = { width: 0, above_baseline: 0, below_baseline: 0 };
  space_after = false;

  auto_space_class: [AutoSpaceClass | undefined, AutoSpaceClass | undefined] = [
    undefined,
    undefined,
  ];

  space_padding: SpacePadding = {
    before: { ratio: 0 },
    after: { ratio: 0 },
  };

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

  render(
    context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    baseline_start: Coordinate,
    configuring: UsedConfigurations,
    state: TextRenderingStates,
    common_measurements: CommonMeasurements,
  ) {
    super.render(
      context,
      baseline_start,
      configuring,
      state,
      common_measurements,
    );
  }

  calculate_shape(
    context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    _configuring: UsedConfigurations,
    common_measurements: CommonMeasurements,
  ) {
    const value = Number.parseFloat(this.#size);
    this.shape = {
      width: this.#size.endsWith("px") ? value : value * common_measurements.em,
      below_baseline: 0,
      above_baseline: 0,
    };
  }

  async prepare_resources(_resources: {
    images: Map<string, ImageBitmap>;
  }): Promise<void> {}
}

class EmoteBox extends Box {
  shape: Shape = { width: 0, above_baseline: 0, below_baseline: 0 };
  space_after = false;

  auto_space_class: [AutoSpaceClass | undefined, AutoSpaceClass | undefined] = [
    undefined,
    undefined,
  ];

  space_padding: SpacePadding = {
    before: { ratio: 0 },
    after: { ratio: 0 },
  };

  #id: string;
  #image: ImageBitmap | undefined = undefined;

  constructor(id: string) {
    super();
    this.#id = id;
  }

  render(
    context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    baseline_start: Coordinate,
    configuring: UsedConfigurations,
    state: TextRenderingStates,
    common_measurements: CommonMeasurements,
  ) {
    super.render(
      context,
      baseline_start,
      configuring,
      state,
      common_measurements,
    );
    context.drawImage(
      this.#image!,
      baseline_start.x,
      baseline_start.y - this.shape.above_baseline,
    );
  }

  calculate_shape(
    context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    configuring: UsedConfigurations,
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

  async prepare_resources(resources: {
    images: Map<string, ImageBitmap>;
  }): Promise<void> {
    const { images } = resources;
    const key = `emote://${this.#id}@${this.shape.width}`;
    const cached = images.get(key);
    if (cached !== undefined) {
      this.#image = cached;
      return;
    }
    const image = useEmotes().find_emote(this.#id)!;
    const image_bytes = await (await fetch(image)).blob();
    const bitmap = await window.createImageBitmap(image_bytes, {
      resizeHeight: this.shape.width,
      resizeWidth: this.shape.width,
      resizeQuality: "high",
    });
    this.#image = bitmap;
    images.set(key, bitmap);
  }
}

class InlineImageBox extends Box {
  shape: Shape = { width: 0, above_baseline: 0, below_baseline: 0 };
  space_after = false;

  auto_space_class: [AutoSpaceClass | undefined, AutoSpaceClass | undefined] = [
    undefined,
    undefined,
  ];

  space_padding: SpacePadding = {
    before: { ratio: 0 },
    after: { ratio: 0 },
  };

  #url: string;
  #size: Size;
  #baseline: InlineImageSpecification["baseline"];
  #offset: number;
  #image: ImageBitmap | undefined = undefined;

  constructor(specification: InlineImageSpecification) {
    super();
    this.auto_space_class = [
      specification.auto_space_class,
      specification.auto_space_class,
    ];
    this.#url = specification.image;
    this.#size = specification.size;
    this.#baseline = specification.baseline;
    this.#offset = specification.reference_line_offset;
  }

  render(
    context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    baseline_start: Coordinate,
    configuring: UsedConfigurations,
    state: TextRenderingStates,
    common_measurements: CommonMeasurements,
  ) {
    const top_left_y = ((): number => {
      if (this.shape.above_baseline > 0) {
        return baseline_start.y - this.shape.above_baseline;
      }
      return baseline_start.y + this.shape.below_baseline - this.#size.height;
    })();
    context.drawImage(this.#image!, baseline_start.x, top_left_y);
    super.render(
      context,
      baseline_start,
      configuring,
      state,
      common_measurements,
    );
    if (configuring.debug) {
      draw_line(
        context,
        { x: baseline_start.x, y: top_left_y + this.#offset },
        {
          x: baseline_start.x + this.#size.width,
          y: top_left_y + this.#offset,
        },
      );
    }
  }

  calculate_shape(
    context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    configuring: UsedConfigurations,
    common_measurements: CommonMeasurements,
  ) {
    const basic_below = this.#size.height - this.#offset;
    const basic_above = this.#offset;
    const baseline_shift = (() => {
      if (typeof this.#baseline === "number") {
        return this.#baseline;
      }
      switch (this.#baseline) {
        case "bottom": {
          return -common_measurements.font_descent;
        }
        case "default": {
          return 0;
        }
        case "middle": {
          return common_measurements.ex / 2;
        }
        case "sub": {
          return -configuring.chat_font_size / 5;
        }
        case "super": {
          return configuring.chat_font_size / 3;
        }
        case "top": {
          return common_measurements.font_ascent;
        }
      }
    })();

    this.shape = {
      width: this.#size.width,
      above_baseline: Math.max(0, basic_above + baseline_shift),
      below_baseline: Math.max(0, basic_below - baseline_shift),
    };
  }

  async prepare_resources(resources: {
    images: Map<string, ImageBitmap>;
  }): Promise<void> {
    const { images } = resources;
    const key = `image://${this.#url}@${this.#size.width}x${this.#size.height}`;
    const cached = images.get(key);
    if (cached !== undefined) {
      this.#image = cached;
      return;
    }
    const image_bytes = await (await fetch(this.#url)).blob();
    const bitmap = await window.createImageBitmap(image_bytes, {
      resizeHeight: this.#size.height,
      resizeWidth: this.#size.width,
      resizeQuality: "high",
    });
    this.#image = bitmap;
    images.set(key, bitmap);
  }
}

// this box renders nothing but changes the rendering color
class ColorDummyBox extends Box {
  shape: Shape = { width: 0, above_baseline: 0, below_baseline: 0 };
  space_after = false;

  auto_space_class: [AutoSpaceClass | undefined, AutoSpaceClass | undefined] = [
    undefined,
    undefined,
  ];

  space_padding: SpacePadding = {
    before: { ratio: 0 },
    after: { ratio: 0 },
  };

  #color: string;

  constructor(color: string) {
    super();
    this.#color = color;
  }

  render(
    context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    _baseline_start: Coordinate,
    _configuring: UsedConfigurations,
  ) {
    context.fillStyle = this.#color;
  }

  calculate_shape(
    _context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    _configuring: UsedConfigurations,
  ): void {}

  async prepare_resources(_resources: {
    images: Map<string, ImageBitmap>;
  }): Promise<void> {}
}

// convert paragraph (string) into boxes
function process_paragraph(paragraph: string): Box[] {
  const special_matcher = /^\[:(?<type>[^:]+):(?<parameter>.+?):\]/;

  const result: Box[] = [];
  let latin_sequence_start = -1;
  let latin_sequence_end = -1;
  let last_avoid_end = false;
  const commit_latin_sequence = () => {
    if (latin_sequence_start < latin_sequence_end) {
      const box = new StringBox(
        paragraph.slice(latin_sequence_start, latin_sequence_end),
      );
      box.auto_space_class = ["non-CJK", "non-CJK"];
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
        } else if (match_result.groups!.type === "inline-image") {
          const specification = JSON.parse(
            match_result.groups!.parameter!,
          ) as InlineImageSpecification;
          return [
            {
              box: new InlineImageBox(specification),
              action:
                specification.disable_line_break.before && result.length > 0
                  ? "append"
                  : "normal",
              avoid_end: specification.disable_line_break.after,
            },
            i + match_result[0].length - 1,
          ];
        } else if (match_result.groups!.type === "color") {
          return [
            {
              box: new ColorDummyBox(match_result.groups!.parameter!),
              action: "normal",
              avoid_end: false,
            },
            i + match_result[0].length - 1,
          ];
        }
      }
    }
    const tag = classify_character(paragraph[i]!);
    if (tag.space) {
      return [{ box: undefined, action: "break", avoid_end: undefined }, i];
    } else if (tag.latin_cluster) {
      if (latin_sequence_start >= latin_sequence_end) {
        latin_sequence_start = i;
      }
      latin_sequence_end = i + 1;
      return [{ box: undefined, action: "normal", avoid_end: undefined }, i];
    } else {
      const box = new StringBox(paragraph[i]!);
      box.auto_space_class = [tag.auto_space_class, tag.auto_space_class];
      box.space_padding = tag.space_padding;
      return [
        {
          box,
          action:
            tag.avoid.start && result.at(-1) !== undefined
              ? "append"
              : "normal",
          avoid_end: tag.avoid.end,
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
      if (box === undefined && action === "break" && result.length > 0) {
        result.at(-1)!.space_after = true;
      }
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

// line breaking algorithm: knuth-plass
function knuth_plass(
  boxes: Box[],
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  configuring: UsedConfigurations,
  common_measurements: CommonMeasurements,
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
      helper.calculate_shape(context, configuring, common_measurements);
      const length = helper.shape.width;
      if (length > common_measurements.maximum_line_width) {
        continue;
      }
      const badness =
        i === boxes.length
          ? 0
          : Math.pow(common_measurements.maximum_line_width - length, 3);
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

// line breaking algorithm: greedy
function greedy(
  boxes: Box[],
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  configuring: UsedConfigurations,
  common_measurements: CommonMeasurements,
): [CombinationBox[], number] {
  const lines: CombinationBox[] = [new CombinationBox(boxes[0]!)];
  let badness = 0;
  let line_width = 0;
  for (const box of boxes.slice(1)) {
    const current_line = lines.at(-1)!;
    current_line.append(box);
    current_line.calculate_shape(context, configuring, common_measurements);
    if (current_line.shape.width > common_measurements.maximum_line_width) {
      current_line.pop();
      lines.push(new CombinationBox(box));
      badness += Math.pow(
        common_measurements.maximum_line_width - line_width,
        3,
      );
    } else {
      line_width = current_line.shape.width;
    }
  }
  return [lines, badness];
}

// given lines divided by the line-breaking algorithm, apply optional height limitation and calculate the
//  final rendered size. If lines are truncated and ellipsis is configured, the last line will be modified
//  by this function to place the ellipsis
function summarize_size(
  lines: CombinationBox[],
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  configuration: UsedConfigurations,
  common_measurements: CommonMeasurements,
  limit_height?: {
    maximum_height?: number;
    maximum_lines?: number;
    ellipsis?: boolean;
  },
): Size {
  let height = 0;
  let width = 0;
  let rendered_lines = 0;
  for (const line of lines) {
    line.calculate_shape(context, configuration, common_measurements);
    const temporary_height =
      height + line.shape.above_baseline + line.shape.below_baseline;
    if (
      temporary_height >
      (limit_height?.maximum_height ?? Number.POSITIVE_INFINITY)
    ) {
      break;
    }
    height = temporary_height;
    width = Math.max(width, line.shape.width);
    rendered_lines += 1;
    if (
      rendered_lines ===
      (limit_height?.maximum_lines ?? Number.POSITIVE_INFINITY)
    ) {
      break;
    }
  }
  rendered_lines = Math.min(
    rendered_lines,
    limit_height?.maximum_lines ?? lines.length,
  );
  if (lines.length > rendered_lines) {
    // some line is omitted since the limitation is exceeded otherwise
    lines.splice(rendered_lines);
    if (lines.length === 0) {
      useDialog().show_dialog(
        "warning",
        "高度限制使段落无法渲染",
        "当前高度限制对于所用字体或者图片尺寸而言太小以至于无法渲染任何内容。尝试调整配置",
      );
    } else if (limit_height?.ellipsis) {
      const last_line = lines.at(-1)!;
      const measurement = context.measureText("…");
      const ellipsis_width =
        measurement.actualBoundingBoxLeft + measurement.actualBoundingBoxRight;
      height -= last_line.shape.above_baseline + last_line.shape.below_baseline;
      if (
        last_line.shape.width + ellipsis_width >=
        common_measurements.maximum_line_width
      ) {
        let total_width_freed =
          common_measurements.maximum_line_width - last_line.shape.width;
        while (total_width_freed < ellipsis_width) {
          const popped = last_line.pop();
          if (popped === undefined) {
            useDialog().show_dialog(
              "warning",
              "段落可用宽度太小以至于无法插入省略号",
              "配置的段落宽度过小或字体大小过大，以至于最后一行全部元素均移除后仍不足以放置一个省略号。当前渲染会产生奇怪的结果。尝试调整配置。",
            );
            break;
          }
          total_width_freed += popped.shape.width;
        }
      }
      last_line.append(new StringBox("…"));
      last_line.calculate_shape(context, configuration, common_measurements);
      height += last_line.shape.above_baseline + last_line.shape.below_baseline;
      width = Math.max(width, last_line.shape.width);
    }
  }
  return { width, height };
}

// subset of global configuration
//  this type includes all configurations used in text rendering procedure and is used to give an accurate
//  list of used configurations
type UsedConfigurations = {
  debug: boolean;
  chat_emote_size: number;
  chat_font_size: number;
  font_family: string;
};

// prepare for text (paragraph) rendering
//  this function takes exactly the same parameters as render_text with different value returned:
//  a Size that indicates the minimum size of the bounding box which may contain the rendered paragraph
//  a callable that when called, perform the rendering on canvas context specified. Note that the following
//   drawing state of the context will be saved and applied to the rendering procedure:
//   - font
//   - textRendering
//  a callable that when called, release resources allocated for rendering which typically includes image
//   bitmaps. These resources are allocated in advance to reduce rendering latency, and a explicit release
//   function makes it possible to reuse the prepared resources without leaking anything.
//  and the canvas used
export async function prepare_text_rendering(
  ...args: Parameters<typeof render_text>
): Promise<{
  size: Size;
  render: (
    context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    topleft: Coordinate,
  ) => void;
  release: () => Promise<void>;
  canvas: HTMLCanvasElement | OffscreenCanvas;
}> {
  const [paragraph, configuring, max_width, canvas, options] = args;
  // replace configuring with local type to limit accessability
  const local_configurations: UsedConfigurations = configuring;

  // prepare canvas
  const { used_canvas, context } = ((): {
    used_canvas: HTMLCanvasElement | OffscreenCanvas;
    context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  } => {
    if (canvas) {
      return { used_canvas: canvas, context: canvas.getContext("2d")! as any };
    }
    const used_canvas = new OffscreenCanvas(0, 0);
    const context = used_canvas.getContext("2d")!;
    context.font =
      options?.canvas_configurations?.font ??
      `${local_configurations.chat_font_size}px "${local_configurations.font_family}"`;
    context.fillStyle = options?.canvas_configurations?.fill_style ?? "black";
    context.strokeStyle =
      options?.canvas_configurations?.stroke_style ?? "black";
    return { used_canvas, context };
  })();
  context.textRendering = "optimizeLegibility";

  // measurements
  const common_measurements = measure(context, local_configurations);
  common_measurements.maximum_line_width = max_width;

  const boxes = process_paragraph(paragraph);
  const line_breaking_function =
    (options?.algorithm ?? "greedy") === "greedy" ? greedy : knuth_plass;
  const [lines, badness] = line_breaking_function(
    boxes,
    context,
    local_configurations,
    common_measurements,
  );
  if (local_configurations.debug) {
    console.log(lines, badness);
  }

  const { width, height } = summarize_size(
    lines,
    context,
    local_configurations,
    common_measurements,
    options?.limit_height,
  );
  common_measurements.target_line_width = width;

  // prepare for rendering
  const resources = { images: new Map<string, ImageBitmap>() };
  for (const line of lines) {
    await line.prepare_resources(resources);
  }

  const text_rendering_state: TextRenderingStates = (() => {
    const temporary_justification_last = options?.justification?.last ?? false;
    return {
      operations: {
        fill: options?.operations?.fill ?? true,
        stroke: options?.operations?.stroke ?? false,
      },
      alignment: options?.alignment ?? "left",
      justification: {
        normal: options?.justification?.normal ?? true,
        last: (() => {
          if (typeof temporary_justification_last === "number") {
            return temporary_justification_last;
          }
          return temporary_justification_last ? 0 : 2;
        })(),
      },
    };
  })();

  const picked_font = context.font;
  const picked_text_rendering = context.textRendering;

  return {
    size: { width, height },
    render: (
      context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
      topleft: Coordinate,
    ) => {
      const backup = {
        font: context.font,
        text_rendering: context.textRendering,
      };
      context.font = picked_font;
      context.textRendering = picked_text_rendering;

      if (local_configurations.debug) {
        draw_line(
          context,
          { x: topleft.x, y: topleft.y },
          { x: topleft.x, y: topleft.y + height },
        );
        draw_line(
          context,
          { x: topleft.x + width - 1, y: topleft.y },
          { x: topleft.x + width - 1, y: topleft.y + height },
        );
      }

      let current_y = topleft.y;
      for (const [index, line] of lines.entries()) {
        current_y += line.shape.above_baseline;
        line.render(
          context,
          { x: topleft.x, y: current_y },
          local_configurations,
          text_rendering_state,
          common_measurements,
          {
            is_toplevel: true,
            is_last_line: index === lines.length - 1,
          },
        );
        current_y += line.shape.below_baseline;
      }

      context.font = backup.font;
      context.textRendering = backup.text_rendering;
    },
    release: async () => {
      for (const image of resources.images.values()) {
        image.close();
      }
      resources.images.clear();
    },
    canvas: used_canvas,
  };
}

// render given paragraph with the specified configuration
//  paragraph is parsed with magic blocks expanded into their actual content
//  width specified the maximum width of each line of the paragraph may use
//  canvas can be supplied to reuse one allocated previously and such reuse is highly encouraged since it
//   reduces overhead and therefore the memory usage
//
//  This function simply arranges the paragraph to fit the satisfy the maximum width requirement by inserting
//   line breaks at where the knuth-plass algorithm believe is optimal. Only content of the paragraph will be
//   rendered, while background, borders and everything else will not be included. You can use this to arrange
//   your content in case you need automatic line breaks.
//  Returns the rendered image as a Blob representing a PNG file, and the canvas used to do the rendering. If
//   a canvas is not specified in arguments, a new canvas is created and returning it allows later reuse. The
//   canvas is resized to the minimal size that is able to contain the rendered paragraph. To be specific, the
//   content boxes with touch all boundaries of the canvas. Note that most glyphs will not touch the box set
//   by the font, space may still occur near boundaries.
//
// Be careful when using this function: this function is relative slow, especially when processing long
//  paragraphs since the knuth-plass algorithm is a dynamic programming algorithm whose time complexity is
//  O(N^2). It is recommended that you invoke this function only once to get your paragraph arranged and cache
//  the result for later reuse.
//
// Options that may alter how this function behaves:
//  limit_height: If the rendered height should be limited. This limitation can be specified by the number
//   of lines to be rendered or the maximum height allowed measured in pixels. Specifying both of which
//   results in the stricter one being effective. The rendering is always line-based: if only maximum
//   height is specified, remaining space that is not enough to hold a whole line is discarded and that
//   line will not be rendered in a partial way. Optional ellipsis can be included as the last character
//   in the last line rendered.
//  algorithm: The line-breaking algorithm to use. greedy runs faster while generating a reasonable result,
//   while knuth-plass is slower but generates better result.
//  canvas_configurations: Configurations to use in canvas operations. This will only be applied when a new
//   canvas is created. If a canvas is passed to this function, configurations should be specified by directly
//   modifying the drawing states of the 2D rendering context attached to it.
//  operations: how text should be rendered. By default text will be filled only.
//  alignment: how the rendered lines are aligned. By default lines will be aligned to the left.
//  justification: If extra blank should be inserted evenly between characters (or boxes to be specific) to
//   make the left and right boundary form a exact vertical alignment. This will be effective if and only if
//   alignment is not set to center. normal controls if normal lines, which refers to any line other than the
//   last one, should be justified, while last controls how the last line is processed. By default normal is
//   set to true and last is set to false. last may also take a number which specifies the length threshold:
//   if it is set to 0.8, then the last line will be justified if and only if its original length is not less
//   than four-fifths of the maximum width.
export async function render_text(
  paragraph: string,
  configuring: Configuring,
  max_width: number,
  canvas?: HTMLCanvasElement | OffscreenCanvas,
  options?: {
    limit_height?: {
      maximum_height?: number;
      maximum_lines?: number;
      ellipsis?: boolean;
    };
    algorithm?: "greedy" | "knuth-plass";
    canvas_configurations?: {
      font?: string;
      stroke_style?: string;
      fill_style?: string;
    };
    operations?: {
      fill?: boolean;
      stroke?: boolean;
    };
    alignment?: TextRenderingStates["alignment"];
    justification?: {
      normal?: boolean;
      last?: boolean | number;
    };
  },
): Promise<{ image: Blob; canvas: HTMLCanvasElement | OffscreenCanvas }> {
  const result = await prepare_text_rendering(
    paragraph,
    configuring,
    max_width,
    canvas,
    options,
  );
  const context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D =
    result.canvas.getContext("2d")! as any;
  const state = new CanvasDrawingState(context);
  result.canvas.height = result.size.height;
  result.canvas.width = result.size.width;
  state.apply(context);
  result.render(context, { x: 0, y: 0 });
  result.release();

  return { image: await canvas_to_blob(result.canvas), canvas: result.canvas };
}

// build boxes containing inline image to be rendered by render_text
//
// Rendering inline images can be quite common when rendering paragraphs. An inline image here is an image
//  that flows together with the characters of the paragraph as if a special character. The rendering engine
//  is ready to handle such images with proper line wrapping since it is actually not handling characters,
//  but boxes. So long as components in a paragraph can be represented by boxes with known width, the engine
//  can operate on it without any complain.
// This function is a helper to make any image a box ready to be operated by the render_text function.
//  Inserting the returned content string to anywhere of a paragraph passed to render_text will result in the
//  specified image rendered inline at where it is inserted.
// Parameters:
//  image: the inline image to be rendered. Can be specified as a Blob or a string, where the former is simply
//   the image file itself, while the later is the URL to fetch the image. The content and the url used is
//   returned to the caller. If Blob is supplied, an Blob URL will be created which must be released by the
//   caller when such image is no longer used.
//  size: target size of the rendered image, this will be the size of the box
//  reference_line: position of the reference line on the image. This is the first factor deciding how to
//   place the image vertically. The reference line is a virtual horizontal line through the image, whose
//   position is calculated as: if reference_line is not negative, the distance between the line and the top
//   boundary of the image is reference_line times the height of the image; otherwise the distance between the
//   line and the bottom boundary og the image is absolute value of reference_line times the height of the
//   image. How the reference line is used is explained below.
//  baseline: the baseline to align the reference line of image with when placing the image. This parameter
//   can be a number, which will be the offset from the default baseline where a positive number moves the
//   final baseline upwards and a negative value moves it downwards. It can also be one of following strings:
//    "default": just the default baseline, no modification
//    "sub": the subscript baseline, which is calculated by shifting the default baseline downwards by one
//           fifth of current font size configuration
//    "super": the subscript baseline, which is calculated by shifting the default baseline upwards by one
//           third of current font size configuration
//    "top": the top line of current font
//    "middle": calculated by shifting the default baseline upwards by half of the x-height of current font
//    "bottom": the bottom line of current font
//   Together with reference_line, this parameter decides how the image is placed vertically. For example,
//    if reference_line is set to 0 which places the reference line at the top boundary of the image, which
//    baseline is set to bottom, then the top boundary of the image will align to the bottom boundary of
//    the font.
//  auto_space_class: auto-space class of the image. When any element is rendered next to one with different
//   auto-space class, a blank of one fourth of the default space width inserted automatically between them.
//   Setting this to undefined will ultimately disable auto-space around the image
//  disable_line_break: if line breaking can happen before or after this image
export async function build_inline_image_box(
  image: Blob | string,
  size: Size,
  reference_line: number,
  baseline: "default" | "sub" | "super" | "top" | "middle" | "bottom" | number,
  auto_space_class: AutoSpaceClass | undefined,
  disable_line_break: { before: boolean; after: boolean },
): Promise<{ content: string; url: string }> {
  const url = image instanceof Blob ? URL.createObjectURL(image) : image;
  const offset =
    reference_line >= 0
      ? reference_line * size.height
      : (1 + reference_line) * size.height;
  const specification: InlineImageSpecification = {
    image: url,
    size,
    reference_line_offset: offset,
    baseline,
    auto_space_class,
    disable_line_break,
  };
  const content = `[:inline-image:${JSON.stringify(specification)}:]`;
  return { content, url };
}
type InlineImageSpecification = {
  image: string;
  size: Size;
  reference_line_offset: number;
  baseline: "default" | "sub" | "super" | "top" | "middle" | "bottom" | number;
  auto_space_class: AutoSpaceClass | undefined;
  disable_line_break: { before: boolean; after: boolean };
};
