import base from "./base.js";

/** Next.js apps layer their own `next lint` config on top of this. */
export default [
  ...base,
  {
    files: ["**/*.tsx"],
    rules: {
      "react/react-in-jsx-scope": "off",
    },
  },
];
