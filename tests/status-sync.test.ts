import assert from "node:assert/strict";
import { test } from "node:test";
import { invalidateReviewStatus, statusEpoch, subscribeReviewStatus } from "../client/status-sync.ts";

test("status invalidation notifies subscribers and advances epoch", () => {
  const before = statusEpoch();
  let calls = 0;
  const stop = subscribeReviewStatus(() => { calls++; });
  invalidateReviewStatus();
  assert.equal(calls, 1);
  assert.equal(statusEpoch(), before + 1);
  stop();
  invalidateReviewStatus();
  assert.equal(calls, 1);
  assert.equal(statusEpoch(), before + 2);
});
