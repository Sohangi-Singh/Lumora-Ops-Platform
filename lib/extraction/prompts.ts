/** Shared instructions for every vision provider (Claude, Gemini). */
export const SYSTEM = `You read Indian electricity documents for a rooftop-solar company in Chhattisgarh.
Documents are CSPDCL (Chhattisgarh State Power Distribution Company) LT bills, which are bilingual
Hindi/English, or screenshots of the CSPDCL mobile app's consumption history.
Copy values exactly as printed. Never guess: use null for anything missing, blank or unreadable,
and lower your confidence accordingly. Months are YYYY-MM. Units are kWh. Money is in rupees.`;

export const PROMPT_BILL = `Extract the bill fields. For monthlyConsumption include the bill month (from बिल अवधि, using
विद्युत खपत / कुल खपत) and every row of the "विगत 6 रीडिंग का ब्यौरा" table (वाचन माह → विद्युत खपत).`;
export const PROMPT_HISTORY = `This should be a consumption-history screenshot. Extract every month and its units into
monthlyConsumption; fill the service number if visible; leave other bill fields null.`;
