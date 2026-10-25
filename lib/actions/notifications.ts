"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/authz";
import { db } from "@/lib/db";
import { runAction } from "@/lib/result";

export async function markAllNotificationsReadAction() {
  return runAction(async () => {
    const user = await requireUser();
    await db.notification.updateMany({ where: { userId: user.id, read: false }, data: { read: true } });
    revalidatePath("/", "layout");
  });
}
