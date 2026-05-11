/**
 * ESLint 9 flat config for Next.js 16
 * - eslint-config-next 16 系を読み込む
 * - Next.js 16 で next.config の eslint オプションが廃止されたため、
 *   こちらでルールを一元管理する
 */
import { FlatCompat } from "@eslint/eslintrc";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

export default [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      ".next/**",
      ".test-dist/**",
      "node_modules/**",
      "next-env.d.ts",
    ],
  },
];
