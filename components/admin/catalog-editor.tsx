"use client";

import { Loader2, Plus, Save, Trash2 } from "lucide-react";
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
import { saveCatalogAction, savePricingAction } from "@/lib/actions/admin";

export type CatalogRow = {
  id: string | null;
  sortOrder: number;
  category: string;
  description: string;
  specification: string;
  make: string;
  warranty: string;
  unit: string;
  qtyRule: "PANEL_COUNT" | "ONE" | "EARTHING" | "FIXED" | "TEXT";
  fixedQty: number | null;
  qtyText: string | null;
  isActive: boolean;
};

export function CatalogEditor({ items }: { items: CatalogRow[] }) {
  const t = useTranslations("admin.settings");
  const router = useRouter();
  const errorText = useErrorText();
  const [rows, setRows] = useState(items);
  const [pending, start] = useTransition();
  const upd = (i: number, patch: Partial<CatalogRow>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{t("catalogHint")}</p>
      {rows.map((r, i) => (
        <Card key={r.id ?? `new-${i}`} className={`gap-3 p-4 ${r.isActive ? "" : "opacity-60"}`}>
          <div className="grid grid-cols-[64px_1fr_auto] items-center gap-2">
            <Input aria-label={t("col.sortOrder")} inputMode="numeric" value={String(r.sortOrder)} onChange={(e) => upd(i, { sortOrder: Number(e.target.value) || 0 })} />
            <Input aria-label={t("col.category")} value={r.category} onChange={(e) => upd(i, { category: e.target.value.toUpperCase() })} />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={r.isActive} onChange={(e) => upd(i, { isActive: e.target.checked })} className="size-4 accent-[var(--navy)]" />
              {t("active")}
            </label>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            {(["description", "specification", "make", "warranty"] as const).map((k) => (
              <label key={k}>
                <span className="mb-1 block text-xs text-muted-foreground">{t(`col.${k}`)}</span>
                <Textarea rows={2} value={r[k]} onChange={(e) => upd(i, { [k]: e.target.value })} className="text-sm" />
              </label>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <label>
              <span className="mb-1 block text-xs text-muted-foreground">{t("col.unit")}</span>
              <Input value={r.unit} onChange={(e) => upd(i, { unit: e.target.value })} />
            </label>
            <label>
              <span className="mb-1 block text-xs text-muted-foreground">{t("qtyRule")}</span>
              <NativeSelect value={r.qtyRule} onChange={(e) => upd(i, { qtyRule: e.target.value as CatalogRow["qtyRule"] })}>
                {["PANEL_COUNT", "ONE", "EARTHING", "FIXED", "TEXT"].map((q) => (
                  <option key={q} value={q}>
                    {q}
                  </option>
                ))}
              </NativeSelect>
            </label>
            {r.qtyRule === "FIXED" ? (
              <label>
                <span className="mb-1 block text-xs text-muted-foreground">{t("fixedQty")}</span>
                <Input inputMode="numeric" value={String(r.fixedQty ?? "")} onChange={(e) => upd(i, { fixedQty: e.target.value ? Number(e.target.value) : null })} />
              </label>
            ) : null}
            {r.qtyRule === "TEXT" ? (
              <label>
                <span className="mb-1 block text-xs text-muted-foreground">{t("qtyText")}</span>
                <Input value={r.qtyText ?? ""} onChange={(e) => upd(i, { qtyText: e.target.value })} />
              </label>
            ) : null}
          </div>
        </Card>
      ))}
      <div className="flex flex-wrap justify-between gap-2">
        <Button
          variant="outline"
          onClick={() =>
            setRows((rs) => [
              ...rs,
              { id: null, sortOrder: rs.length + 1, category: "OTHER", description: "", specification: "", make: "", warranty: "", unit: "", qtyRule: "TEXT", fixedQty: null, qtyText: "As per Requirement", isActive: true },
            ])
          }
        >
          <Plus className="size-4" aria-hidden />
          {t("addRow")}
        </Button>
        <Button
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await saveCatalogAction(rows);
              if (!res.ok) return void toast.error(errorText(res.error));
              toast.success(t("saved"));
              router.refresh();
            })
          }
        >
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Save className="size-4" aria-hidden />}
          {t("saveCatalog")}
        </Button>
      </div>
    </div>
  );
}

export type SlabRow = { id: string | null; minKw: number; maxKw: number; ratePerKwInclGst: number; phase: "SINGLE" | "THREE" | null; isActive: boolean };

export function PricingEditor({ slabs }: { slabs: SlabRow[] }) {
  const t = useTranslations("admin.settings");
  const tp = useTranslations("admin.bill.phase");
  const router = useRouter();
  const errorText = useErrorText();
  const [rows, setRows] = useState(slabs);
  const [pending, start] = useTransition();
  const upd = (i: number, patch: Partial<SlabRow>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <Card className="gap-3 p-5">
      <div className="hidden grid-cols-[1fr_1fr_1.4fr_1.2fr_auto_auto] gap-2 text-xs text-muted-foreground md:grid">
        <span>{t("minKw")}</span>
        <span>{t("maxKw")}</span>
        <span>{t("rate")}</span>
        <span />
        <span>{t("active")}</span>
        <span />
      </div>
      {rows.map((r, i) => (
        <div key={r.id ?? `n${i}`} className="grid grid-cols-2 gap-2 md:grid-cols-[1fr_1fr_1.4fr_1.2fr_auto_auto] md:items-center">
          <Input aria-label={t("minKw")} inputMode="decimal" value={String(r.minKw)} onChange={(e) => upd(i, { minKw: Number(e.target.value) || 0 })} />
          <Input aria-label={t("maxKw")} inputMode="decimal" value={String(r.maxKw)} onChange={(e) => upd(i, { maxKw: Number(e.target.value) || 0 })} />
          <Input aria-label={t("rate")} inputMode="numeric" className="tabular" value={String(r.ratePerKwInclGst)} onChange={(e) => upd(i, { ratePerKwInclGst: Number(e.target.value.replace(/\D/g, "")) || 0 })} />
          <NativeSelect value={r.phase ?? ""} onChange={(e) => upd(i, { phase: (e.target.value || null) as SlabRow["phase"] })}>
            <option value="">{t("phaseAny")}</option>
            <option value="SINGLE">{tp("SINGLE")}</option>
            <option value="THREE">{tp("THREE")}</option>
          </NativeSelect>
          <input type="checkbox" aria-label={t("active")} checked={r.isActive} onChange={(e) => upd(i, { isActive: e.target.checked })} className="size-5 accent-[var(--navy)]" />
          <Button variant="ghost" size="icon" aria-label={t("remove")} onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}>
            <Trash2 className="size-4" />
          </Button>
        </div>
      ))}
      <div className="flex justify-between gap-2">
        <Button variant="outline" onClick={() => setRows((rs) => [...rs, { id: null, minKw: 1, maxKw: 10, ratePerKwInclGst: 70200, phase: null, isActive: true }])}>
          <Plus className="size-4" aria-hidden />
          {t("addRow")}
        </Button>
        <Button
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await savePricingAction(rows);
              if (!res.ok) return void toast.error(errorText(res.error));
              toast.success(t("saved"));
              router.refresh();
            })
          }
        >
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Save className="size-4" aria-hidden />}
          {t("savePricing")}
        </Button>
      </div>
    </Card>
  );
}
