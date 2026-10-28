import { collection, doc, writeBatch } from "firebase/firestore";

import { createViewGate, VIEW_GATE, type GateState, type ViewKind } from "./auditLog";
import { firebase } from "./firebase";

/**
 * Page-view log. Every page an admin opens (and every link that leaves the
 * dashboard) becomes one tiny document in `adminViews`, but written in batches
 * and filtered first, because this is by far the highest-volume log:
 * - the same page again within 5 minutes counts once;
 * - at most 120 entries an hour per tab;
 * - entries wait up to 10 seconds and go out together in one batch, and
 *   whatever is waiting is sent when the tab is hidden or closed.
 */
const FLUSH_MS = 10_000;
/** Firestore allows 500 writes per batch; staying far below keeps each request small. */
const BATCH = 50;

interface QueuedView {
  path: string;
  title: string;
  kind: ViewKind;
  at: number;
}

/** The gate's memory is kept for the life of the tab, so reloading the page can't reset the hourly cap. */
const GATE_KEY = "sta.view-gate";
function loadGate(): GateState | undefined {
  try {
    return JSON.parse(sessionStorage.getItem(GATE_KEY) ?? "null") ?? undefined;
  } catch {
    return undefined;
  }
}
const gate = createViewGate(VIEW_GATE, typeof sessionStorage === "undefined" ? undefined : loadGate(), state => {
  try {
    sessionStorage.setItem(GATE_KEY, JSON.stringify(state));
  } catch {
    // Storage unavailable: the gate still works for this page load.
  }
});
/**
 * Entries not yet confirmed by the server are also kept in this tab's session
 * storage — the ones waiting AND the batch being sent — so a reload (or the tab
 * closing before the commit finishes) doesn't lose them: the next page load in
 * the same tab sends what is left. They are only dropped once the server has
 * acknowledged them, so the worst case is a harmless duplicate line, never a gap.
 */
const QUEUE_KEY = "sta.view-queue";
function loadQueue(): QueuedView[] {
  try {
    const saved = JSON.parse(sessionStorage.getItem(QUEUE_KEY) ?? "[]");
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}
function saveQueue() {
  try {
    sessionStorage.setItem(QUEUE_KEY, JSON.stringify([...sending, ...queue]));
  } catch {
    // Storage unavailable: entries are still sent this page load, just not kept across a reload.
  }
}
const queue: QueuedView[] = typeof sessionStorage === "undefined" ? [] : loadQueue();
/** The batch currently being committed. Stays in storage until the server acknowledges it. */
let sending: QueuedView[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let actor = { id: "", name: "" };

/** Who the entries are written as; set once the signed-in admin's profile is known. */
export function setViewActor(id: string, name: string) {
  actor = { id, name };
  // Leftovers from a page load that ended before they were sent.
  if (id && queue.length > 0 && !timer) timer = setTimeout(() => void flushViews(), 1000);
}

/** Sends everything waiting. Never throws: a lost page-view line is not worth an error. */
export async function flushViews(): Promise<void> {
  if (timer) clearTimeout(timer);
  timer = null;
  const uid = firebase().auth.currentUser?.uid;
  if (!uid || sending.length > 0) return; // one commit at a time, so the same lines can't go out twice
  const batchOf = queue.splice(0, BATCH);
  if (batchOf.length === 0) return;
  sending = batchOf;
  saveQueue();
  try {
    const { db } = firebase();
    const batch = writeBatch(db);
    for (const view of batchOf) {
      batch.set(doc(collection(db, "adminViews")), { actorId: uid, actorName: actor.name, ...view });
    }
    await batch.commit();
    sending = [];
    saveQueue(); // acknowledged: now they can go
  } catch (e) {
    console.warn("[views] page log failed —", e);
    queue.unshift(...batchOf); // put them back for the next try
    sending = [];
    saveQueue();
    return;
  }
  if (queue.length > 0) void flushViews();
}

/** Records a page opened or a link followed, unless the gate says it is a repeat or over the hourly cap. */
export function logView(path: string, title: string, kind: ViewKind = "view", now = Date.now()) {
  if (!actor.id || !gate.allow(`${kind}:${path}`, now)) return;
  queue.push({ path: path.slice(0, 300), title: title.slice(0, 120), kind, at: now });
  saveQueue();
  if (!timer) timer = setTimeout(() => void flushViews(), FLUSH_MS);
}
