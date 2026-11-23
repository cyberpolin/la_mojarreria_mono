import assert from "node:assert/strict";
import test from "node:test";
import { parsePublicationRuleInput } from "./publicationRuleInput.js";
import { selectPublicationRule } from "./replyPolicy.js";
import type { PublicationRule } from "./types.js";

function rule(overrides: Partial<PublicationRule>): PublicationRule {
  return {
    id: "rule",
    pageId: "111",
    enabled: true,
    matchAllPosts: false,
    postIds: ["111_999"],
    keywords: [],
    replyText: "Gracias",
    topLevelOnly: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

test("matches a publication by the post id tail and skips other posts", () => {
  const selected = selectPublicationRule({
    rules: [rule({})],
    pageId: "111",
    postId: "999",
    parentId: "999",
    message: "hola",
  });
  const missed = selectPublicationRule({
    rules: [rule({})],
    pageId: "111",
    postId: "111_1000",
    parentId: null,
    message: "hola",
  });

  assert.equal(selected?.id, "rule");
  assert.equal(missed, null);
});

test("prefers a specific publication over a page-wide rule", () => {
  const selected = selectPublicationRule({
    rules: [
      rule({
        id: "all",
        matchAllPosts: true,
        postIds: [],
        replyText: "general",
        createdAt: "2026-01-01T00:00:00.000Z",
      }),
      rule({
        id: "specific",
        postIds: ["999"],
        replyText: "specific",
        createdAt: "2026-02-01T00:00:00.000Z",
      }),
    ],
    pageId: "111",
    postId: "111_999",
    parentId: "111_999",
    message: "info",
  });

  assert.equal(selected?.id, "specific");
});

test("requires a keyword and ignores nested replies when asked", () => {
  const rules = [
    rule({
      keywords: ["precio"],
      topLevelOnly: true,
    }),
  ];

  assert.equal(
    selectPublicationRule({
      rules,
      pageId: "111",
      postId: "111_999",
      parentId: "111_999",
      message: "Cual es el Precio?",
    })?.replyText,
    "Gracias",
  );
  assert.equal(
    selectPublicationRule({
      rules,
      pageId: "111",
      postId: "111_999",
      parentId: "111_999",
      message: "horario",
    }),
    null,
  );
  assert.equal(
    selectPublicationRule({
      rules,
      pageId: "111",
      postId: "111_999",
      parentId: "c_parent",
      message: "precio",
    }),
    null,
  );
});

test("rejects a rule that does not name a publication", () => {
  assert.throws(
    () =>
      parsePublicationRuleInput({
        pageId: "111",
        replyText: "Hola",
        postIds: [],
      }),
    /at least one publication/,
  );
});
