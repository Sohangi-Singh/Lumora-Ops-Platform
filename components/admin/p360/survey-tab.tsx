import { getLocale, getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/shared/empty-state";
import { LocationMapLazy } from "@/components/shared/location-map-lazy";
import { StatusChip } from "@/components/shared/status-chip";
import { Card } from "@/components/ui/card";
import type { Project360 } from "@/lib/admin/data";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { estimateCables } from "@/lib/solar/bom";
import { getSettings } from "@/lib/settings";

export async function SurveyTab({ data }: { data: Project360 }) {
  const t = await getTranslations("survey");
  const ta = await getTranslations("admin.assign");
  const locale = await getLocale();
  const s = data.project.survey;
  if (!s) return <EmptyState title={ta("title")} description={t("missing.geoPhoto")} />;
  const [photos, settings] = await Promise.all([
    db.photo.findMany({ where: { surveyId: s.id, uploaded: true }, orderBy: { createdAt: "asc" } }),
    getSettings(),
  ]);
  const cables = estimateCables(s, settings.quote.dcCableSlackPct);
  const m = (v: number | null | undefined) => (v == null ? "—" : `${v} m`);
  const rows: [string, string][] = [
    [t("fields.roofLengthM"), m(s.roofLengthM)],
    [t("fields.roofWidthM"), m(s.roofWidthM)],
    [t("fields.roofArea", { area: s.roofAreaSqm ?? "—" }), ""],
    [t("fields.roofType"), s.roofType ? t(`roofTypes.${s.roofType}`) : "—"],
    [t("fields.buildingHeightM"), m(s.buildingHeightM)],
    [t("fields.southShadowFree"), s.southShadowFree == null ? "—" : s.southShadowFree ? "✓" : "✕"],
    [t("fields.shadowNotes"), s.shadowNotes ?? "—"],
    [t("fields.roofToMeterVerticalM"), m(s.roofToMeterVerticalM)],
    [t("fields.roofToMeterHorizontalM"), m(s.roofToMeterHorizontalM)],
    [t("fields.panelToInverterVerticalM"), m(s.panelToInverterVerticalM)],
    [t("fields.panelToInverterHorizontalM"), m(s.panelToInverterHorizontalM)],
    [t("fields.inverterToMeterM"), m(s.inverterToMeterM)],
    [t("fields.phaseObserved"), s.phaseObserved ? t(`phase.${s.phaseObserved}`) : "—"],
    [t("fields.notes"), s.notes ?? "—"],
    ["DC / AC / earthing cable (est.)", `${cables.dcRunM ?? "—"} / ${cables.acRunM ?? "—"} / ${cables.earthingRunM ?? "—"} m`],
  ];
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card className="gap-3 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold text-navy">{s.worker.name}</h3>
          <StatusChip tone={s.status === "SUBMITTED" ? "success" : "info"}>{ta(`status.${s.status}`)}</StatusChip>
        </div>
        <p className="text-xs text-muted-foreground">
          {formatDateTime(s.scheduledAt, locale)}
          {s.submittedAt ? ` → ${formatDateTime(s.submittedAt, locale)}` : ""}
        </p>
        <dl className="divide-y divide-border/60 text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 py-2">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="text-right font-medium tabular">{v}</dd>
            </div>
          ))}
        </dl>
      </Card>
      <div className="space-y-5">
        {s.lat != null && s.lng != null ? (
          <Card className="gap-2 p-4">
            <h3 className="font-semibold text-navy">{t("map")}</h3>
            <LocationMapLazy lat={s.lat} lng={s.lng} accuracy={s.gpsAccuracy} className="h-64 w-full rounded-xl" />
            <p className="text-xs text-muted-foreground tabular">
              {s.lat.toFixed(6)}, {s.lng.toFixed(6)}
              {s.gpsAccuracy ? ` · ±${Math.round(s.gpsAccuracy)} m` : ""}
            </p>
          </Card>
        ) : null}
        <Card className="gap-3 p-4">
          <h3 className="font-semibold text-navy">{t("photos", { n: photos.length })}</h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {photos.map((p) => (
              <a key={p.id} href={`/api/photos/${p.id}`} target="_blank" rel="noopener" className="group relative aspect-square overflow-hidden rounded-xl bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/photos/${p.id}`} alt={p.kind} loading="lazy" className="size-full object-cover transition-transform group-hover:scale-105" />
                <span className="absolute bottom-1 left-1 rounded bg-navy/80 px-1.5 py-0.5 text-[10px] text-white">
                  {p.kind === "SURVEY_ROOF" ? t("fields.geoPhoto") : t("fields.shadowPhoto")}
                </span>
              </a>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
