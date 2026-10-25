"use client";

import { ImagePlus, Loader2, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Field, NativeSelect } from "@/components/shared/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useErrorText } from "@/hooks/use-error-text";
import { finalizePhotoUploadAction, requestPhotoUploadAction } from "@/lib/actions/field";
import { createTicketAction } from "@/lib/actions/tickets";
import { compressIfImage, effectiveMime, uploadWithRetry } from "@/lib/client/upload";

const CATEGORIES = ["NO_GENERATION", "INVERTER", "CLEANING", "DAMAGE", "NET_METER", "OTHER"] as const;

export function TicketForm() {
  const t = useTranslations("support");
  const router = useRouter();
  const errorText = useErrorText();
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("NO_GENERATION");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [pending, start] = useTransition();

  const submit = () =>
    start(async () => {
      const res = await createTicketAction({ category, description });
      if (!res.ok) return void toast.error(errorText(res.error));
      for (const original of files.slice(0, 3)) {
        const file = await compressIfImage(original);
        const mime = effectiveMime(file);
        const r = await requestPhotoUploadAction({ projectId: res.data.projectId, kind: "TICKET", mimeType: mime as "image/jpeg", size: file.size, ticketId: res.data.ticketId });
        if (!r.ok) continue;
        try {
          await uploadWithRetry({ ...r.data, file, contentType: mime, onProgress: () => undefined });
          await finalizePhotoUploadAction(r.data.photoId);
        } catch {
          toast.error(errorText({ code: "UPLOAD_FAILED" }));
        }
      }
      toast.success(t("submitted"));
      setDescription("");
      setFiles([]);
      router.refresh();
    });

  return (
    <div className="space-y-3">
      <Field id="cat" label={t("category")}>
        <NativeSelect id="cat" value={category} onChange={(e) => setCategory(e.target.value as typeof category)}>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {t(`categories.${c}`)}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field id="desc" label={t("description")}>
        <Textarea id="desc" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} />
      </Field>
      <Field id="photos" label={t("photos")}>
        <label htmlFor="photos" className="flex h-11 cursor-pointer items-center gap-2 rounded-xl border border-dashed border-input bg-white px-3 text-sm text-muted-foreground">
          <ImagePlus className="size-4" aria-hidden />
          {files.length ? files.map((f) => f.name).join(", ") : t("photos")}
        </label>
        <Input id="photos" type="file" accept="image/*" multiple className="sr-only" onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, 3))} />
      </Field>
      <Button size="lg" className="w-full sm:w-auto" disabled={pending || description.trim().length < 5} onClick={submit}>
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Send className="size-4" aria-hidden />}
        {t("submit")}
      </Button>
    </div>
  );
}
