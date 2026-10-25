import "server-only";
import { after } from "next/server";
import { sendEmail, type EmailMessage } from "@/lib/notify/email";
import { broadcastRefresh } from "@/lib/realtime/server";

/**
 * Side effects collected during a DB transaction and run only after it
 * commits — so a rolled-back transaction never pings a browser or sends mail.
 */
export class Effects {
  private topics = new Set<string>();
  private emails: EmailMessage[] = [];
  private tasks: (() => Promise<unknown>)[] = [];

  broadcast(...topics: string[]) {
    for (const t of topics) this.topics.add(t);
  }

  email(msg: EmailMessage) {
    this.emails.push(msg);
  }

  /** Slow follow-up work (PDF generation, AI extraction) run after the response. */
  later(task: () => Promise<unknown>) {
    this.tasks.push(task);
  }

  async flush(): Promise<void> {
    const emails = this.emails;
    const tasks = this.tasks;
    await broadcastRefresh(this.topics).catch((e) => console.warn("[effects] broadcast", e));
    const background = async () => {
      for (const task of tasks) {
        try {
          await task();
        } catch (err) {
          console.error("[effects] background task failed", err);
        }
      }
      await Promise.all(emails.map((m) => sendEmail(m)));
    };
    if (!emails.length && !tasks.length) return;
    try {
      after(background);
    } catch {
      // Outside a request scope (scripts/tests): run inline.
      await background();
    }
  }
}
