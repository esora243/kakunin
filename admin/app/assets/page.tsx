import { ImageOff, Trash2 } from "lucide-react";
import { getAdminIdentityForPage } from "@/lib/auth/page-identity";
import { AccessDenied } from "@/components/AccessDenied";
import { listAssetRows, listAssetUsageForAssetIds } from "@/lib/assets";
import { DeleteAssetButton } from "./DeleteAssetButton";
import { AssetUploadWidget } from "./AssetUploadWidget";
import { singleStringParam } from "@/lib/query-params";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { TableShell, THead, Th, Tr, Td, TdMono } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge, type StatusBadgeVariant } from "@/components/ui/StatusBadge";
import { cx } from "@/components/ui/cn";

export const dynamic = "force-dynamic";

function formatBytes(byteSize: number): string {
  if (byteSize < 1024) return `${byteSize} B`;
  const kb = byteSize / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function statusOf(asset: { deletedAt: string | null; purgedAt: string | null }): {
  variant: StatusBadgeVariant;
  label: string;
} {
  if (asset.purgedAt) return { variant: "muted", label: "完全削除済み" };
  if (asset.deletedAt) return { variant: "warning", label: "削除済み" };
  return { variant: "success", label: "利用可能" };
}

export default async function AssetsPage({
  searchParams,
}: {
  searchParams?: Promise<{ deleted?: string }>;
}) {
  const identity = await getAdminIdentityForPage();
  if (!identity) return <AccessDenied />;

  const params = (await searchParams) ?? {};
  const showDeleted = singleStringParam(params.deleted) === "1";
  const assets = await listAssetRows(showDeleted ? { includeDeleted: true } : {});
  const usageByAsset = await listAssetUsageForAssetIds(assets.map((asset) => asset.id));

  return (
    <div>
      <PageHeader
        eyebrow="運用"
        title="画像・ファイル"
        description="公開画面で使う画像を追加できます。利用場所と削除状態も確認できます。"
        meta={
          <div className="flex flex-wrap items-center gap-3">
            <span>{assets.length} 件</span>
            <div className="inline-flex items-center rounded-md border border-stone-200 bg-stone-100 p-0.5 text-xs font-medium">
              <a
                href="/assets"
                aria-current={!showDeleted ? "page" : undefined}
                className={cx(
                  "rounded px-3 py-1.5 transition-colors",
                  !showDeleted ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-700",
                )}
              >
                通常
              </a>
              <a
                href="/assets?deleted=1"
                aria-current={showDeleted ? "page" : undefined}
                className={cx(
                  "rounded px-3 py-1.5 transition-colors",
                  showDeleted ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-700",
                )}
              >
                削除済み
              </a>
            </div>
          </div>
        }
      />

      {identity.role === "editor" ? (
        <p className="mb-4 text-xs text-stone-500">
          編集メンバーは画像の追加と閲覧ができます。削除は管理責任者のみ実行できます。
        </p>
      ) : null}

      <div className="mb-6">
        <Card title="画像を追加" description="JPEG PNG WebPに対応しています">
          <AssetUploadWidget />
        </Card>
      </div>

      {assets.length === 0 ? (
        <EmptyState
          icon={ImageOff}
          title={showDeleted ? "削除済みの画像はありません" : "画像がまだありません"}
          description={showDeleted ? undefined : "上のフォームから画像を追加してください。"}
        />
      ) : (
        <TableShell>
          <THead>
            <Th>プレビュー</Th>
            <Th>形式</Th>
            <Th align="right">サイズ</Th>
            <Th>アップロード者</Th>
            <Th align="right">作成日時</Th>
            <Th>利用場所</Th>
            <Th>状態</Th>
            {identity.role === "owner" ? <Th /> : null}
          </THead>
          <tbody>
            {assets.map((asset) => {
              const usage = usageByAsset.get(asset.id) ?? [];
              const hasUsage = usage.length > 0;
              const status = statusOf(asset);
              const purgeBlockedByUsage = Boolean(asset.deletedAt) && !asset.purgedAt && hasUsage;
              return (
                <Tr key={asset.id}>
                  <Td>
                    {(() => {
                      const webp = asset.variants
                        .filter((variant) => variant.contentType === "image/webp")
                        .sort((left, right) => left.width - right.width)[0];
                      const avif = asset.variants.find(
                        (variant) => variant.contentType === "image/avif" && variant.width === webp?.width,
                      );
                      return (
                        <picture>
                          {avif ? <source type="image/avif" srcSet={avif.publicUrl} /> : null}
                          <img
                            src={webp?.publicUrl ?? asset.publicUrl}
                            alt=""
                            className="h-12 w-16 rounded-md border border-stone-200 object-cover"
                          />
                        </picture>
                      );
                    })()}
                  </Td>
                  <TdMono>{asset.contentType}</TdMono>
                  <TdMono align="right">{formatBytes(asset.byteSize)}</TdMono>
                  <Td>{asset.uploadedByEmail ?? "—"}</Td>
                  <TdMono align="right">{formatDateTime(asset.createdAt)}</TdMono>
                  <Td>
                    {usage.length > 0 ? (
                      <div className="flex flex-col gap-1">
                        {usage.slice(0, 3).map((entry) => (
                          <a
                            key={`${entry.resourceType}-${entry.resourceId}-${entry.usageField}`}
                            href={`/contents/${entry.resourceId}`}
                            className={cx(
                              "inline-flex w-fit items-center gap-1.5 rounded-md border border-stone-200 bg-stone-50 px-2 py-0.5 text-[11px] font-medium hover:border-orange-300 hover:text-orange-700",
                              entry.isActive ? "text-stone-700" : "text-stone-400",
                            )}
                          >
                            {entry.resourceTitle}
                            {!entry.isActive ? (
                              <span className="rounded-sm bg-amber-50 px-1 py-0.5 text-[10px] text-amber-700">
                                非公開
                              </span>
                            ) : null}
                          </a>
                        ))}
                        {usage.length > 3 ? (
                          <span className="text-[11px] text-stone-400">ほか {usage.length - 3} 件</span>
                        ) : null}
                      </div>
                    ) : (
                      <span className="text-stone-400">未使用</span>
                    )}
                  </Td>
                  <Td>
                    <StatusBadge variant={status.variant}>{status.label}</StatusBadge>
                  </Td>
                  {identity.role === "owner" ? (
                    <Td align="right">
                      <div className="flex flex-col items-end gap-1">
                        {!asset.deletedAt && !asset.purgedAt ? (
                          <DeleteAssetButton id={asset.id} mode="delete" />
                        ) : null}
                        {asset.deletedAt && !asset.purgedAt && !hasUsage ? (
                          <DeleteAssetButton id={asset.id} mode="purge" />
                        ) : null}
                        {purgeBlockedByUsage ? (
                          <span
                            title="公開情報で利用中です。利用を解除してから完全削除してください。"
                            className="flex items-center gap-1 text-[11px] text-stone-400"
                          >
                            <Trash2 size={11} aria-hidden="true" />
                            利用中のため削除不可
                          </span>
                        ) : null}
                      </div>
                    </Td>
                  ) : null}
                </Tr>
              );
            })}
          </tbody>
        </TableShell>
      )}
    </div>
  );
}
