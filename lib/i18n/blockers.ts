import type { Blocker } from "@/lib/workflow/blockers";

type Translate = (key: string, values?: Record<string, string | number>) => string;

/**
 * Localised one-line description of a blocker. `t` is scoped to the root
 * namespace so both blockers.* and docs.types.* keys resolve.
 */
export function describeBlocker(b: Pick<Blocker, "code" | "params">, t: Translate): string {
  const values: Record<string, string | number> = { ...b.params };
  if (typeof b.params.doc === "string") values.doc = t(`docs.types.${b.params.doc}.name`);
  return t(`blockers.${b.code}`, values);
}

/** Where a customer goes to resolve a blocker they own. */
export function customerActionHref(code: Blocker["code"]): string | null {
  switch (code) {
    case "DOC_MISSING":
    case "DOC_REJECTED":
      return "/portal/documents";
    case "QUOTE_AWAITING_ACCEPTANCE":
    case "QUOTE_EXPIRING":
      return "/portal/quote";
    case "ADVANCE_PENDING":
    case "BALANCE_PENDING":
      return "/portal/payments";
    default:
      return null;
  }
}
