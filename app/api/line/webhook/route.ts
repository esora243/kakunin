import { NextResponse, type NextRequest } from "next/server";
import crypto from "node:crypto";

/**
 * LINE Messaging API Webhook 受信エンドポイント。
 *
 * 役割:
 *  1. LINE プラットフォームからのリクエスト署名 (X-Line-Signature) を検証
 *  2. `follow` イベント（友だち追加）を検知したら機能説明用 PNG を Reply API で自動返信
 *  3. その他のイベントは 200 を返してスキップ
 *
 * 環境変数 (必須):
 *  - LINE_CHANNEL_SECRET        : Channel Secret
 *  - LINE_CHANNEL_ACCESS_TOKEN  : long-lived access token
 *  - LINE_WELCOME_IMAGE_URL     : 友だち追加時に送る PNG の公開 URL (HTTPS)
 *  - LINE_WELCOME_PREVIEW_URL   : プレビュー画像 URL（省略時は同上）
 *
 * 受信エンドポイント URL は LINE Developers Console で以下を設定する:
 *   https://<your-domain>/api/line/webhook
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// === LINE 型 ===
type LineEvent =
  | {
      type: "follow";
      replyToken: string;
      source?: { userId?: string; type: string };
      timestamp: number;
    }
  | {
      type: "message";
      replyToken: string;
      message: { type: string; text?: string };
    }
  | { type: string; [k: string]: any };

type LineWebhookBody = {
  destination: string;
  events: LineEvent[];
};

const LINE_REPLY_ENDPOINT = "https://api.line.me/v2/bot/message/reply";

/** LINE 署名検証: HMAC-SHA256(channelSecret, rawBody) を Base64 で比較 */
function verifySignature(rawBody: string, signature: string | null, secret: string): boolean {
  if (!signature) return false;
  try {
    const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("base64");
    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/** Reply API 呼び出し */
async function lineReply(replyToken: string, messages: any[], token: string) {
  const res = await fetch(LINE_REPLY_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ replyToken, messages }),
  });
  if (!res.ok) {
    const text = await res.text();
    console.error("[LINE reply error]", res.status, text);
  }
  return res;
}

/** 友だち追加時のメッセージ群 */
function buildFollowMessages(): any[] {
  const imageUrl =
    process.env.LINE_WELCOME_IMAGE_URL ||
    "https://placehold.co/1024x1024/F97316/FFFFFF.png?text=Hugmeid";
  const previewUrl = process.env.LINE_WELCOME_PREVIEW_URL || imageUrl;

  return [
    {
      type: "text",
      text:
        "Hugmeid をご利用いただきありがとうございます！\n" +
        "医学生のための時間割・お気に入り記事・課外活動カレンダーをひとつにまとめたアプリです。\n" +
        "以下の画像で主な機能をご紹介します👇",
    },
    {
      type: "image",
      originalContentUrl: imageUrl,
      previewImageUrl: previewUrl,
    },
    {
      type: "text",
      text:
        "🟠 機能ハイライト\n" +
        "・記事タブ: お気に入り/学習法フィルタ + 自分で発信\n" +
        "・カレンダー: 1〜6 年生別の時間割、診療科クリックで概要表示\n" +
        "・課外活動: 学内 / 学外を昼休み・放課後枠に連携\n" +
        "詳しくはアプリを開いてください！",
    },
  ];
}

export async function POST(req: NextRequest) {
  const channelSecret = process.env.LINE_CHANNEL_SECRET;
  const channelToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;

  if (!channelSecret || !channelToken) {
    console.error("[LINE webhook] missing env: LINE_CHANNEL_SECRET / LINE_CHANNEL_ACCESS_TOKEN");
    // LINE は 200 を返すのが原則なので、設定不備でも 200 を返してログだけ残す。
    return NextResponse.json({ ok: false, reason: "config_missing" }, { status: 200 });
  }

  // 署名検証は rawBody が必要
  const rawBody = await req.text();
  const signature = req.headers.get("x-line-signature");

  if (!verifySignature(rawBody, signature, channelSecret)) {
    console.warn("[LINE webhook] invalid signature");
    return NextResponse.json({ ok: false, reason: "invalid_signature" }, { status: 401 });
  }

  let body: LineWebhookBody;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: false, reason: "invalid_json" }, { status: 200 });
  }

  const events = Array.isArray(body.events) ? body.events : [];

  await Promise.all(
    events.map(async (event) => {
      try {
        if (event.type === "follow" && "replyToken" in event && event.replyToken) {
          // 友だち追加 → 機能説明画像を含む3メッセージを返信
          await lineReply(event.replyToken, buildFollowMessages(), channelToken);
          return;
        }

        // 任意: 簡易テキスト応答（"使い方" などのキーワード）
        if (
          event.type === "message" &&
          (event as any).message?.type === "text" &&
          (event as any).message?.text &&
          (event as any).replyToken
        ) {
          const text = String((event as any).message.text).trim();
          if (text === "使い方" || text === "ヘルプ" || text.toLowerCase() === "help") {
            await lineReply((event as any).replyToken, buildFollowMessages(), channelToken);
          }
        }
      } catch (e) {
        console.error("[LINE webhook] event handling error", e);
      }
    }),
  );

  return NextResponse.json({ ok: true });
}

// LINE プラットフォームからの検証 (GET) や疎通確認用に GET も用意
export async function GET() {
  return NextResponse.json({ ok: true, service: "line-webhook" });
}
