import { randomUUID } from "node:crypto";
import { readJson, withFileLock, writeJson } from "../jsonStore.js";
import { parsePublicationRuleInput } from "../publicationRuleInput.js";
import type { PublicationRule } from "../types.js";

type RuleFile = {
  rules: PublicationRule[];
};

export class PublicationRuleStoreError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "PublicationRuleStoreError";
    this.status = status;
  }
}

export async function listPublicationRules(
  filePath: string,
): Promise<PublicationRule[]> {
  const data = await readJson<RuleFile>(filePath, { rules: [] });
  return data.rules;
}

export async function createPublicationRule(
  filePath: string,
  input: unknown,
): Promise<PublicationRule> {
  let parsed: ReturnType<typeof parsePublicationRuleInput>;
  try {
    parsed = parsePublicationRuleInput(input);
  } catch (error) {
    throw new PublicationRuleStoreError(
      error instanceof Error ? error.message : "Invalid publication rule",
    );
  }

  return withFileLock(filePath, async () => {
    const data = await readJson<RuleFile>(filePath, { rules: [] });
    const now = new Date().toISOString();
    const rule: PublicationRule = {
      id: randomUUID(),
      ...parsed,
      createdAt: now,
      updatedAt: now,
    };
    await writeJson(filePath, { rules: [...data.rules, rule] });
    return rule;
  });
}

export async function updatePublicationRule(
  filePath: string,
  ruleId: string,
  input: unknown,
): Promise<PublicationRule> {
  return withFileLock(filePath, async () => {
    const data = await readJson<RuleFile>(filePath, { rules: [] });
    const index = data.rules.findIndex((rule) => rule.id === ruleId);
    const existing = index >= 0 ? data.rules[index] : null;
    if (!existing) {
      throw new PublicationRuleStoreError("Publication rule not found", 404);
    }

    let parsed: ReturnType<typeof parsePublicationRuleInput>;
    try {
      parsed = parsePublicationRuleInput(input, existing);
    } catch (error) {
      throw new PublicationRuleStoreError(
        error instanceof Error ? error.message : "Invalid publication rule",
      );
    }

    const next: PublicationRule = {
      ...existing,
      ...parsed,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    };
    const rules = data.rules.slice();
    rules[index] = next;
    await writeJson(filePath, { rules });
    return next;
  });
}

export async function deletePublicationRule(
  filePath: string,
  ruleId: string,
): Promise<void> {
  await withFileLock(filePath, async () => {
    const data = await readJson<RuleFile>(filePath, { rules: [] });
    if (!data.rules.some((rule) => rule.id === ruleId)) {
      throw new PublicationRuleStoreError("Publication rule not found", 404);
    }

    await writeJson(filePath, {
      rules: data.rules.filter((rule) => rule.id !== ruleId),
    });
  });
}
