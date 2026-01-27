import type { FullChatConfigure, FullGlobalConfigure } from "../interface";
import styles from "./style.module.css";

export function prepare_entering_animation(
  chat: FullChatConfigure,
  element: Element,
  configuring: FullGlobalConfigure,
): { animation?: Animation[]; revoke?: () => void } {
  if (configuring.shared.selected_mode!.name === "danmaku") {
    return {};
  }

  const username = element.querySelector(".username-content")!;
  const username_markers = element.querySelectorAll(".username-marker");
  const divider = element.querySelector(".divider")!;
  const content = element.querySelector(".content")!;
  const username_side_star = element.querySelectorAll(".star.username-side");
  const content_side_star = element.querySelector(".star.content-side")!;

  const hide_list = [
    username,
    ...username_markers,
    divider,
    content,
    ...username_side_star,
    content_side_star,
  ];
  for (const element of hide_list) {
    element.classList.add(styles["hide-before-start"]);
  }

  const common_options = {
    duration: configuring.shared.enter_duration,
    delay: chat.shared.enter_millisecond + configuring.shared.lift_duration,
    fill: "forwards",
  } as const;

  const animation: Animation[] = [
    new Animation(
      new KeyframeEffect(
        username,
        [
          { transform: "none", easing: "ease-out" },
          { transform: "translateY(-40%)", easing: "ease-in-out" },
          { transform: "none" },
        ],
        {
          ...common_options,
        },
      ),
    ),
    new Animation(
      new KeyframeEffect(username, [{ opacity: 0 }, { opacity: 1 }], {
        easing: "ease-out",
        ...common_options,
      }),
    ),
    new Animation(
      new KeyframeEffect(
        divider,
        [
          { opacity: 0, transform: "translateX(-10%)" },
          { opacity: 1, transform: "none" },
        ],
        {
          easing: "ease-out",
          ...common_options,
        },
      ),
    ),
    new Animation(
      new KeyframeEffect(
        content,
        [
          { opacity: 0, transform: "translateX(40%)" },
          { opacity: 1, transform: "none" },
        ],
        {
          easing: "ease-out",
          ...common_options,
        },
      ),
    ),
  ];
  for (const mark of username_markers) {
    animation.push(
      new Animation(
        new KeyframeEffect(
          mark,
          [
            { opacity: 0, transform: "translateY(-100%)" },
            { opacity: 1, transform: "none" },
          ],
          {
            easing: "ease-out",
            ...common_options,
          },
        ),
      ),
    );
  }
  for (const star of username_side_star) {
    animation.push(
      new Animation(
        new KeyframeEffect(
          star,
          [
            { opacity: 0, transform: "scale(0.6)" },
            { opacity: 1, transform: "none" },
          ],
          {
            easing: "ease-out",
            ...common_options,
          },
        ),
      ),
    );
  }
  animation.push(
    new Animation(
      new KeyframeEffect(
        content_side_star,
        [
          { opacity: 0, transform: "translateY(40%)" },
          { opacity: 1, transform: "none" },
        ],
        {
          easing: "ease-out",
          ...common_options,
        },
      ),
    ),
  );

  return {
    animation,
    revoke: () => {
      for (const element of hide_list) {
        element.classList.remove(styles["hide-before-start"]);
      }
    },
  };
}
