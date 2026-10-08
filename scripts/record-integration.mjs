import { readFile, writeFile } from 'node:fs/promises';

// Inputs are manually authored after reading whole verses and concrete cases.
// Source hashes are copied only to bind those authored decisions to their text.
const [inputFile]=process.argv.slice(2);
if(!inputFile) throw new Error('Use an authored decision JSON file.');
const incoming=JSON.parse(await readFile(inputFile,'utf8'));
const source=JSON.parse(await readFile('data/source/krv-full.json','utf8'));
const manifest=JSON.parse(await readFile('data/source/krv-manifest.json','utf8'));
const byId=new Map(source.map(row=>[row.id,row]));
const output='data/review/final-decisions.json';
let result;
try {result=JSON.parse(await readFile(output,'utf8'));}
catch(error) {if(error.code!=='ENOENT') throw error;result={corpusSha256:manifest.corpusSha256,criteriaVersion:'garasadae-corpus-2026-10-08-v1',reviewer:'Codex integration review',method:'direct-codex-reading',decisions:[]};}
if(result.corpusSha256!==manifest.corpusSha256) throw new Error('CORPUS_CHANGED_REVIEW_REQUIRED');
if(!Array.isArray(incoming) || !incoming.length) throw new Error('EMPTY_AUTHORED_BATCH');
const existing=new Map(result.decisions.map(row=>[row.id,row]));
for(const entry of incoming) {
  const verse=byId.get(entry.id);
  if(!verse || !['candidate','hold','exclude'].includes(entry.status) || entry.reason?.length<8 || entry.counterexampleNote?.length<8 || !Array.isArray(entry.connections)) throw new Error(`INVALID_AUTHORED_DECISION_${entry.id}`);
  if(existing.has(entry.id)) throw new Error(`ALREADY_REVIEWED_${entry.id}`);
  if(entry.status==='candidate' && !entry.connections.some(pair=>pair.expectedEnough==='yes')) throw new Error(`NO_SUFFICIENT_CASE_${entry.id}`);
  existing.set(entry.id,{...entry,textSha256:verse.textSha256});
}
result.decisions=[...existing.values()].sort((a,b)=>source.findIndex(v=>v.id===a.id)-source.findIndex(v=>v.id===b.id));
await writeFile(output,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({newAuthoredDecisions:incoming.length,totalIntegrationDecisions:result.decisions.length}));
