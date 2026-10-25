"use client";

import { CreditCard, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useErrorText } from "@/hooks/use-error-text";
import { createOrderAction, reportCheckoutFailureAction, verifyCheckoutAction } from "@/lib/actions/payments";

type RazorpaySuccess = { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string };
type RazorpayFailure = { error: { description?: string; reason?: string } };
type RazorpayInstance = { open(): void; on(event: "payment.failed", cb: (r: RazorpayFailure) => void): void };
declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance;
  }
}

const SCRIPT = "https://checkout.razorpay.com/v1/checkout.js";

function loadCheckout(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT}"]`);
    const el = existing ?? Object.assign(document.createElement("script"), { src: SCRIPT, async: true });
    el.addEventListener("load", () => resolve(), { once: true });
    el.addEventListener("error", () => reject(new Error("Checkout failed to load")), { once: true });
    if (!existing) document.body.appendChild(el);
  });
}

export function RazorpayButton({ milestone, amountLabel, description }: { milestone: "ADVANCE" | "BALANCE"; amountLabel: string; description: string }) {
  const t = useTranslations("payments");
  const router = useRouter();
  const errorText = useErrorText();
  const [state, setState] = useState<"idle" | "opening" | "verifying">("idle");

  async function pay() {
    setState("opening");
    try {
      await loadCheckout();
    } catch {
      setState("idle");
      return void toast.error(errorText({ code: "UPLOAD_FAILED" }));
    }
    const order = await createOrderAction(milestone);
    if (!order.ok) {
      setState("idle");
      return void toast.error(order.error.code === "NOT_CONFIGURED" ? t("notConfigured") : errorText(order.error));
    }
    const { orderId, amount, keyId, prefill } = order.data;
    const rzp = new window.Razorpay!({
      key: keyId,
      order_id: orderId,
      amount: amount * 100,
      currency: "INR",
      name: "Lumora Solar",
      description,
      image: `${window.location.origin}/brand/mark.png`,
      prefill,
      theme: { color: "#1B263B" },
      modal: {
        ondismiss: () => {
          setState((s) => (s === "verifying" ? s : "idle"));
          toast.info(t("cancelled"));
        },
      },
      handler: async (r: RazorpaySuccess) => {
        setState("verifying");
        const res = await verifyCheckoutAction({ orderId: r.razorpay_order_id, paymentId: r.razorpay_payment_id, signature: r.razorpay_signature });
        setState("idle");
        if (!res.ok) return void toast.error(errorText(res.error));
        toast.success(t("success"));
        router.refresh();
      },
    });
    rzp.on("payment.failed", (r) => {
      const reason = r.error.description ?? r.error.reason ?? "unknown";
      void reportCheckoutFailureAction({ orderId, reason });
      toast.error(t("failed", { reason }));
    });
    rzp.open();
    setState((s) => (s === "opening" ? "idle" : s));
  }

  return (
    <Button size="lg" className="h-12 w-full text-base" disabled={state !== "idle"} onClick={() => void pay()}>
      {state === "idle" ? <CreditCard className="size-5" aria-hidden /> : <Loader2 className="size-5 animate-spin" aria-hidden />}
      {state === "verifying" ? t("verifying") : state === "opening" ? t("loading") : t("payRazorpay", { amount: amountLabel })}
    </Button>
  );
}
