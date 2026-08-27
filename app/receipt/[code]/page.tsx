import Link from "next/link";
import { notFound } from "next/navigation";
import { getIssueByCode, supabase } from "../../../lib/db";
import { t } from "../../../lib/i18n";
import { CopyCode } from "./copy-code";

function signOff(language: string) {
  if (language.toLowerCase().startsWith("kn")) return t("jaiHindKannada");
  if (language.toLowerCase().startsWith("hi")) return t("jaiHindHindi");
  return t("jaiHindEnglish");
}

function interimMeasure(category: string) {
  if (category === "electrical") return t("interimElectrical");
  if (category === "structural") return t("interimStructural");
  return t("interimGeneral");
}

export default async function ReceiptPage({ params }: { params: Promise<{ code: string }> }) {
  const { code: rawCode } = await params;
  const issue = await getIssueByCode(rawCode.toUpperCase());
  if (!issue) notFound();

  const { data: report, error } = await supabase
    .from("reports")
    .select("detected_language")
    .eq("issue_id", issue.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);

  const dueDate = new Date(
    new Date(issue.created_at).getTime() + issue.statutory_limit_days * 86_400_000,
  ).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });

  return (
    <main className="min-h-[calc(100vh-8rem)] bg-sand px-4 py-10 text-charcoal sm:px-6">
      <article className="mx-auto max-w-xl rounded border-2 border-indigo p-5 sm:p-8">
        <div className="receipt-mark mx-auto w-28 text-indigo" aria-hidden="true">
          <svg viewBox="0 0 120 120" className="h-auto w-full fill-none stroke-current" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M60 101C53 92 47 83 43 72L34 46C32 40 35 35 40 36C43 37 45 40 47 45L53 60L49 29C48 23 51 19 56 20C59 21 60 24 60 29V57V24C60 18 63 15 67 16C71 17 72 20 71 26L69 58L74 31C75 25 79 22 83 24C87 26 87 30 85 36L78 65L84 49C86 44 90 42 94 45C98 48 96 53 94 58L84 82C80 91 75 97 69 103M60 101C54 95 48 90 42 86L28 76C23 72 18 74 18 79C18 82 20 85 24 88L43 104C49 109 55 111 62 111C72 111 80 106 87 98" />
          </svg>
        </div>

        <p className="mt-4 text-center text-xl font-bold text-indigo">
          {signOff(report?.detected_language ?? "en")}
        </p>
        <h1 className="mt-2 text-center text-3xl font-bold text-indigo">{t("receiptTitle")}</h1>

        <section className="mt-8 border-y-2 border-ochre py-5 text-center">
          <p className="text-sm font-bold uppercase tracking-wide">{t("complaintCode")}</p>
          <p className="mt-2 font-mono text-4xl font-bold tracking-[0.16em] text-indigo sm:text-5xl">
            {issue.code}
          </p>
          <div className="mt-4"><CopyCode code={issue.code} /></div>
        </section>

        <dl className="mt-7 space-y-5">
          <div>
            <dt className="text-sm font-bold text-indigo">{t("routedOffice")}</dt>
            <dd className="mt-1 leading-6">{issue.grievance_authority}</dd>
          </div>
          <div>
            <dt className="text-sm font-bold text-indigo">{t("responseDue")}</dt>
            <dd className="mt-1 font-semibold">{dueDate}</dd>
          </div>
          <div>
            <dt className="text-sm font-bold text-indigo">{t("assignedSeverity")}</dt>
            <dd className="mt-1 font-mono text-xl font-bold">{issue.severity}</dd>
          </div>
        </dl>

        {issue.severity === "S1" && (
          <section className="mt-7 border-l-4 border-rani bg-rani/10 p-4">
            <h2 className="font-bold text-indigo">{t("interimMeasure")}</h2>
            <p className="mt-2 leading-6">{interimMeasure(issue.category)}</p>
          </section>
        )}

        <Link
          href={`/issue/${issue.code}`}
          className="mt-8 flex min-h-12 items-center justify-center rounded bg-indigo px-5 py-3 text-center font-bold text-sand"
        >
          {t("viewPublicIssue")}
          <span className="ml-2 rounded-full border border-sand px-2 py-0.5 text-xs font-bold">
            {t("inProgressMarker")}
          </span>
        </Link>
      </article>
    </main>
  );
}
