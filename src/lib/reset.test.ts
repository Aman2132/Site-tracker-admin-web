import assert from "node:assert/strict";
import { test } from "node:test";

import {
  chunked,
  describeTotals,
  isKeptRole,
  isNothingSelected,
  photosForcedBy,
  photosToDelete,
  selectEverything,
  totalsFor,
  type ResetPreview,
} from "./reset.ts";

const preview: ResetPreview = {
  people: [
    { id: "boss", name: "Boss", email: "b@x.com", appRole: "superadmin", locked: true },
    { id: "adm", name: "Admin", email: "a@x.com", appRole: "owner", locked: true },
    { id: "w1", name: "Worker One", email: "w1@x.com", appRole: "worker", locked: false },
    { id: "w2", name: "Worker Two", email: "w2@x.com", appRole: "worker", locked: false },
    { id: "orphan", name: "", email: "o@x.com", appRole: "none", locked: false },
  ],
  sites: [
    { id: "s1", name: "Tower A", code: "TA" },
    { id: "s2", name: "Tower B", code: "TB" },
  ],
  photos: [
    { id: "p1", thumbUrl: "u1", personId: "w1", siteId: "s1", takenAt: 3 },
    { id: "p2", thumbUrl: "u2", personId: "w2", siteId: "s2", takenAt: 2 },
    { id: "p3", thumbUrl: "u3", personId: "adm", siteId: "", takenAt: 1 },
  ],
  counts: { sessions: 10, inventory: 0, events: 5, views: 2, audit: 7 },
};

test("admin and superadmin roles are the kept ones", () => {
  assert.equal(isKeptRole("owner"), true);
  assert.equal(isKeptRole("superadmin"), true);
  assert.equal(isKeptRole("worker"), false);
  assert.equal(isKeptRole(undefined), false);
});

test("everything starts selected, except the locked accounts and empty groups", () => {
  const selection = selectEverything(preview);

  assert.deepEqual([...selection.people].sort(), ["orphan", "w1", "w2"]);
  assert.deepEqual([...selection.sites].sort(), ["s1", "s2"]);
  assert.equal(selection.photos.size, 3);
  assert.deepEqual([...selection.bulk].sort(), ["audit", "events", "sessions", "views"]);
});

test("a photo of a selected person or site goes whatever its own box says", () => {
  const forced = photosForcedBy(preview, new Set(["w1"]), new Set(["s2"]));

  assert.deepEqual([...forced].sort(), ["p1", "p2"]);
});

test("photos to delete are the ticked ones plus the forced ones, once each", () => {
  const selection = { ...selectEverything(preview), photos: new Set(["p3"]), people: new Set(["w1"]), sites: new Set<string>() };

  assert.deepEqual(photosToDelete(preview, selection).sort(), ["p1", "p3"]);
});

test("totals add up what will go, and unticking everything leaves nothing", () => {
  const all = totalsFor(preview, selectEverything(preview));
  assert.deepEqual(all, { people: 3, sites: 2, photos: 3, records: 24 });
  assert.equal(describeTotals(all), "3 people · 2 sites · 3 photos · 24 other records");

  const none = totalsFor(preview, { people: new Set(), sites: new Set(), photos: new Set(), bulk: new Set() });
  assert.equal(isNothingSelected(none), true);
  assert.equal(describeTotals(none), "");
});

test("chunked splits a list into groups of at most the size", () => {
  assert.deepEqual(chunked([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  assert.deepEqual(chunked([], 3), []);
});
