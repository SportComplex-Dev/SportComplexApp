import reactConfig from "@sportcomplex/config/eslint/react.js";

export default [
  ...reactConfig,
  {
    files: ["**/*.{ts,tsx}"],
  },
];
