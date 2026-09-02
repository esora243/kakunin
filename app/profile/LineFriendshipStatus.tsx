"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { getLineFriendship, requestLineFriendship } from "@/lib/liff/client";

export function LineFriendshipStatus() {
  const [state, setState] = useState<"loading" | "friend" | "not-friend" | "unavailable">("loading");

  const refresh = async () => {
    try {
      const result = await getLineFriendship();
      setState(result === null ? "unavailable" : result ? "friend" : "not-friend");
    } catch {
      setState("unavailable");
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <Card className="p-4">
      <h2 className="text-body font-bold text-primary">LINE友だち状態</h2>
      <p className="mt-1 text-body text-secondary">
        {state === "loading"
          ? "確認中..."
          : state === "friend"
            ? "友だち追加済み"
            : state === "not-friend"
              ? "未追加"
              : "この環境では確認できません"}
      </p>
      {state === "not-friend" ? (
        // LINE 連携そのものの操作なので line variant を使う。
        <Button variant="line" size="sm" className="mt-3" onClick={() => void requestLineFriendship().then(refresh)}>
          友だち追加
        </Button>
      ) : null}
      {state === "unavailable" ? (
        <Button variant="ghost" size="sm" className="mt-3" onClick={() => void refresh()}>
          再確認
        </Button>
      ) : null}
    </Card>
  );
}
