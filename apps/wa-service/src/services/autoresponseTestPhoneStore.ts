import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

type TestPhoneData = {
  phones: string[];
};

function emptyData(): TestPhoneData {
  return { phones: [] };
}

async function readData(filePath: string): Promise<TestPhoneData> {
  try {
    const content = await readFile(filePath, "utf8");
    const parsed = JSON.parse(content) as Partial<TestPhoneData>;
    return {
      phones: Array.isArray(parsed.phones)
        ? parsed.phones.filter(
            (phone): phone is string => typeof phone === "string",
          )
        : [],
    };
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return emptyData();
    }

    throw error;
  }
}

async function writeData(filePath: string, data: TestPhoneData): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

export async function listAutoresponseTestPhones(
  filePath: string,
): Promise<string[]> {
  const data = await readData(filePath);
  return data.phones;
}

export async function replaceAutoresponseTestPhones(params: {
  filePath: string;
  phones: string[];
}): Promise<string[]> {
  const phones = [...new Set(params.phones)].sort();
  await writeData(params.filePath, { phones });
  return phones;
}

export async function isAutoresponseTestPhone(params: {
  filePath: string;
  phone: string;
}): Promise<boolean> {
  const phones = await listAutoresponseTestPhones(params.filePath);
  return phones.includes(params.phone);
}
