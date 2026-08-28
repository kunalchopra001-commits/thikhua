import { t } from "../../../lib/i18n";

export default function DepartmentNotFound() {
  return <main className="min-h-[calc(100vh-8rem)] bg-sand px-4 py-12 text-charcoal"><section className="mx-auto max-w-xl rounded border-2 border-stone p-6 text-center"><h1 className="text-3xl font-bold text-indigo">{t("deptBlockNotFound")}</h1><p className="mt-3">{t("deptBlockNotFoundBody")}</p></section></main>;
}
