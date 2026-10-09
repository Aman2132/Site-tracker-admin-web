import assert from "node:assert/strict";
import { test } from "node:test";

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
