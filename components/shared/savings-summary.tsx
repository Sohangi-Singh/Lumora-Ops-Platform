import { getTranslations } from "next-intl/server";
import { formatINR, formatIndianNumber } from "@/lib/format";
import type { EconomicsResult } from "@/lib/solar/economics";

/** Customer economics: cost → subsidy → net cost, yearly savings, payback, lifetime. */
export async function SavingsSummary({ e, exportRate }: { e: EconomicsResult; exportRate: number }) {
  const t = await getTranslations("savings");
  const Row = ({ label, value, detail, strong }: { label: string; value: string; detail?: string; strong?: boolean }) => (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <div>
        <div className={strong ? "font-semibold text-navy" : "text-sm text-foreground"}>{label}</div>
        {detail ? <div className="text-xs text-muted-foreground">{detail}</div> : null}
      </div>
      <div className={`shrink-0 text-right tabular ${strong ? "text-lg font-semibold text-navy" : "font-medium"}`}>{value}</div>
    </div>
  );
  return (
    <div>
      <div className="divide-y divide-border/70">
        <Row label={t("cost")} value={formatINR(e.grossCost)} />
        <Row
          label={t("subsidy")}
          value={`− ${formatINR(e.totalSubsidy)}`}
          detail={t("subsidyDetail", { central: formatIndianNumber(e.centralSubsidy), state: formatIndianNumber(e.stateSubsidy) })}
        />
        <Row label={t("netCost")} value={formatINR(e.netCost)} strong />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-gold-soft p-3">
          <div className="text-xs text-gold-ink">{t("yearly")}</div>
          <div className="mt-0.5 text-lg font-semibold text-navy tabular">{formatINR(e.yearlyBenefit)}</div>
          <div className="text-[11px] text-muted-foreground">{t("yearlyDetail", { units: formatIndianNumber(e.yearlyGenerationUnits) })}</div>
        </div>
        <div className="rounded-xl bg-cream p-3">
          <div className="text-xs text-muted-foreground">{t("payback")}</div>
          <div className="mt-0.5 text-lg font-semibold text-navy tabular">{e.paybackYears ? t("years", { n: e.paybackYears.toFixed(1) }) : "—"}</div>
          <div className="text-[11px] text-muted-foreground">
            {t("lifetime", { n: e.lifetimeYears })}: {formatINR(e.lifetimeSavings)}
          </div>
        </div>
      </div>
      {e.surplusUnits > 0 ? <p className="mt-3 text-xs text-muted-foreground">{t("export", { rate: exportRate })}: {formatINR(e.yearlyExportCredit)}</p> : null}
      <p className="mt-2 text-xs text-muted-foreground">{t("loan")}</p>
      <p className="mt-1 text-[11px] text-muted-foreground/80">{t("estimate")}</p>
    </div>
  );
}
