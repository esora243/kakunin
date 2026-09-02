import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";

type DetailUnavailableProps = {
  title: string;
  message: string;
  backHref: string;
  backLabel: string;
};

/** 詳細が表示できないときの唯一の表現。3 ルート共通で使う。 */
export function DetailUnavailable({ title, message, backHref, backLabel }: DetailUnavailableProps) {
  return (
    <Container as="section" className="py-section" aria-labelledby="detail-unavailable-title">
      <Card className="flex min-h-[50vh] flex-col items-center justify-center p-8 text-center">
        <h1 id="detail-unavailable-title" className="text-h1 font-bold text-primary">
          {title}
        </h1>
        <p className="mb-6 mt-2 text-body text-secondary">{message}</p>
        <ButtonLink href={backHref} prefetch={false}>
          {backLabel}
        </ButtonLink>
      </Card>
    </Container>
  );
}
