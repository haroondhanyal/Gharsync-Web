import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const source = process.argv[2];
if (!source) throw new Error("Usage: node scripts/build-geonames-city-data.mjs /path/to/cities500.txt");
const output = resolve("apps/web/public/data/cities");
await mkdir(output, { recursive: true });
const records = new Map();
for (const line of (await readFile(source, "utf8")).split(/\r?\n/)) {
  const columns = line.split("\t");
  const name = columns[1]?.trim();
  const countryCode = columns[8]?.trim().toUpperCase();
  if (!name || !/^[A-Z]{2}$/.test(countryCode ?? "")) continue;
  if (!records.has(countryCode)) records.set(countryCode, new Set());
  records.get(countryCode).add(name);
}
for (const [countryCode, names] of records) {
  const sorted = [...names].sort((left, right) => left.localeCompare(right));
  await writeFile(resolve(output, `${countryCode}.json`), `${JSON.stringify(sorted)}\n`);
}
console.log(`Built city suggestions for ${records.size} countries (${[...records.values()].reduce((count, names) => count + names.size, 0)} unique city names).`);
