import { Circle } from "lucide-react";

type AdminAccessContractCopyProps = {
  className?: string;
  variant?: "denied" | "overview";
};

const bulletClassName = "flex gap-2";

export function AdminAccessContractCopy({ className, variant = "overview" }: AdminAccessContractCopyProps) {
  const isDenied = variant === "denied";

  return (
    <div className={className}>
      {isDenied ? (
        <p className="max-w-md text-sm text-stone-500">
          管理画面を利用するにはGoogleアカウントでのログインと運営メンバーへの登録が必要です。
          アクセスできない場合は管理責任者へ連絡してください。
        </p>
      ) : (
        <div className="space-y-2 text-sm text-stone-500">
          <p>
            Googleアカウントで本人確認を行います。運営メンバーの設定によって利用できる機能が決まります。
          </p>
          <ul className="space-y-1">
            <li className={bulletClassName}>
              <Circle size={5} className="mt-1.5 shrink-0 fill-current" aria-hidden="true" />
              <span>
                Googleアカウントでログインしても運営メンバーに登録されていない場合は利用できません。
              </span>
            </li>
            <li className={bulletClassName}>
              <Circle size={5} className="mt-1.5 shrink-0 fill-current" aria-hidden="true" />
              <span>
                運営メンバーに登録されていてもGoogleアカウントでのログインが必要です。
              </span>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
