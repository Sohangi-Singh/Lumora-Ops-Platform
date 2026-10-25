"use client";

import { openDB, type DBSchema, type IDBPDatabase } from "idb";

/**
 * On-device storage for field work: survey drafts and a persistent photo
 * upload queue. Survives reloads, app switches and lost signal on rooftops.
 */

export type QueuedPhotoKind = "SURVEY_ROOF" | "SURVEY_SHADOW" | "INSTALL_BEFORE" | "INSTALL_AFTER";

export type QueuedPhoto = {
  id: string;
  projectId: string;
  kind: QueuedPhotoKind;
  blob: Blob;
  mimeType: string;
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  takenAt: string;
  caption: string | null;
  status: "queued" | "uploading" | "done" | "failed";
  photoId?: string;
  error?: string;
  createdAt: number;
};

export type SurveyDraftRecord = {
  projectId: string;
  fields: Record<string, unknown>;
  step: number;
  updatedAt: number;
};

interface FieldDB extends DBSchema {
  drafts: { key: string; value: SurveyDraftRecord };
  uploads: { key: string; value: QueuedPhoto; indexes: { byProject: string } };
}

let dbPromise: Promise<IDBPDatabase<FieldDB>> | null = null;

function fieldDb() {
  dbPromise ??= openDB<FieldDB>("lumora-field", 1, {
    upgrade(db) {
      db.createObjectStore("drafts", { keyPath: "projectId" });
      db.createObjectStore("uploads", { keyPath: "id" }).createIndex("byProject", "projectId");
    },
  });
  return dbPromise;
}

export async function loadDraft(projectId: string): Promise<SurveyDraftRecord | undefined> {
  try {
    return await (await fieldDb()).get("drafts", projectId);
  } catch {
    return undefined;
  }
}

export async function saveDraft(record: SurveyDraftRecord): Promise<void> {
  try {
    await (await fieldDb()).put("drafts", record);
  } catch {
    // Private mode / storage full: the form still works, just without persistence.
  }
}

export async function clearDraft(projectId: string): Promise<void> {
  try {
    await (await fieldDb()).delete("drafts", projectId);
  } catch {
    /* ignore */
  }
}

export async function listQueued(projectId: string): Promise<QueuedPhoto[]> {
  try {
    const items = await (await fieldDb()).getAllFromIndex("uploads", "byProject", projectId);
    return items.sort((a, b) => a.createdAt - b.createdAt);
  } catch {
    return [];
  }
}

export async function putQueued(item: QueuedPhoto): Promise<void> {
  await (await fieldDb()).put("uploads", item);
}

export async function deleteQueued(id: string): Promise<void> {
  await (await fieldDb()).delete("uploads", id);
}
