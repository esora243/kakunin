/** クラス結合の唯一のヘルパー。falsy を落として join するだけ。 */
export function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}
