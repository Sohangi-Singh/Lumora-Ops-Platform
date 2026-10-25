"use client";

import { ArrowLeft, ArrowRight, CheckCircle2, CircleAlert, CloudOff, Loader2, Save, Wifi } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { LocationMapLazy } from "@/components/shared/location-map-lazy";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { useErrorText } from "@/hooks/use-error-text";
import { usePhotoQueue } from "@/hooks/use-photo-queue";
import { deletePhotoAction, startSurveyAction, submitSurveyAction } from "@/lib/actions/field";
import type { GeoFix } from "@/lib/client/geo-photo";
import { clearDraft, loadDraft, saveDraft } from "@/lib/client/offline-store";
import { missingSurveyItems, roofAreaSqm, type SurveyDraft, type SurveyFields } from "@/lib/survey/requirements";
import { cn } from "@/lib/utils";
import { PhotoCapture, type ServerPhoto } from "./photo-capture";

const STEPS = ["roof", "shadow", "distances", "electrical", "photo", "review"] as const;
type NumKey = "roofLengthM" | "roofWidthM" | "buildingHeightM" | "roofToMeterVerticalM" | "roofToMeterHorizontalM" | "panelToInverterVerticalM" | "panelToInverterHorizontalM" | "inverterToMeterM";

export function SurveyForm({
  projectId,
  initial,
  serverPhotos,
  started,
  customerLabel,
}: {
  projectId: string;
  initial: SurveyDraft;
  serverPhotos: ServerPhoto[];
  started: boolean;
  customerLabel: string;
}) {
  const t = useTranslations("survey");
  const tc = useTranslations("common");
  const router = useRouter();
  const errorText = useErrorText();
  const queue = usePhotoQueue(projectId);
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<SurveyDraft>(initial);
  const [numText, setNumText] = useState<Record<NumKey, string>>({} as Record<NumKey, string>);
  const [hydrated, setHydrated] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [fix, setFix] = useState<GeoFix | null>(null);
  const [pending, start] = useTransition();
  const startedRef = useRef(started);

  // Restore the on-device draft (it wins over server state: it's newer by definition).
  useEffect(() => {
    void loadDraft(projectId).then((d) => {
      const fields = (d?.fields ?? {}) as SurveyDraft;
      const merged = { ...initial, ...fields };
      setDraft(merged);
      setNumText(
        Object.fromEntries(
          (["roofLengthM", "roofWidthM", "buildingHeightM", "roofToMeterVerticalM", "roofToMeterHorizontalM", "panelToInverterVerticalM", "panelToInverterHorizontalM", "inverterToMeterM"] as NumKey[]).map(
            (k) => [k, merged[k] != null ? String(merged[k]) : ""],
          ),
        ) as Record<NumKey, string>,
      );
      if (d) setStep(Math.min(d.step, STEPS.length - 1));
      setHydrated(true);
    });
  }, [projectId, initial]);

  // Autosave every change to IndexedDB (debounced).
  useEffect(() => {
    if (!hydrated) return;
    const id = setTimeout(() => {
      void saveDraft({ projectId, fields: draft, step, updatedAt: Date.now() }).then(() => setSavedAt(Date.now()));
    }, 400);
    return () => clearTimeout(id);
  }, [draft, step, hydrated, projectId]);

  // Mark the survey as started on first interaction (fire-and-forget; works offline later).
  const ensureStarted = () => {
    if (startedRef.current) return;
    startedRef.current = true;
    void startSurveyAction(projectId);
  };

  const set = <K extends keyof SurveyFields>(k: K, v: SurveyDraft[K]) => {
    ensureStarted();
    setDraft((d) => ({ ...d, [k]: v }));
  };
  const setNum = (k: NumKey, raw: string) => {
    const cleaned = raw.replace(",", ".").replace(/[^\d.]/g, "");
    setNumText((s) => ({ ...s, [k]: cleaned }));
    const n = cleaned === "" ? null : Number(cleaned);
    set(k, n !== null && Number.isFinite(n) ? n : null);
  };

  const photoCounts = useMemo(() => {
    const roofServer = serverPhotos.filter((p) => p.kind === "SURVEY_ROOF" && p.lat != null).length;
    const shadowServer = serverPhotos.filter((p) => p.kind === "SURVEY_SHADOW").length;
    const roofQueued = queue.items.filter((q) => q.kind === "SURVEY_ROOF" && q.lat != null).length;
    const shadowQueued = queue.items.filter((q) => q.kind === "SURVEY_SHADOW").length;
    return { roofGeo: roofServer + roofQueued, shadow: shadowServer + shadowQueued };
  }, [serverPhotos, queue.items]);

  const missing = missingSurveyItems(draft, photoCounts);
  const area = roofAreaSqm(draft.roofLengthM, draft.roofWidthM);
  const geoPhoto = serverPhotos.find((p) => p.kind === "SURVEY_ROOF" && p.lat != null);
  const gps = fix ?? (geoPhoto?.lat != null && geoPhoto.lng != null ? { lat: geoPhoto.lat, lng: geoPhoto.lng, accuracy: 0, at: new Date() } : null);

  const submit = () =>
    start(async () => {
      if (!gps) return void toast.error(t("missing.geoPhoto"));
      const res = await submitSurveyAction({
        projectId,
        fields: draft as SurveyFields,
        gps: { lat: gps.lat, lng: gps.lng, accuracy: gps.accuracy || null, capturedAt: gps.at.toISOString() },
      });
      if (!res.ok) return void toast.error(errorText(res.error));
      await clearDraft(projectId);
      toast.success(t("submitted"));
      router.push("/worker");
      router.refresh();
    });

  const numberField = (k: NumKey, labelKey: Parameters<typeof t>[0]) => (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-navy">{t(labelKey)}</span>
      <Input
        inputMode="decimal"
        enterKeyHint="next"
        className="h-14 text-lg tabular"
        value={numText[k] ?? ""}
        onChange={(e) => setNum(k, e.target.value)}
        aria-invalid={missing.includes(k) && step === STEPS.length - 1}
      />
    </label>
  );

  const choice = <V extends string | boolean>(value: V | null | undefined, options: { v: V; label: string }[], onPick: (v: V) => void) => (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="radiogroup">
      {options.map((o) => (
        <button
          key={String(o.v)}
          type="button"
          role="radio"
          aria-checked={value === o.v}
          onClick={() => onPick(o.v)}
          className={cn(
            "min-h-14 rounded-xl border-2 px-3 text-base font-medium transition-colors",
            value === o.v ? "border-navy bg-navy text-white" : "border-border bg-white text-navy hover:border-navy/40",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );

  const stepKey = STEPS[step];
  const stampLabel = `Lumora Solar survey · ${customerLabel}`;

  return (
    <div className="mx-auto max-w-xl pb-28">
      <div className="mb-4 space-y-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{t("progress", { current: step + 1, total: STEPS.length })} · {t(`steps.${stepKey}`)}</span>
          <span className="flex items-center gap-1.5">
            {queue.online ? <Wifi className="size-3.5 text-success" aria-hidden /> : <CloudOff className="size-3.5 text-warning" aria-hidden />}
            {savedAt ? (
              <span className="flex items-center gap-1">
                <Save className="size-3" aria-hidden />
                {queue.online ? t("saved") : t("savedOffline")}
              </span>
            ) : queue.online ? (
              t("online")
            ) : (
              t("offline")
            )}
          </span>
        </div>
        <Progress value={((step + 1) / STEPS.length) * 100} />
        <div className="flex gap-1 overflow-x-auto pb-1">
          {STEPS.map((s, i) => (
            <button
              key={s}
              type="button"
              onClick={() => setStep(i)}
              className={cn(
                "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium",
                i === step ? "bg-navy text-white" : "bg-white text-muted-foreground ring-1 ring-border",
              )}
            >
              {t(`steps.${s}`)}
            </button>
          ))}
        </div>
      </div>

      <Card className="gap-5 p-5">
        {stepKey === "roof" ? (
          <>
            {numberField("roofLengthM", "fields.roofLengthM")}
            {numberField("roofWidthM", "fields.roofWidthM")}
            {area ? <p className="rounded-xl bg-gold-soft px-3 py-2 text-sm font-medium text-navy tabular">{t("fields.roofArea", { area })}</p> : null}
            <div>
              <span className="mb-1.5 block text-sm font-medium text-navy">{t("fields.roofType")}</span>
              {choice(draft.roofType, (["RCC", "TIN", "OTHER"] as const).map((v) => ({ v, label: t(`roofTypes.${v}`) })), (v) => set("roofType", v))}
            </div>
            {numberField("buildingHeightM", "fields.buildingHeightM")}
          </>
        ) : null}

        {stepKey === "shadow" ? (
          <>
            <div>
              <span className="mb-1.5 block text-sm font-medium text-navy">{t("fields.southShadowFree")}</span>
              {choice(
                draft.southShadowFree,
                [
                  { v: true, label: tc("yes") },
                  { v: false, label: tc("no") },
                ],
                (v) => set("southShadowFree", v),
              )}
            </div>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-navy">{t("fields.shadowNotes")}</span>
              <Textarea rows={3} value={draft.shadowNotes ?? ""} onChange={(e) => set("shadowNotes", e.target.value || null)} />
            </label>
            <PhotoCapture
              kind="SURVEY_SHADOW"
              label={t("fields.shadowPhoto")}
              geo={false}
              stampLabel={stampLabel}
              serverPhotos={serverPhotos}
              queue={queue.items}
              onEnqueue={async (...args) => {
                ensureStarted();
                await queue.enqueue(...args);
              }}
              onDiscardQueued={queue.discard}
              onDeleteServer={async (id) => {
                const r = await deletePhotoAction(id);
                if (!r.ok) toast.error(errorText(r.error));
                router.refresh();
              }}
            />
          </>
        ) : null}

        {stepKey === "distances" ? (
          <>
            <p className="text-sm text-muted-foreground">{t("hints.distances")}</p>
            {numberField("roofToMeterVerticalM", "fields.roofToMeterVerticalM")}
            {numberField("roofToMeterHorizontalM", "fields.roofToMeterHorizontalM")}
            {numberField("panelToInverterVerticalM", "fields.panelToInverterVerticalM")}
            {numberField("panelToInverterHorizontalM", "fields.panelToInverterHorizontalM")}
            {numberField("inverterToMeterM", "fields.inverterToMeterM")}
          </>
        ) : null}

        {stepKey === "electrical" ? (
          <>
            <div>
              <span className="mb-1.5 block text-sm font-medium text-navy">{t("fields.phaseObserved")}</span>
              {choice(draft.phaseObserved, (["SINGLE", "THREE"] as const).map((v) => ({ v, label: t(`phase.${v}`) })), (v) => set("phaseObserved", v))}
            </div>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-navy">{t("fields.notes")}</span>
              <Textarea rows={4} value={draft.notes ?? ""} onChange={(e) => set("notes", e.target.value || null)} />
            </label>
          </>
        ) : null}

        {stepKey === "photo" ? (
          <>
            <p className="text-sm text-muted-foreground">{t("hints.photo")}</p>
            <PhotoCapture
              kind="SURVEY_ROOF"
              label={t("fields.geoPhoto")}
              geo
              stampLabel={stampLabel}
              serverPhotos={serverPhotos}
              queue={queue.items}
              onEnqueue={async (...args) => {
                ensureStarted();
                await queue.enqueue(...args);
              }}
              onDiscardQueued={queue.discard}
              onFix={setFix}
              onDeleteServer={async (id) => {
                const r = await deletePhotoAction(id);
                if (!r.ok) toast.error(errorText(r.error));
                router.refresh();
              }}
            />
            {gps ? (
              <div className="space-y-1.5">
                <span className="text-sm font-medium text-navy">{t("map")}</span>
                <LocationMapLazy lat={gps.lat} lng={gps.lng} accuracy={gps.accuracy || null} />
                {gps.accuracy ? <p className="text-xs text-muted-foreground">{t("gps.accuracy", { m: Math.round(gps.accuracy) })}</p> : null}
              </div>
            ) : null}
          </>
        ) : null}

        {stepKey === "review" ? (
          missing.length ? (
            <div>
              <h3 className="mb-2 flex items-center gap-2 font-semibold text-navy">
                <CircleAlert className="size-5 text-gold-ink" aria-hidden />
                {t("missingTitle")}
              </h3>
              <ul className="space-y-1.5">
                {missing.map((m) => (
                  <li key={m}>
                    <button
                      type="button"
                      className="w-full rounded-xl bg-cream px-3 py-2.5 text-left text-sm text-navy hover:bg-cream-deep"
                      onClick={() =>
                        setStep(
                          m === "geoPhoto"
                            ? 4
                            : m === "shadowPhoto" || m === "southShadowFree" || m === "shadowNotes"
                              ? 1
                              : m === "phaseObserved"
                                ? 3
                                : m.includes("To")
                                  ? 2
                                  : 0,
                        )
                      }
                    >
                      {t(`missing.${m}`)} →
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="flex items-center gap-2 rounded-xl bg-success-soft px-3 py-3 text-sm font-medium text-success">
              <CheckCircle2 className="size-5" aria-hidden />
              {t("allSet")}
            </p>
          )
        ) : null}
      </Card>

      <div className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-border bg-white/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-xl gap-2">
          <Button type="button" variant="outline" size="lg" className="h-14 flex-1 text-base" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
            <ArrowLeft className="size-5" aria-hidden />
          </Button>
          {step < STEPS.length - 1 ? (
            <Button type="button" size="lg" className="h-14 flex-[3] text-base" onClick={() => setStep((s) => s + 1)}>
              {t(`steps.${STEPS[step + 1]}`)}
              <ArrowRight className="size-5" aria-hidden />
            </Button>
          ) : (
            <Button
              type="button"
              size="lg"
              className="h-14 flex-[3] text-base"
              disabled={pending || missing.length > 0 || queue.pendingCount > 0 || !queue.online}
              onClick={submit}
            >
              {pending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <CheckCircle2 className="size-5" aria-hidden />}
              {queue.pendingCount > 0 ? t("pendingUploads") : pending ? t("submitting") : t("submit")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
