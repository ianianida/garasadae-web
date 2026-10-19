import { readFile, readdir } from 'node:fs/promises';

// Coverage and resume positions only. This never reads meaning or assigns judgments.
const [onlyBook] = process.argv.slice(2);
const source = JSON.parse(await readFile('data/source/krv-full.json', 'utf8'));
const final = JSON.parse(await readFile('data/review/final-decisions.json', 'utf8'));
const manifest = JSON.parse(await readFile('data/source/krv-manifest.json', 'utf8'));
const byId = new Map(source.map(row => [row.id, row]));
const integrated = new Map();
const issues = [];
if (final.corpusSha256 !== manifest.corpusSha256) issues.push('integration corpus hash mismatch');
for (const row of final.decisions) {
  if (integrated.has(row.id)) issues.push(`duplicate integration ${row.id}`);
  if (byId.get(row.id)?.textSha256 !== row.textSha256) issues.push(`integration text hash ${row.id}`);
  integrated.set(row.id, row);
}
const scenarios = (await readdir('data/review')).filter(name => /^scenarios.*\.json$/.test(name));
const caseIds = new Set((await Promise.all(scenarios.map(name => readFile(`data/review/${name}`, 'utf8'))))
  .flatMap(text => JSON.parse(text).map(row => row.id)));
for (const row of final.decisions) {
  if (row.status === 'candidate' && !row.connections.some(pair => pair.expectedEnough === 'yes')) issues.push(`candidate without sufficient case ${row.id}`);
  for (const pair of row.connections) if (!caseIds.has(pair.scenarioId)) issues.push(`unknown case ${row.id} ${pair.scenarioId}`);
}
const files = new Set(await readdir('data/review/books'));
const books = [];
let firstPassStored = 0;
let pendingIntegration = 0;
for (const code of [...new Set(source.map(row => row.code))]) {
  const raw = source.filter(row => row.code === code);
  const ledger = files.has(`${code}.json`) ? JSON.parse(await readFile(`data/review/books/${code}.json`, 'utf8')) : { entries: [] };
  const eligibleIds = new Set(ledger.entries.filter(row => row.status !== 'exclude').map(row => row.id));
  const eligible = raw.filter(row => eligibleIds.has(row.id));
  const pending = eligible.filter(row => !integrated.has(row.id));
  firstPassStored += ledger.entries.length;
  pendingIntegration += pending.length;
  if (!onlyBook || onlyBook === code) books.push({
    code, firstPassStored: ledger.entries.length, sourceSlots: raw.length,
    integrationStored: eligible.length - pending.length, pendingIntegration: pending.length,
    nextReadingStart: pending.length ? eligible.findIndex(row => row.id === pending[0].id) + 1 : null,
    nextId: pending[0]?.id ?? null,
  });
}
if (onlyBook && !books.length) throw new Error(`Unknown book ${onlyBook}`);
console.log(JSON.stringify({
  sourceSlots: source.length, firstPassStored, unreviewedSlots: source.length - firstPassStored,
  integrationStored: integrated.size, pendingIntegrationAmongStoredJudgments: pendingIntegration,
  issues, note: '저장 범위와 재개 위치의 확인이며 의미 판단이나 실제 만족의 증명은 아님.', books,
}, null, 2));
if (issues.length) process.exitCode = 1;
