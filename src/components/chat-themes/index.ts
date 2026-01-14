import type { ThemeSpecification } from "./interface";

const CHAT_THEMES: ThemeSpecification[] = [];

const theme_loaders = import.meta.glob("./*/entry.ts");
for (const theme_loader of Object.values(theme_loaders)) {
  const theme = (await theme_loader()) as any;
  CHAT_THEMES.push(theme.default as ThemeSpecification);
}

export default CHAT_THEMES;
