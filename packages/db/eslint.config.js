import baseConfig from "@sportcomplex/config/eslint/base.js";
import tseslint from "typescript-eslint";

export default tseslint.config(...baseConfig, {
  files: ["test/**"],
  rules: {
    "@typescript-eslint/no-explicit-any": "off",
  },
});