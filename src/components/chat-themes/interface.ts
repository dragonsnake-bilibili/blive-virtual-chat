import type { DefineComponent, InjectionKey } from "vue";
import type { Configuring } from "../MainView.vue";
import type { RenderSpace, RenderTime, Size } from "@/utilities/rendering";

export type ThemeSpecifiedConfiguration = {
  theme: string;
  content: Record<string, any>;
};

export type GlobalConfigureForm = DefineComponent<
  // props and models
  { modelValue: ThemeSpecifiedConfiguration },
  // raw bindings
  any,
  // data
  any,
  // computed
  {},
  // methods
  {},
  // mixins
  Record<string, any>,
  // extends
  Record<string, any>,
  // emits
  {}
>;

export type ChatConfigureForm = DefineComponent<
  // props and models
  { modelValue: ThemeSpecifiedConfiguration },
  // raw bindings
  any,
  // data
  any,
  // computed
  {},
  // methods
  {},
  // mixins
  Record<string, any>,
  // extends
  Record<string, any>,
  // emits
  {}
>;

export type SharedChatConfigure = {
  id: string;
  username: string;
  avatar: string;
  enter_millisecond: number;
  content: string;
  logos: {
    captain: boolean;
    admiral: boolean;
    governor: boolean;
    manager: boolean;
  };
};
export type FullChatConfigure = {
  shared: SharedChatConfigure;
  themed: ThemeSpecifiedConfiguration;
};

export type ChatDisplay = DefineComponent<
  // props and models
  // Only configurations created by the theme itself is passed into these components, which shared global
  //  configurations are applied via following CSS classes / selectors:
  //   .chat-container: the outmost element of a chat, which must represent the exact bounding box of the chat
  //   img.chat-content-image: emotes in content
  //   img.chat-logo: badges
  //   .chat-avatar: user avatar
  // If shared configuration is otherwise required, consult provided value accessible with the following key:
  //  inj_SharedGlobalConfigurations
  { chatConfig: FullChatConfigure; globalConfig: ThemeSpecifiedConfiguration },
  // raw bindings
  any,
  // data
  any,
  // computed
  {},
  // methods
  {},
  // mixins
  Record<string, any>,
  // extends
  Record<string, any>,
  // emits
  {}
>;
export const inj_SharedGlobalConfigurations =
  Symbol() as InjectionKey<Configuring>;

export type FullGlobalConfigure = {
  shared: Configuring;
  themes: ThemeSpecifiedConfiguration;
};

// the function to render the full chat at its final state (fully visible after transitions are done)
//
// This is used to implement standalone rendering when the image of a single chat is required. This is how
//  the preview and configuring guide image of a theme is build.
// If the theme has post-transition animation, try maximizing readability and making annotating configurable
//  parameters easier when rendering.
// A canvas might be passed to this function to reuse for lower overhead, whose state can be modified at will.
//  No assumption should be made to the metadata or content of the canvas.
// The rendered image, in image/png format, together with the canvas used should be returned to the caller.
//  The background of the image should be transparent and the width of the rendered chat
//  should only be limited by maximum chat width, not the size of scene.
// The canvas should be resized to the exact size of the rendered image.
export type ChatRenderer = (
  chat: FullChatConfigure,
  configuring: FullGlobalConfigure,
  canvas?: HTMLCanvasElement | OffscreenCanvas,
) => Promise<{
  image: Blob;
  canvas: HTMLCanvasElement | OffscreenCanvas;
}>;

// interface to describe a chat during the rendering procedure
export abstract class RenderingChat {
  // size of the chat
  //
  // This size specifies the size of the bounding box of this chat, which should be considered as the maximum
  //  space occupied by the chat after it has fully entered to the scene (if the scene is capable to hold it
  //  as a whole). The scene arranger will arrange chats so that the top-left coordinate specified to the
  //  render method, at any time point and for any two chats, will guarantee that their bounding boxes,
  //  whose top-left vertex are placed at the corresponding coordinate specified and with shape of size as
  //  indicated by the size member on each chat and an extra margin as configured globally, will never overlap
  // The value must be filled when an instance is created and must not be changed afterwards
  abstract size: Size;

  // render the chat to the scene
  //
  // This method must not be async: everything must be prepared beforehand, typically when this instance is
  //  created. Such design is helpful to reduce overhead and control delay.
  // Parameters:
  //  context: the canvas rendering context to render the chat
  //   note that the corresponding canvas might already contain meaningful contents rendered by other chats,
  //   this method must preserve all states of the canvas, except the area that meant to be rendered on
  //  helping_context: the canvas rendering context as a helper
  //   use this context if the rendering procedure needs a temporary canvas
  //  spacing: space information to be used as references in animating
  //  timing: time information to be used as references in animating
  // Return Value:
  //  If current chat can now be removed from the chat list, which means all resources allocated for this chat
  //   on the scene controller side can be released and methods on this instance will no longer be invoked,
  //   which ultimately removes this chat from the scene being rendered after current frame (but it is still
  //   possible to render anything desired to current frame which will not be removed), return false to the
  //   caller. The caller will in turn invoke the free method on this instance, which can be async and gives
  //   a better chance to clear any resources allocated by this instance up. Otherwise, if this method
  //   should still be called subsequently, return true.
  //  Even if the scene controller believes that the bounding box of the chat has moved out of the visible
  //   area and will never return back into it, it will still keep everything for the chat and continue
  //   invoking render methods on the chat to support possible special themes. Therefore, false should be
  //   returned as soon as possible to reduce overhead.
  //  Note that returning false will not cause the chat rendered moving automatically as the scene progresses:
  //   the canvas on which frames are rendered is cleared before each frame is being rendered, therefore the
  //   chat will simply disappear. If the desired behavior is that the chat would show up, on each subsequent
  //   frame, where its bounding box is placed by the scene and the chat itself is simply a static image that
  //   can be pasted onto the canvas directly, return a ImageBitmap containing the static image. This will
  //   cause the scene controller releases most of the resources and invoke the free method as if false is
  //   returned, but the returned image is cached and placed to current and subsequent frames accordingly
  //   so long as its bounding box is visible inside the scene. The returned ImageBitmap must have exactly
  //   the same size as specified in size property on this instance and whose ownership is transferred to
  //   the scene controller: it is the scene controller that is responsible for managing resources allocated
  //   and free them when it is no longer used. Returning ImageBitmap is useful when your theme includes some
  //   animation for individual chats but the animation terminates at certain point and leaves the chat a
  //   static image afterwards. Does not like returning false, returning an ImageBitmap will not affect the
  //   other rendering method: returning an ImageBitmap from render will stop the controller from calling
  //   render again, but the controller may still call render_pass2, and the instance will only be deleted
  //   once both render and render_pass2 has returned an ImageBitmap. On the other hand, returning false will
  //   cause the instance deleted immediately after the controller have done with current frame.
  // See also render_pass2
  abstract render(
    context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    helping_context:
      | CanvasRenderingContext2D
      | OffscreenCanvasRenderingContext2D,
    spacing: RenderSpace,
    timing: RenderTime,
  ): ImageBitmap | boolean;

  // render the chat to the scene: pass2
  //
  // This interface is included in case the theme has some components that are meant to overlap.
  // render and render_pass2 are always invoked in predictable order: the method on instance corresponding to
  //  the chat that enters the scene earlier will be invoked first, which is exactly the same order as shown
  //  in editing mode, from the top to the bottom. Therefore, if the theme have certain component that exceeds
  //  the bounding box, it might be overwritten (covered) by chats rendered later. If such component is
  //  supposed to be rendered over other chats, you can render them here in render_pass2. The full invoking
  //  order would be:
  //  render@chat-0 -> render@chat-1 -> ... -> render@chat-n -> render_pass2@chat-0 -> ...
  // This method must act exactly the same as render, except that when ImageBitmap is returned, its size is
  //  not required to be exactly the same as specified in size property, and the scene controller will stop
  //  pasting it to subsequent frames until it, when placed with its top-left aligned with the top-left of
  //  the bounding box of the chat, includes not a single pixel in the visible area. This will not change the
  //  bounding box of the chat. An optional offset can be specified to move the coordinate of top-left corner
  //  beforehand, do be careful to support different scene directions.
  abstract render_pass2?(
    context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    helping_context:
      | CanvasRenderingContext2D
      | OffscreenCanvasRenderingContext2D,
    spacing: RenderSpace,
    timing: RenderTime,
  ): { image: ImageBitmap; offset?: Size } | boolean;

  // cleanup any resource allocated
  abstract free(): Promise<void>;
}

export type RenderPreparation =
  | RenderingChat
  | {
      render: ImageBitmap;
      render_pass2?: { image: ImageBitmap; offset?: Size };
    };

export type ThemeSpecification = {
  name: string;
  global_configure: GlobalConfigureForm;
  display: ChatDisplay;
  editor: ChatConfigureForm;

  // prepare the per-chat configuration
  //
  // This function is called to initialize configuration of every newly created chat before it becomes visible
  //  to the editor, so that the editor can be sure that all required entries have already been filled with
  //  default value. This function will also be invoked on all existing chats when the theme is switched
  prepare_chat: (chat: FullChatConfigure) => void;

  render: ChatRenderer;

  // build the entering animation for a chat to preview it
  //  the element is the root element in the DOM containing the chat
  //  the animation must end exactly enter_duration milliseconds after it starts
  //  consider both stacking scene and danmaku scene, and direction of main axis when creating the animation
  // if some modification have been done to the element, a revoke function should be provided
  prepare_entering_animation: (
    chat: FullChatConfigure,
    element: Element,
    configuring: FullGlobalConfigure,
  ) => { animation?: Animation[]; revoke?: () => void };

  // build RenderingChat instance for rendering
  //
  // This function can also return an ImageBitmap or ImageBitmaps, which acts as if ImageBitmap is returned
  //  during the very first call to render method or / and render_pass2 method. This can be useful if the
  //  theme contains no animation on the chats
  prepare_rendering: (
    chat: FullChatConfigure,
    configuring: FullGlobalConfigure,
    context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  ) => Promise<RenderPreparation>;
};
