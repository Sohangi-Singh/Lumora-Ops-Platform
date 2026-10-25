"use client";

import { useLocale, useTranslations } from "next-intl";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from "recharts";
import { formatINR, formatMonthKey } from "@/lib/format";

const BAR = "#2F5A9E"; // navy-family step that passes the palette validator on white

/** Compact Indian axis label: 351000 → ₹3.5L, 12000000 → ₹1.2Cr */
function compact(v: number) {
  if (v >= 1e7) return `₹${(v / 1e7).toFixed(1)}Cr`;
  if (v >= 1e5) return `₹${(v / 1e5).toFixed(1)}L`;
  if (v >= 1e3) return `₹${Math.round(v / 1e3)}k`;
  return `₹${v}`;
}

function Tip({ active, payload, label, locale }: Partial<TooltipContentProps<number, string>> & { locale: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border bg-white px-3 py-2 text-xs shadow-soft">
      <div className="text-muted-foreground">{formatMonthKey(String(label), locale)}</div>
      <div className="mt-0.5 font-semibold text-navy tabular">{formatINR(Number(payload[0].value ?? 0))}</div>
    </div>
  );
}

export function RevenueChart({ data }: { data: { key: string; amount: number }[] }) {
  const t = useTranslations("admin.dash");
  const locale = useLocale();
  return (
    <div>
      <div className="h-64 w-full" role="img" aria-label={t("revenue")}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }} barCategoryGap="28%">
            <CartesianGrid vertical={false} stroke="#ece8d6" />
            <XAxis
              dataKey="key"
              tickLine={false}
              axisLine={{ stroke: "#d9d2b6" }}
              tick={{ fontSize: 11, fill: "#586274" }}
              tickFormatter={(k: string) => formatMonthKey(k, locale).split(" ")[0]}
              interval={0}
            />
            <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#586274" }} tickFormatter={compact} width={52} />
            <Tooltip cursor={{ fill: "rgba(27,38,59,0.05)" }} content={<Tip locale={locale} />} />
            <Bar dataKey="amount" fill={BAR} radius={[4, 4, 0, 0]} maxBarSize={28} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <details className="mt-2 text-xs text-muted-foreground">
        <summary className="cursor-pointer">{t("revenueTable")}</summary>
        <table className="mt-2 w-full">
          <thead>
            <tr className="text-left">
              <th className="py-1 font-medium">{t("month")}</th>
              <th className="py-1 text-right font-medium">{t("amount")}</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.key} className="border-t border-border/60">
                <td className="py-1">{formatMonthKey(d.key, locale)}</td>
                <td className="py-1 text-right tabular">{formatINR(d.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
