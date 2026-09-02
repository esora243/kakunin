import type { ElementType, ReactNode } from "react";
import { cx } from "@/components/ui/cx";

type ContainerProps = {
  as?: ElementType;
  className?: string;
  children: ReactNode;
  /** 全幅の帯 (広告 / 固定バー) の内側で横 gutter だけ揃えたいとき */
  bleed?: boolean;
};

/**
 * ページ幅を決める唯一の場所。
 *
 * - 画面側は `max-w-lg` を直接書かない。幅を変えるときはここだけを触る。
 * - mobile は max-w-app (32rem)、desktop は max-w-content (48rem) まで広げる。
 *   ナビ・広告帯・本文がすべて同じ Container を通るため、左右の基準が一致する。
 */
export function Container({ as: Component = "div", className, children, bleed = false }: ContainerProps) {
  return (
    <Component className={cx("mx-auto w-full max-w-app md:max-w-content", !bleed && "px-gutter", className)}>
      {children}
    </Component>
  );
}
