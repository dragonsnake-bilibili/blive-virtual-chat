import type { ThemeSpecification } from "../interface";
import { name, set_default_configuration } from "./configures";
import Display from "./Display.vue";
import Editor from "./Editor.vue";
import GlobalConfig from "./GlobalConfig.vue";
import { prepare_rendering, render } from "./rendering";

const PLAIN: ThemeSpecification = {
  name,
  global_configure: GlobalConfig,
  display: Display,
  editor: Editor,
  prepare_chat: set_default_configuration,
  render,
  prepare_entering_animation: () => ({}),
  prepare_rendering,
};

export default PLAIN;
