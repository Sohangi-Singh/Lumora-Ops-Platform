import "server-only";
import { cache } from "react";
import { db } from "@/lib/db";
import { parseSettings, type Settings } from "./schema";

export const getSettings = cache(async (): Promise<Settings> => {
  const row = await db.settings.findUnique({ where: { id: 1 } });
  return parseSettings(row?.data);
});
