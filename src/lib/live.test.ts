import assert from "node:assert/strict";
import { test } from "node:test";

import { attendanceFor, collapseRepeats, hoursOnDay, overlappingSessionIds } from "./insights.ts";
import { deriveCrew, settleSessions, toEvent, toPhoto } from "./live.ts";
import { filesOf, storagePathFromUrl } from "./photoFiles.ts";
import { DAY, HOUR, MINUTE, TZ_OFFSET, dayStart, fromLocalInput, sessionTimesProblem, toLocalInput } from "./time.ts";

const NOW = Date.UTC(2026, 9, 5, 10, 0);
const person = { id: "p", name: "Pooja", role: "Helper", color: "#a142f4", appRole: "worker" as const };

test("checked in with a fresh fix is online; checked in but silent is idle; checked out is offline", () => {
  const status = (position: object) => deriveCrew([person], { p: position }, NOW)[0].status;
  assert.equal(status({ siteId: "s", lastFixAt: NOW - MINUTE }), "online");
  assert.equal(status({ siteId: "s", lastFixAt: NOW - HOUR }), "idle");
  assert.equal(status({ siteId: "s", lastFixAt: NOW - MINUTE, paused: true }), "idle");
  assert.equal(status({ siteId: null, lastFixAt: NOW - MINUTE }), "offline");
});

test("deactivated and invited beat everything else", () => {
  assert.equal(deriveCrew([{ ...person, active: false }], { p: { siteId: "s", lastFixAt: NOW } }, NOW)[0].status, "deactivated");
  assert.equal(deriveCrew([{ ...person, invitedAt: 1 }], {}, NOW)[0].status, "invited");
  // Once they have reported a position they are no longer just invited.
  assert.equal(deriveCrew([{ ...person, invitedAt: 1 }], { p: { lastFixAt: NOW - HOUR } }, NOW)[0].status, "offline");
});

test("the current site only shows while checked in, and the last position is kept", () => {
  const out = deriveCrew([person], { p: { lat: 1, lng: 2, siteId: null, lastFixAt: NOW } }, NOW)[0];
  assert.equal(out.currentSiteId, undefined);
  assert.deepEqual([out.lat, out.lng], [1, 2]);
});

test("an unclosed session ends at the last fix once the signal is lost", () => {
  const open = [{ id: "a", personId: "p", siteId: "s", start: NOW - 5 * HOUR }];
  const [settled] = settleSessions(open, { p: { lastFixAt: NOW - 2 * HOUR } }, NOW);
  assert.equal(settled.end, NOW - 2 * HOUR);
  assert.equal(settled.endReason, "timeout");
});

test("an unclosed session stays open while fixes keep arriving, and right after check-in", () => {
  const open = [{ id: "a", personId: "p", siteId: "s", start: NOW - 5 * HOUR }];
  assert.equal(settleSessions(open, { p: { lastFixAt: NOW - MINUTE } }, NOW)[0].end, undefined);
  const fresh = [{ id: "b", personId: "p", siteId: "s", start: NOW - MINUTE }];
  assert.equal(settleSessions(fresh, {}, NOW)[0].end, undefined);
});

test("an abandoned session is capped when a newer one exists", () => {
  const sessions = [
    { id: "old", personId: "p", siteId: "s", start: NOW - 30 * HOUR },
    { id: "new", personId: "p", siteId: "s", start: NOW - 2 * HOUR },
  ];
  const old = settleSessions(sessions, { p: { lastFixAt: NOW } }, NOW).find(s => s.id === "old")!;
  assert.equal(old.end, NOW - 30 * HOUR + 12 * HOUR);
});

test("a closed session is left alone", () => {
  const closed = [{ id: "a", personId: "p", siteId: "s", start: 1, end: 2, endReason: "signed-off" as const }];
  assert.deepEqual(settleSessions(closed, {}, NOW), closed);
});

test("old photos without site, size or preview still map", () => {
  const photo = toPhoto("x", { uri: "https://a/b.jpg", takenAt: 5, personId: "p", task: "T", lat: 1, lng: 2, accuracy: 3, plusCode: "C" });
  assert.equal(photo.siteId, "");
  assert.equal(photo.thumbUrl, "https://a/b.jpg");
  assert.deepEqual([photo.width, photo.height], [1600, 1200]);
  assert.equal(photo.note, undefined);
});

test("photo note is kept when present, dropped when blank", () => {
  assert.equal(toPhoto("x", { note: "  Cracked slab  " }).note, "Cracked slab");
  assert.equal(toPhoto("x", { note: "   " }).note, undefined);
});

test("events use the recorded type, else guess from legacy text", () => {
  assert.equal(toEvent("a", { text: "x", kind: "info", type: "checkin", at: 1 }, NOW).kind, "checkin");
  assert.equal(toEvent("b", { text: "Pooja paused sharing", kind: "warn", at: 1 }, NOW).kind, "pause");
  assert.equal(toEvent("c", { text: "3 photos uploaded from Pooja", kind: "info", at: 1 }, NOW).kind, "upload");
  assert.equal(toEvent("d", { text: "mystery", kind: "info", at: null }, NOW).at, NOW);
});

test("days start at midnight Nepal time (UTC+5:45), not India time", () => {
  assert.equal(TZ_OFFSET, 5.75 * HOUR);
  // 18:15 UTC is exactly midnight in Nepal: it is the start of its own day...
  const midnightNepal = Date.UTC(2026, 9, 5, 18, 15);
  assert.equal(dayStart(midnightNepal), midnightNepal);
  // ...and one minute earlier still belongs to the previous Nepal day.
  assert.equal(dayStart(midnightNepal - MINUTE), midnightNepal - DAY);
});

const URL_BASE = "https://abc.supabase.co/storage/v1/object/public/Photos";

test("a photo's files are its original and its thumbnail, found from the record's URLs", () => {
  const photo = { fullUrl: `${URL_BASE}/w1/local-1-abc.jpg`, thumbUrl: `${URL_BASE}/w1/local-1-abc_thumb.jpg` };
  assert.deepEqual(filesOf(photo), ["w1/local-1-abc.jpg", "w1/local-1-abc_thumb.jpg"]);
});

test("a record whose thumbnail is the original (older photos, videos) lists the file once", () => {
  const url = `${URL_BASE}/w1/clip.mp4`;
  assert.deepEqual(filesOf({ fullUrl: url, thumbUrl: url }), ["w1/clip.mp4"]);
});

test("a URL from somewhere else is not mistaken for a file in our bucket", () => {
  assert.equal(storagePathFromUrl("https://example.com/photos/a.jpg"), null);
  assert.deepEqual(filesOf({ fullUrl: "https://example.com/a.jpg", thumbUrl: "https://example.com/a.jpg" }), []);
});

test("encoded characters and cache-busting queries in a URL are resolved to the real path", () => {
  assert.equal(storagePathFromUrl(`${URL_BASE}/w%201/a%20b.jpg?t=123`), "w 1/a b.jpg");
});

import { changesProblem, toCsv, toInventory, totalsByItem } from "./inventory.ts";

const item = (id: string, name: string, quantity: number, unit: string, receivedAt: number) =>
  toInventory(id, { personId: "p", personName: "Ram", siteId: "s", name, quantity, unit, receivedAt });

test("inventory totals group by item and unit, ignoring case and spacing, keeping units apart", () => {
  const totals = totalsByItem([
    item("1", "Cement", 40, "bags", 1),
    item("2", " cement ", 10, "Bags", 2),
    item("3", "Cement", 500, "kg", 3),
    item("4", "Sand", 2.5, "tonne", 4),
  ]);
  assert.deepEqual(
    totals.map(t => [t.name, t.unit, t.quantity, t.deliveries]),
    [
      ["cement", "bags", 50, 2],
      ["Cement", "kg", 500, 1],
      ["Sand", "tonne", 2.5, 1],
    ]
  );
});

test("inventory mapping drops a blank note and keeps edit stamps", () => {
  const e = toInventory("x", { name: "Rebar", quantity: 5, unit: "pcs", note: "  ", editedAt: 9, receivedAt: 1 });
  assert.equal(e.note, undefined);
  assert.equal(e.editedAt, 9);
});

test("owner changes are checked like the rules check them", () => {
  const ok = { siteId: "s", name: "Cement", quantity: 4, unit: "bags" };
  assert.equal(changesProblem(ok), null);
  assert.match(changesProblem({ ...ok, quantity: 0 }) ?? "", /above 0/);
  assert.match(changesProblem({ ...ok, quantity: NaN }) ?? "", /above 0/);
  assert.match(changesProblem({ ...ok, unit: " " }) ?? "", /unit/);
  assert.match(changesProblem({ ...ok, siteId: "" }) ?? "", /site/);
});

test("csv quotes cells with commas, quotes and line breaks", () => {
  assert.equal(toCsv(["a", "b"], [["x,y", 'say "hi"'], ["line\nbreak", 3]]), 'a,b\n"x,y","say ""hi"""\n"line\nbreak",3');
});

test("datetime-local values round-trip in Nepal time", () => {
  assert.equal(toLocalInput(Date.UTC(2026, 9, 5, 3, 15)), "2026-10-05T09:00");
  assert.equal(fromLocalInput("2026-10-05T09:00"), Date.UTC(2026, 9, 5, 3, 15));
  assert.ok(Number.isNaN(fromLocalInput("")));
});

test("a corrected check-out can't come before the check-in", () => {
  assert.equal(sessionTimesProblem(NOW - HOUR, NOW, NOW), null);
  assert.equal(sessionTimesProblem(NOW - HOUR, undefined, NOW), null);
  assert.match(sessionTimesProblem(NOW - HOUR, NOW - 2 * HOUR, NOW) ?? "", /after check-in/);
  assert.match(sessionTimesProblem(NaN, undefined, NOW) ?? "", /check-in/);
  assert.match(sessionTimesProblem(NOW + HOUR, undefined, NOW) ?? "", /future/);
});

test("an admin-closed session is left as it is", () => {
  const edited = [{ id: "a", personId: "p", siteId: "s", start: NOW - 5 * HOUR, end: NOW - 4 * HOUR, endReason: "admin" as const, editedAt: NOW }];
  assert.deepEqual(settleSessions(edited, {}, NOW), edited);
});

test("inventory usage maps from the doc and totals add received, used and left", () => {
  const delivered = toInventory("u", {
    name: "Cement", quantity: 40, unit: "bags", receivedAt: 1, usedQuantity: 15,
    usage: [{ quantity: 10, at: 2, note: " slab " }, { quantity: 5, at: 3 }, { bad: true }],
  });
  assert.deepEqual(delivered.usage, [{ quantity: 10, at: 2, note: "slab" }, { quantity: 5, at: 3, note: undefined }]);
  const [t] = totalsByItem([delivered, toInventory("v", { name: "cement", quantity: 10, unit: "bags", receivedAt: 4 })]);
  assert.deepEqual([t.quantity, t.used, t.left], [50, 15, 35]);
  // Over-logged usage never shows negative stock.
  assert.equal(totalsByItem([toInventory("w", { name: "Sand", quantity: 1, unit: "t", usedQuantity: 3 })])[0].left, 0);
});

test("a phone silent for more than 12 h is offline and off site, even if its last write named a site", () => {
  const out = deriveCrew([person], { p: { siteId: "s", lastFixAt: NOW - 2 * DAY } }, NOW)[0];
  assert.equal(out.status, "offline");
  assert.equal(out.currentSiteId, undefined);
  assert.equal(deriveCrew([person], { p: { siteId: "s", lastFixAt: NOW - 3 * HOUR } }, NOW)[0].status, "idle");
});

test("GPS accuracy is whole metres", () => {
  assert.equal(toPhoto("x", { accuracy: 20.007999420166016 }).accuracy, 20);
  assert.equal(deriveCrew([person], { p: { accuracy: 5.6, lastFixAt: NOW } }, NOW)[0].accuracy, 6);
});

test("overlapping sessions of one person count once and are flagged; different people still add up", () => {
  const s = (id: string, personId: string, start: number, end: number) => ({ id, personId, siteId: "x", start, end });
  const day = dayStart(NOW);
  const twin = [s("a", "p", day + HOUR, day + 3 * HOUR), s("b", "p", day + 2 * HOUR, day + 4 * HOUR)];
  assert.equal(hoursOnDay(twin, day), 3 * HOUR);
  assert.deepEqual([...overlappingSessionIds(twin)].sort(), ["a", "b"]);
  const two = [s("a", "p", day + HOUR, day + 3 * HOUR), s("c", "q", day + HOUR, day + 3 * HOUR)];
  assert.equal(hoursOnDay(two, day), 4 * HOUR);
  assert.equal(overlappingSessionIds(two).size, 0);
});

test("a day over 12 h is flagged as a long shift", () => {
  const day = dayStart(NOW);
  const [cell] = attendanceFor("p", [{ id: "a", personId: "p", siteId: "x", start: day, end: day + 13 * HOUR }], [day]);
  assert.equal(cell.long, true);
});

test("back-to-back repeats fold into one event with a count", () => {
  const e = (id: string, at: number, text: string) => ({ id, at, kind: "pause" as const, personId: "p", text, severity: "info" as const });
  const out = collapseRepeats([e("1", NOW, "paused"), e("2", NOW - MINUTE, "paused"), e("3", NOW - 2 * MINUTE, "paused"), e("4", NOW - 3 * MINUTE, "resumed")]);
  assert.deepEqual(out.map(x => [x.id, x.count]), [["1", 3], ["4", 1]]);
});

import { averageIsFresh, collectionUsage, collectionUsageFromAverage, estimateDocBytes, formatBytes, formatShare, nameBytes, share, valueBytes } from "./usage.ts";

test("firestore value sizes follow the published rules", () => {
  assert.equal(valueBytes("abc"), 4); // utf-8 length + 1
  assert.equal(valueBytes(12345), 8);
  assert.equal(valueBytes(true), 1);
  assert.equal(valueBytes(null), 1);
  assert.equal(valueBytes(["ab", "c"]), 3 + 2);
  assert.equal(valueBytes({ k: "v" }), 1 + 1 + 2); // key + 1, value
  assert.equal(valueBytes({ toMillis: () => 1 }), 16);
  assert.equal(nameBytes("people/abc"), 16 + 7 + 4);
});

test("a document's estimate counts its fields, 32 bytes of overhead and two index entries per small field", () => {
  const path = "sites/s1";
  const name = nameBytes(path);
  assert.equal(estimateDocBytes(path, { n: 1 }), name + (1 + 1 + 8) + 32 + 2 * (name + 2 + 8 + 32));
  // A huge value (a data-URI avatar) is stored but not indexed.
  assert.equal(estimateDocBytes(path, { a: "x".repeat(5000) }), name + (1 + 1 + 5001) + 32);
});

test("collection usage scales a sampled average by the exact count, or reuses a remembered one", () => {
  const sample = [{ path: "x/1", data: { n: 1 } }, { path: "x/2", data: { n: 2 } }];
  const u = collectionUsage("x", 100, sample);
  assert.equal(u.avgBytes, estimateDocBytes("x/1", { n: 1 }));
  assert.equal(u.bytes, Math.round(u.avgBytes * 100));
  assert.equal(collectionUsage("empty", 0, []).bytes, 0);
  const reused = collectionUsageFromAverage("x", 50, 200);
  assert.deepEqual([reused.bytes, reused.sampled], [10_000, 0]);
});

test("a remembered average is reused until the collection doubles or halves", () => {
  const saved = { avgBytes: 300, count: 100 };
  assert.equal(averageIsFresh(saved, 100), true);
  assert.equal(averageIsFresh(saved, 199), true);
  assert.equal(averageIsFresh(saved, 201), false);
  assert.equal(averageIsFresh(saved, 49), false);
  assert.equal(averageIsFresh(undefined, 10), false);
  assert.equal(averageIsFresh(undefined, 0), true); // nothing to sample
});

test("byte and share formatting", () => {
  assert.equal(formatBytes(812), "812 B");
  assert.equal(formatBytes(14_200), "14 KB");
  assert.equal(formatBytes(3_400_000), "3.4 MB");
  assert.equal(formatBytes(520_000_000), "520 MB");
  assert.equal(formatBytes(1_230_000_000), "1.23 GB");
  assert.equal(formatShare(0), "0%");
  assert.equal(formatShare(0.0004), "<0.1%");
  assert.equal(formatShare(0.052), "5.2%");
  assert.equal(formatShare(0.634), "63%");
  assert.equal(share(2_000, 1_000), 1);
});

import { fullestAllowance } from "./usage.ts";

test("the sidebar meter shows whichever allowance is closest to full", () => {
  assert.equal(fullestAllowance(171_000, 659, 21_000_000).key, "files");
  assert.equal(fullestAllowance(900 * 1024 ** 2, 659, 21_000_000).key, "firestore");
  // Photo files not known yet: it can only choose between the other two.
  assert.equal(fullestAllowance(171_000, 659, null).key, "firestore");
  const full = fullestAllowance(0, 0, 1_500_000_000);
  assert.deepEqual([full.key, full.fraction], ["files", 1]);
});

import { AGE_CHOICES, auditLine, chunk, confirmMatches, cutoffFor, findOrphans, sumBytes } from "./cleanup.ts";

test("only files nothing points to, and old enough, are orphans", () => {
  const now = 100 * HOUR;
  const files = [
    { path: "p1/a.jpg", size: 10, createdAt: now - 5 * HOUR },
    { path: "p1/a_thumb.jpg", size: 2, createdAt: now - 5 * HOUR },
    { path: "p1/lost.jpg", size: 7, createdAt: now - 5 * HOUR },
    { path: "p1/uploading.jpg", size: 9, createdAt: now - 10 * MINUTE }, // an upload still being saved
    { path: "p1/undated.jpg", size: 4 }, // age unknown: never touched
  ];
  const referenced = new Set(["p1/a.jpg", "p1/a_thumb.jpg"]);
  const orphans = findOrphans(files, referenced, now);
  assert.deepEqual(orphans.map(f => f.path), ["p1/lost.jpg"]);
  assert.equal(sumBytes(orphans), 7);
});

test("cutoffs, chunking and the typed confirmation", () => {
  assert.equal(cutoffFor(30, 100 * DAY), 70 * DAY);
  assert.ok(AGE_CHOICES.every(d => d >= 30));
  assert.deepEqual(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  assert.deepEqual(chunk([], 3), []);
  assert.equal(confirmMatches("DELETE"), true);
  assert.equal(confirmMatches("  DELETE "), true);
  assert.equal(confirmMatches("delete"), false);
  assert.equal(confirmMatches(""), false);
});

test("the audit line says what, how old and how much", () => {
  assert.equal(
    auditLine({ kind: "photos", deleted: 142, failed: [], remaining: 0 }, 90, "38 MB"),
    "Cleanup: deleted 142 old photos (older than 90 days) — 38 MB"
  );
  assert.equal(auditLine({ kind: "orphans", deleted: 3, failed: [], remaining: 0 }, null, null), "Cleanup: deleted 3 orphan files");
});

import { createViewGate, describeChanges, describeFields, externalTarget, failureReason, listNames, pageTitle, wasRefused } from "./auditLog.ts";

test("only the fields that really changed are described, as before → after", () => {
  assert.equal(
    describeChanges([
      { label: "name", before: "Alpha", after: "Alpha 2" },
      { label: "status", before: "planning", after: "planning" },
      { label: "active", before: true, after: false },
      { label: "sites", before: ["A"], after: ["A", "B"] },
      { label: "manager", before: "", after: "Ram" },
    ]),
    'name: "Alpha" → "Alpha 2"; active: yes → no; sites: "A" → "A", "B"; manager: — → "Ram"'
  );
  assert.equal(describeChanges([{ label: "x", before: 1, after: 1 }]), undefined);
  assert.ok((describeChanges([{ label: "x", before: "a", after: "b".repeat(5000) }]) ?? "").length <= 1000);
});

test("created and deleted records are described by what they held", () => {
  assert.equal(describeFields([{ label: "item", value: "Cement" }, { label: "note", value: "" }, { label: "qty", value: 40 }]), 'item: "Cement"; qty: 40');
  assert.equal(describeFields([{ label: "a", value: undefined }]), undefined);
  assert.equal(listNames(["a", "b"]), "a, b");
  assert.equal(listNames(["a", "b", "c", "d", "e", "f", "g"]), "a, b, c, d, e and 2 more");
});

test("failures are worded and told apart from refusals", () => {
  assert.equal(failureReason(new Error("Network down")), "Network down");
  assert.equal(failureReason("odd"), "Something went wrong.");
  assert.equal(wasRefused({ code: "permission-denied", message: "x" }), true);
  assert.equal(wasRefused(new Error("Only the superadmin can run a cleanup.")), true);
  assert.equal(wasRefused(new Error("Cleanup failed (403).")), true);
  assert.equal(wasRefused(new Error("Network down")), false);
});

test("page titles and outbound links", () => {
  assert.equal(pageTitle("/"), "Overview");
  assert.equal(pageTitle("/crew/abc123"), "Crew profile");
  assert.equal(pageTitle("/crew"), "Crew");
  assert.equal(pageTitle("/storage"), "Storage");
  assert.equal(pageTitle("/something-else"), "/something-else");
  assert.equal(externalTarget("https://maps.google.com/?q=1,2&token=x", "http://localhost:3000"), "maps.google.com/");
  assert.equal(externalTarget("/photos", "http://localhost:3000"), null);
  assert.equal(externalTarget("http://localhost:3000/crew", "http://localhost:3000"), null);
  assert.equal(externalTarget("mailto:a@b.c", "http://localhost:3000"), null);
});

test("the page-view gate drops quick repeats and caps the hourly volume", () => {
  const gate = createViewGate({ dedupeMs: 5 * MINUTE, maxPerHour: 3 });
  const t0 = 1_000_000_000;
  assert.equal(gate.allow("/crew", t0), true);
  assert.equal(gate.allow("/crew", t0 + MINUTE), false); // same page again within 5 minutes
  assert.equal(gate.allow("/photos", t0 + MINUTE), true); // different page
  assert.equal(gate.allow("/crew", t0 + 6 * MINUTE), true); // 5 minutes passed
  assert.equal(gate.allow("/sites", t0 + 7 * MINUTE), false); // hourly cap of 3 reached
  assert.equal(gate.allow("/sites", t0 + 61 * MINUTE), true); // a new hour
});

test("the gate's memory survives a reload, so a reload loop cannot dodge the hourly cap", () => {
  let saved: Parameters<typeof createViewGate>[1];
  const first = createViewGate({ dedupeMs: 5 * MINUTE, maxPerHour: 2 }, undefined, state => (saved = state));
  const t0 = 2_000_000_000;
  assert.equal(first.allow("view:/a", t0), true);
  assert.equal(first.allow("view:/b", t0 + 1), true);
  // "Reload": a brand-new gate restored from what the first one saved.
  const second = createViewGate({ dedupeMs: 5 * MINUTE, maxPerHour: 2 }, saved);
  assert.equal(second.allow("view:/a", t0 + 2 * MINUTE), false); // still a repeat
  assert.equal(second.allow("view:/c", t0 + 2 * MINUTE), false); // cap of 2 already used
});
