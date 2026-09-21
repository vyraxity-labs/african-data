import nextConfig from "eslint-config-next";

export const config = [
  ...nextConfig,
  {
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
  },
];

export default config;
