import {readFile} from 'node:fs/promises';
const corpus=JSON.parse(await readFile('data/source/krv-full.json','utf8'));
const manifest=JSON.parse(await readFile('data/source/krv-manifest.json','utf8'));
const [code,startValue='1',countValue='100']=process.argv.slice(2);
if(code==='--inventory') { console.log(JSON.stringify(manifest.books,null,2)); process.exit(0); }
if(!manifest.books.some(b=>b.code===code))throw new Error('UNKNOWN_BOOK_CODE');
const start=Number(startValue),count=Number(countValue);
if(!Number.isInteger(start)||start<1||!Number.isInteger(count)||count<1||count>180)throw new Error('INVALID_RANGE');
const rows=corpus.filter(r=>r.code===code);
console.log(JSON.stringify({book:code,total:rows.length,start,end:Math.min(rows.length,start+count-1),corpusSha256:manifest.corpusSha256}));
for(let index=Math.max(0,start-3);index<Math.min(rows.length,start+count+1);index++){
 const row=rows[index]; console.log(`${index+1}${index<start-1||index>=start+count-1?' CONTEXT':''} ${row.id} ${row.text}`);
}
