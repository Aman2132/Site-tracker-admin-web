import assert from "node:assert/strict";
import { test } from "node:test";

import { deriveCrew, settleSessions, toEvent, toPhoto } from "./live.ts";
import { HOUR, MINUTE } from "./time.ts";

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
});

test("events use the recorded type, else guess from legacy text", () => {
  assert.equal(toEvent("a", { text: "x", kind: "info", type: "checkin", at: 1 }, NOW).kind, "checkin");
  assert.equal(toEvent("b", { text: "Pooja paused sharing", kind: "warn", at: 1 }, NOW).kind, "pause");
  assert.equal(toEvent("c", { text: "3 photos uploaded from Pooja", kind: "info", at: 1 }, NOW).kind, "upload");
  assert.equal(toEvent("d", { text: "mystery", kind: "info", at: null }, NOW).at, NOW);
});
