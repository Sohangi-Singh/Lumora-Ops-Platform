import { z } from "zod";
import { normalizeIndianMobile } from "@/lib/format";

export const mobileSchema = z
  .string()
  .transform(normalizeIndianMobile)
  .pipe(z.string().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit mobile number"));

export const LoginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(200),
});

export const RegisterSchema = z.object({
  salutation: z.enum(["Mr.", "Ms."]),
  name: z.string().trim().min(2).max(100),
  phone: mobileSchema,
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(8).max(200),
  addressLine1: z.string().trim().min(3).max(200),
  addressLine2: z.string().trim().max(200).optional().default(""),
  cityCode: z.string().regex(/^[A-Z]{3}$/),
  pincode: z.string().trim().regex(/^\d{6}$/, "Enter a 6-digit PIN code"),
  consent: z.literal("on", { message: "Consent is required" }),
});
export type RegisterInput = z.infer<typeof RegisterSchema>;
