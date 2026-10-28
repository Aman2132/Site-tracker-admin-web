import { get, ref } from "firebase/database";
import { collection, getCountFromServer, getDocs, limit, query } from "firebase/firestore";

import { firebase } from "./firebase";
import {
  averageIsFresh,
  collectionUsage,
  collectionUsageFromAverage,
  valueBytes,
  type CollectionUsage,
} from "./usage";

/** The collections the app uses. The audit log is superadmin-only, so a plain admin sees it as unavailable. */
const COLLECTIONS = ["people", "sites", "sessions", "photos", "events", "inventory", "adminAudit", "adminViews", "pushTokens"];
/** Documents read per collection to average their size. */
const SAMPLE = 10;
/** Where the last measured average sizes are kept, so a refresh usually costs only the counts. */
const CACHE_KEY = "storage-usage-averages-v1";

type Averages = Record<string, { avgBytes: number; count: number }>;

function readAverages(): Averages {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) ?? "{}") as Averages;
  } catch {
    return {};
  }
}

function saveAverages(usage: CollectionUsage[]) {
  try {
    const next: Averages = {};
    for (const c of usage) if (!c.unavailable && c.avgBytes > 0) next[c.name] = { avgBytes: c.avgBytes, count: c.count };
    localStorage.setItem(CACHE_KEY, JSON.stringify(next));
  } catch {
    // A private window or full storage just means the next refresh re-samples.
  }
}

export interface FirebaseUsage {
  collections: CollectionUsage[];
  firestoreBytes: number;
  realtimeBytes: number;
  /** Documents this snapshot cost to read: one per count (more past 1,000 documents) plus any samples. */
  reads: number;
}

/**
 * Counts every collection exactly (cheap aggregation reads). A collection's
 * average size is re-sampled only the first time or when its size changed a
 * lot; otherwise the remembered average is reused, so a refresh is ~8 reads.
 */
export async function loadFirebaseUsage(): Promise<FirebaseUsage> {
  const { db, rtdb } = firebase();
  const saved = readAverages();
  let reads = 0;
  const collections = await Promise.all(
    COLLECTIONS.map(async (name): Promise<CollectionUsage> => {
      try {
        const count = (await getCountFromServer(collection(db, name))).data().count;
        reads += Math.max(1, Math.ceil(count / 1000));
        if (count > 0 && averageIsFresh(saved[name], count)) {
          return collectionUsageFromAverage(name, count, saved[name].avgBytes);
        }
        const docs = await getDocs(query(collection(db, name), limit(SAMPLE)));
        reads += docs.size;
        return collectionUsage(
          name,
          count,
          docs.docs.map(d => ({ path: `${name}/${d.id}`, data: d.data() }))
        );
      } catch (e) {
        // Expected for the audit log when a plain admin looks; anything else is worth seeing in the console.
        console.warn(`[usage] couldn't read ${name} —`, e);
        return { name, count: 0, avgBytes: 0, bytes: 0, sampled: 0, unavailable: true };
      }
    })
  );
  saveAverages(collections);
  // Positions are one small record per person; the whole node is read once.
  const positions = (await get(ref(rtdb, "positions"))).val() ?? {};
  return {
    collections,
    firestoreBytes: collections.reduce((sum, c) => sum + c.bytes, 0),
    realtimeBytes: valueBytes(positions),
    reads,
  };
}

export interface PhotoFilesUsage {
  files: number;
  bytes: number;
}

/** Exact size of the photo files, asked of the dashboard's own server route. */
export async function loadPhotoFilesUsage(): Promise<PhotoFilesUsage> {
  const user = firebase().auth.currentUser;
  if (!user) throw new Error("Sign in again.");
  const response = await fetch("/api/usage", { headers: { authorization: `Bearer ${await user.getIdToken()}` } });
  const data = (await response.json().catch(() => ({}))) as Partial<PhotoFilesUsage> & { error?: string };
  if (!response.ok) throw new Error(data.error ?? `Couldn't read photo storage (${response.status}).`);
  return { files: data.files ?? 0, bytes: data.bytes ?? 0 };
}
