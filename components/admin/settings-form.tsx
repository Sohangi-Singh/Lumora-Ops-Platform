"use client";

import { Loader2, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { NativeSelect } from "@/components/shared/form";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useErrorText } from "@/hooks/use-error-text";
import { saveSettingsAction } from "@/lib/actions/admin";
import type { Settings } from "@/lib/settings/schema";

type Kind = "number" | "text" | "lines" | "bool" | "method" | "cities";
const LAYOUT: { section: keyof Settings; fields: [string, Kind][] }[] = [
  { section: "sizing", fields: ["panelWattage", "unitsPerKwPerDay", "sqmPerKwpMin", "sqmPerKwp", "roundingStepKw", "minSystemKw", "maxMonthsForAverage", "minMonthsForAverage"].map((k) => [k, "number"]) },
  { section: "gst", fields: ["goodsSharePct", "goodsRatePct", "servicesSharePct", "servicesRatePct"].map((k) => [k, "number"]) },
  { section: "subsidy", fields: ["centralPerKwFirst2", "centralThirdKw", "centralCap", "stateAmount"].map((k) => [k, "number"]) },
  { section: "economics", fields: ["exportTariffPerUnit", "defaultTariffPerUnit", "panelDegradationPctPerYear", "analysisYears"].map((k) => [k, "number"]) },
  { section: "payment", fields: [["advancePct", "number"], ["balancePct", "number"]] },
  {
    section: "quote",
    fields: [
      ["validityDays", "number"],
      ["completionDays", "number"],
      ["earthingCount", "number"],
      ["dcCableSlackPct", "number"],
      ["basicPerWpMethod", "method"],
      ["includeSavingsPage", "bool"],
    ],
  },
  { section: "terms", fields: [["paymentTerms", "lines"], ["generalTerms", "lines"]] },
  { section: "bank", fields: ["accountName", "bankName", "accountNumber", "accountType", "ifsc"].map((k) => [k, "text"]) },
  { section: "signatory", fields: ["name", "designation", "phone", "email"].map((k) => [k, "text"]) },
  { section: "company", fields: [["supportPhone", "text"], ["supportEmail", "text"]] },
  { section: "cityCodes", fields: [["lines", "cities"]] },
  { section: "letterhead", fields: ["marginTop", "marginBottom", "marginLeft", "marginRight"].map((k) => [k, "number"]) },
  { section: "sla", fields: ["surveyDueDays", "quoteApprovalHours", "slaRiskDaysRemaining"].map((k) => [k, "number"]) },
];

type Draft = Record<string, Record<string, string | boolean>>;

function toDraft(s: Settings): Draft {
  const d: Draft = {};
  for (const { section, fields } of LAYOUT) {
    d[section] = {};
    for (const [k, kind] of fields) {
      if (kind === "cities") d[section][k] = s.cityCodes.map((c) => `${c.code} | ${c.name} | ${c.state}`).join("\n");
      else {
        const v = (s[section] as Record<string, unknown>)[k];
        d[section][k] = kind === "lines" ? (v as string[]).join("\n") : kind === "bool" ? Boolean(v) : String(v);
      }
    }
  }
  return d;
}

function fromDraft(d: Draft): unknown {
  const out: Record<string, unknown> = {};
  for (const { section, fields } of LAYOUT) {
    if (section === "cityCodes") {
      out.cityCodes = String(d.cityCodes.lines)
        .split("\n")
        .map((l) => l.split("|").map((x) => x.trim()))
        .filter((p) => p[0])
        .map(([code, name, state]) => ({ code: code.toUpperCase(), name: name ?? code, state: state ?? "" }));
      continue;
    }
    const sec: Record<string, unknown> = {};
    for (const [k, kind] of fields) {
      const v = d[section][k];
      sec[k] =
        kind === "number"
          ? Number(v)
          : kind === "lines"
            ? String(v)
                .split("\n")
                .map((l) => l.trim())
                .filter(Boolean)
            : v;
    }
    out[section] = sec;
  }
  return out;
}

export function SettingsForm({ settings }: { settings: Settings }) {
  const t = useTranslations("admin.settings");
  const router = useRouter();
  const errorText = useErrorText();
  const [draft, setDraft] = useState<Draft>(() => toDraft(settings));
  const [pending, start] = useTransition();
  const set = (section: string, k: string, v: string | boolean) => setDraft((d) => ({ ...d, [section]: { ...d[section], [k]: v } }));
  const label = (section: string, k: string) => t(`f.${section}.${k}` as Parameters<typeof t>[0]);

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await saveSettingsAction(fromDraft(draft));
          if (!res.ok) return void toast.error(res.error.fieldErrors ? Object.entries(res.error.fieldErrors).map(([k, v]) => `${k}: ${v[0]}`).join("; ") : errorText(res.error));
          toast.success(t("saved"));
          router.refresh();
        });
      }}
    >
      <div className="grid gap-5 lg:grid-cols-2">
        {LAYOUT.map(({ section, fields }) => (
          <Card key={section} className={`gap-3 p-5 ${section === "terms" || section === "cityCodes" ? "lg:col-span-2" : ""}`}>
            <h3 className="font-semibold text-navy">{t(`sections.${section}` as Parameters<typeof t>[0])}</h3>
            <div className={`grid gap-3 ${section === "terms" ? "" : "sm:grid-cols-2"}`}>
              {fields.map(([k, kind]) => {
                const id = `${section}-${k}`;
                const v = draft[section][k];
                return (
                  <label key={k} htmlFor={id} className={kind === "lines" || kind === "cities" ? "sm:col-span-2" : kind === "bool" ? "flex items-center gap-2 self-end pb-2" : ""}>
                    {kind !== "bool" ? <span className="mb-1 block text-xs font-medium text-muted-foreground">{label(section, k)}</span> : null}
                    {kind === "number" ? (
                      <Input id={id} inputMode="decimal" className="tabular" value={String(v)} onChange={(e) => set(section, k, e.target.value)} />
                    ) : kind === "text" ? (
                      <Input id={id} value={String(v)} onChange={(e) => set(section, k, e.target.value)} />
                    ) : kind === "lines" || kind === "cities" ? (
                      <Textarea id={id} rows={kind === "cities" ? 3 : 8} value={String(v)} onChange={(e) => set(section, k, e.target.value)} className="font-mono text-xs" />
                    ) : kind === "method" ? (
                      <NativeSelect id={id} value={String(v)} onChange={(e) => set(section, k, e.target.value)}>
                        <option value="SPLIT_OF_INCLUSIVE">{t("methods.SPLIT_OF_INCLUSIVE")}</option>
                        <option value="BLENDED_RATE">{t("methods.BLENDED_RATE")}</option>
                      </NativeSelect>
                    ) : (
                      <>
                        <input id={id} type="checkbox" checked={Boolean(v)} onChange={(e) => set(section, k, e.target.checked)} className="size-5 accent-[var(--navy)]" />
                        <span className="text-sm">{label(section, k)}</span>
                      </>
                    )}
                  </label>
                );
              })}
            </div>
          </Card>
        ))}
      </div>
      <div className="sticky bottom-20 flex justify-end lg:bottom-4">
        <Button type="submit" size="lg" disabled={pending} className="shadow-soft">
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Save className="size-4" aria-hidden />}
          {t("save")}
        </Button>
      </div>
    </form>
  );
}
