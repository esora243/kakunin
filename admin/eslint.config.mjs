import nextVitals from "eslint-config-next/core-web-vitals";

const config = [
  {
    ignores: [".next/**", ".test-dist/**", "node_modules/**"],
  },
  ...nextVitals,
];

export default config;
