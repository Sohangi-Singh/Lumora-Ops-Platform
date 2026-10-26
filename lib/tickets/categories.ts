/** AMC service-request categories (labels live in messages: support.categories.*). */
export const TICKET_CATEGORIES = ["NO_GENERATION", "INVERTER", "CLEANING", "DAMAGE", "NET_METER", "OTHER"] as const;
export type TicketCategory = (typeof TICKET_CATEGORIES)[number];
