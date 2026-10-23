import assert from "node:assert/strict";
import { test } from "node:test";
import {
  classificationOutcomeSchema,
  classificationResultSchema,
} from "../src/lib/analytics/classification";

test("accepts a classified request", () => {
  const result = {
    status: "classified",
    subject: "projects_references",
    intent: "explore_references",
  };

  assert.deepEqual(classificationResultSchema.parse(result), result);
});

test("accepts explicit other categories", () => {
  const result = {
    status: "classified",
    subject: "other",
    intent: "other",
  };

  assert.deepEqual(classificationResultSchema.parse(result), result);
});

test("rejects unknown subjects and intents", () => {
  for (const invalid of [
    {
      status: "classified",
      subject: "unknown_subject",
      intent: "get_information",
    },
    {
      status: "classified",
      subject: "agency_team",
      intent: "unknown_intent",
    },
  ]) {
    assert.equal(classificationResultSchema.safeParse(invalid).success, false);
  }
});

test("requires both categories for a classified request", () => {
  for (const invalid of [
    {
      status: "classified",
      subject: "agency_team",
    },
    {
      status: "classified",
      subject: null,
      intent: "get_information",
    },
    {
      status: "classified",
      subject: "agency_team",
      intent: null,
    },
  ]) {
    assert.equal(classificationResultSchema.safeParse(invalid).success, false);
  }
});

test("requires null categories for an unclassifiable request", () => {
  const result = {
    status: "unclassifiable",
    subject: null,
    intent: null,
  };

  assert.deepEqual(classificationResultSchema.parse(result), result);

  for (const invalid of [
    { ...result, subject: "agency_team" },
    { ...result, intent: "get_information" },
  ]) {
    assert.equal(classificationResultSchema.safeParse(invalid).success, false);
  }
});

test("accepts technical failure only as a server outcome", () => {
  const failure = {
    status: "failed",
    subject: null,
    intent: null,
  };

  assert.equal(classificationResultSchema.safeParse(failure).success, false);

  assert.deepEqual(classificationOutcomeSchema.parse(failure), failure);

  assert.equal(
    classificationOutcomeSchema.safeParse({
      ...failure,
      subject: "agency_team",
    }).success,
    false,
  );
});

test("rejects additional fields in every outcome", () => {
  for (const outcome of [
    {
      status: "classified",
      subject: "agency_team",
      intent: "get_information",
    },
    {
      status: "unclassifiable",
      subject: null,
      intent: null,
    },
    {
      status: "failed",
      subject: null,
      intent: null,
    },
  ]) {
    assert.equal(
      classificationOutcomeSchema.safeParse({
        ...outcome,
        explanation: "Unexpected free text",
      }).success,
      false,
    );
  }
});
