import { readFile } from 'node:fs/promises';

const [code, startArg='1', countArg='20', mode] = process.argv.slice(2);
const start=Number(startArg), count=Number(countArg);
if(!code || !Number.isInteger(start) || start<1 || !Number.isInteger(count) || count<1 || count>40) throw new Error('Use BOOK_CODE START COUNT (1-based non-excluded entry index, maximum 40).');
const source=JSON.parse(await readFile('data/source/krv-full.json','utf8')).filter(v=>v.code===code);
const ledger=JSON.parse(await readFile(`data/review/books/${code}.json`,'utf8'));
const selected=ledger.entries.filter(row=>row.status!=='exclude').slice(start-1,start-1+count);
console.log(JSON.stringify({book:code,stored:ledger.entries.length,nonExcluded:ledger.entries.filter(row=>row.status!=='exclude').length,start,end:start+selected.length-1}));
if(mode && mode!=='--compact') throw new Error('Only --compact is supported.');
if(mode==='--compact') {
  // Keep every selected whole verse and judgment; print overlapping neighbors once.
  const chosenIds=new Set(selected.map(row=>row.id));
  const neighbors=new Map();
  for(const item of selected) {
    const at=source.findIndex(row=>row.id===item.id);
    const around=[...source.slice(Math.max(0,at-2),at),...source.slice(at+1,at+3)];
    for(const verse of around) if(!chosenIds.has(verse.id)) neighbors.set(verse.id,verse);
    const {textSha256,...review}=item;
    console.log(JSON.stringify({...review,wholeVerse:source[at]?.text,contextIds:around.map(row=>row.id)}));
  }
  console.log('ADDITIONAL WHOLE CONTEXT VERSES');
  for(const verse of source) if(neighbors.has(verse.id)) console.log(JSON.stringify({id:verse.id,text:verse.text}));
  process.exit(0);
}
for(const item of selected){
  const at=source.findIndex(row=>row.id===item.id);
  console.log(JSON.stringify({review:item,wholeVerse:source[at]?.text,before:source.slice(Math.max(0,at-2),at).map(v=>({id:v.id,text:v.text})),after:source.slice(at+1,at+3).map(v=>({id:v.id,text:v.text}))}));
}
