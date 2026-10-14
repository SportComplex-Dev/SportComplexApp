import baseConfig from "./base.js";

export default [
  ...baseConfig,
  {
    rules: {
      "react/prop-types": "off",
      "react/react-in-jsx-scope": "off",
    },
  },
];
