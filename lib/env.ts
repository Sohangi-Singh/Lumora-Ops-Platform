import "server-only";

/**
 * Central, typed access to server env vars. Optional integrations expose a
 * feature flag instead of throwing, so the app keeps working without them
 * (manual bill entry, no emails, offline payments only).
 */
function read(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() !== "" ? v.trim() : undefined;
}

function required(name: string): string {
  const v = read(name);
  if (!v) throw new Error(`Missing required environment variable ${name}. See .env.example.`);
  return v;
}

export const env = {
  get supabaseUrl() {
    return required("NEXT_PUBLIC_SUPABASE_URL");
  },
  get supabaseAnonKey() {
    return required("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  },
  get supabaseServiceRoleKey() {
    return required("SUPABASE_SERVICE_ROLE_KEY");
  },
  get appUrl() {
    return read("NEXT_PUBLIC_APP_URL") ?? "http://localhost:3000";
  },
  anthropic: {
    get apiKey() {
      return read("ANTHROPIC_API_KEY");
    },
    get model() {
      return read("ANTHROPIC_MODEL");
    },
    get enabled() {
      return Boolean(read("ANTHROPIC_API_KEY") && read("ANTHROPIC_MODEL"));
    },
  },
  gemini: {
    get apiKey() {
      return read("GEMINI_API_KEY");
    },
    get model() {
      return read("GEMINI_MODEL") ?? "gemini-3.5-flash-lite";
    },
    get enabled() {
      return Boolean(read("GEMINI_API_KEY"));
    },
  },
  razorpay: {
    get keyId() {
      return read("RAZORPAY_KEY_ID");
    },
    get keySecret() {
      return read("RAZORPAY_KEY_SECRET");
    },
    get webhookSecret() {
      return read("RAZORPAY_WEBHOOK_SECRET");
    },
    get enabled() {
      return Boolean(read("RAZORPAY_KEY_ID") && read("RAZORPAY_KEY_SECRET"));
    },
  },
  resend: {
    get apiKey() {
      return read("RESEND_API_KEY");
    },
    get from() {
      return read("RESEND_FROM") ?? "Lumora Solar <onboarding@resend.dev>";
    },
  },
};
