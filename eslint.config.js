import vuetify from "eslint-config-vuetify";
import pluginVue from "eslint-plugin-vue";

export default vuetify(
  { vue: true },
  {
    plugins: {
      vue: pluginVue,
    },
    rules: {
      "@stylistic/quotes": ["error", "double", { avoidEscape: true }],
      "@stylistic/semi": ["error", "always"],
      "@stylistic/space-before-function-paren": [
        "error",
        {
          anonymous: "always",
          named: "never",
          asyncArrow: "always",
          catch: "always",
        },
      ],
      "@stylistic/member-delimiter-style": [
        "error",
        {
          multiline: { delimiter: "semi", requireLast: true },
          singleline: { delimiter: "semi", requireLast: false },
        },
      ],
      "@stylistic/operator-linebreak": [
        "error",
        "after",
        { overrides: { "?": "before", ":": "before", "|": "before" } },
      ],
      "vue/script-indent": ["error", 2, { switchCase: 1 }],
      "vue/max-attributes-per-line": [
        "error",
        { singleline: 100, multiline: 1 },
      ],
      "vue/html-indent": ["off"],
      "vue/no-use-v-if-with-v-for": ["off"],
      "vue/custom-event-name-casing": ["error", "camelCase"],
      "no-control-regex": ["off"],
      "antfu/consistent-chaining": ["off"],
      "vue/html-self-closing": [
        "error",
        {
          html: {
            void: "always",
            normal: "always",
            component: "always",
          },
          svg: "always",
          math: "always",
        },
      ],
      "@stylistic/arrow-parens": ["error", "always"],
      "@stylistic/indent": ["off"],
      "@stylistic/indent-binary-ops": ["off"],
    },
  },
);
