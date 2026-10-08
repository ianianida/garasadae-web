import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

// Source comparison only. This script does not evaluate a verse or mark it reviewed.
const corpus = JSON.parse(await readFile('data/source/krv-full.json', 'utf8'));
const manifest = JSON.parse(await readFile('data/source/krv-manifest.json', 'utf8'));
const sha = text => createHash('sha256').update(text).digest('hex');
const normalize = text => text.normalize('NFC').replace(/\s+/g, '');
const decode = html => html.replace(/&#x([\da-f]+);/gi, (_, value) => String.fromCodePoint(parseInt(value, 16)))
  .replace(/&#(\d+);/g, (_, value) => String.fromCodePoint(Number(value)))
  .replace(/&nbsp;|&amp;|&lt;|&gt;|&quot;|&#39;/g, value => ({'&nbsp;':' ', '&amp;':'&', '&lt;':'<', '&gt;':'>', '&quot;':'"', '&#39;':"'"})[value]);
const plain = html => decode(html.replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim();
const cache = '.local/corpus/publisher';
// The publisher's book selector uses jnh for 요나; our corpus uses JON.
const publisherCode = code => code === 'JON' ? 'jnh' : code.toLowerCase();
await mkdir(cache, {recursive:true});

export function parsePublisherChapter(html) {
  if (!/<b>개역한글<\/b>/.test(html) || !/<option value="HAN"\s+selected=/.test(html)) throw new Error('PUBLISHER_EDITION_UNCONFIRMED');
  // Footnote alternatives and their superscript markers are not Bible body text.
  const body=html.slice(html.indexOf('<b>개역한글</b>'),html.indexOf('<div class="rightCont">'))
    .replace(/<div\b[^>]*\bclass=['"]?D2\b[^>]*>[\s\S]*?<\/div>/g,'')
    .replace(/<a\b[^>]*\bclass=['"]?comment\b[^>]*>[\s\S]*?<\/a>/g,'')
    .replace(/<font\b[^>]*\bclass=['"]smallTitle['"][^>]*>[\s\S]*?<\/font>/g,'');
  const rows = [...body.matchAll(/<span class="number">([\s\S]*?)<\/span>([\s\S]*?)<\/span>/g)].map(match => {
    const label = plain(match[1]);
    const parsed = /^(\d+)(?:-(\d+))?$/.exec(label);
    if (!parsed) throw new Error(`PUBLISHER_VERSE_LABEL_${label}`);
    return {start:Number(parsed[1]), end:Number(parsed[2] ?? parsed[1]), text:plain(match[2])};
  });
  if (!rows.length) throw new Error('PUBLISHER_NO_VERSES');
  for (let index=0;index<rows.length;index++) {
    const previous = rows[index-1];
    if (rows[index].start > rows[index].end || (previous && rows[index].start !== previous.end+1) || (!previous && rows[index].start !== 1)) throw new Error('PUBLISHER_VERSE_SEQUENCE');
  }
  return rows;
}

const adjacentGroups=[];
for (let index=0;index<corpus.length;index++) {
  const first=corpus[index];
  let end=index;
  while (end+1<corpus.length && corpus[end+1].code===first.code && corpus[end+1].chapter===first.chapter && corpus[end+1].verse===corpus[end].verse+1 && first.text.length>20 && normalize(corpus[end+1].text)===normalize(first.text)) end++;
  if (end>index) {adjacentGroups.push(corpus.slice(index,end+1));index=end;}
}
const all = process.argv.includes('--all');
const selected = all ? corpus : adjacentGroups.flat();
const keys = [...new Set(selected.map(row=>`${row.code}:${row.chapter}`))];
const issues=[], summaries=[], publisherPassages=[];
for (const key of keys) {
  const [code, chapterString] = key.split(':');
  const chapter = Number(chapterString);
  const filename = `${cache}/${code}-${chapter}.html`;
  const url = `https://www.bskorea.or.kr/bible/korbibReadpage.php?linkBible=BHAN${publisherCode(code)}${String(chapter).padStart(3,'0')}001`;
  try {
    let html;
    try { html=await readFile(filename,'utf8'); parsePublisherChapter(html); }
    catch {
      const response=await fetch(url,{signal:AbortSignal.timeout(20000)});
      if(!response.ok) throw new Error(`HTTP_${response.status}`);
      html=await response.text();
      await writeFile(filename,html);
      await delay(500);
    }
    const passages=parsePublisherChapter(html);
    const sourceRows=corpus.filter(row=>row.code===code && row.chapter===chapter);
    const comparisons=passages.map(passage=>{
      const slots=sourceRows.filter(row=>row.verse>=passage.start && row.verse<=passage.end);
      const whole=slots.every(row=>normalize(row.text)===normalize(passage.text));
      const split=normalize(slots.map(row=>row.text).join(' '))===normalize(passage.text);
      const empty=(slots.length===1 && slots[0].emptySlot && /^\(?없음\)?$/.test(passage.text));
      const expectedCount=passage.end-passage.start+1;
      const status=slots.length!==expectedCount?'missing-slot':(whole||split||empty)?'match':'content-difference';
      const row={id:`KRV:${code}:${chapter}:${passage.start}`,code,chapter,start:passage.start,end:passage.end,slotIds:slots.map(row=>row.id),text:passage.text,textSha256:sha(passage.text),comparison:status,url,checkedAt:new Date().toISOString(),htmlSha256:sha(html)};
      publisherPassages.push(row);
      if(status!=='match') issues.push({id:row.id,label:`${passage.start}-${passage.end}`,publisher:passage.text,source:slots.map(row=>({id:row.id,text:row.text})),status});
      return row;
    });
    if(passages.at(-1)?.end!==sourceRows.at(-1)?.verse) issues.push({code,chapter,status:'chapter-length',publisher:passages.at(-1)?.end,source:sourceRows.at(-1)?.verse});
    summaries.push({code,chapter,passages:passages.length,slots:sourceRows.length,matches:comparisons.filter(row=>row.comparison==='match').length,merged:passages.filter(row=>row.end>row.start).length});
  } catch(error) {issues.push({code,chapter,status:'fetch-or-parse-error',error:error instanceof Error?error.message:'unknown'});}
  if(summaries.length && summaries.length%25===0) console.log(JSON.stringify({chaptersCompared:summaries.length,total:keys.length,issues:issues.length}));
}
const report={checkedAt:new Date().toISOString(),scope:all?'all-chapters':'adjacent-identical-text-chapters',corpusSha256:manifest.corpusSha256,publisher:'대한성서공회 개역한글',chapters:summaries,adjacentIdenticalGroups:adjacentGroups.map(group=>group.map(row=>row.id)),issues,passages:publisherPassages};
await writeFile(`${cache}/comparison-${all?'all':'adjacent'}.json`,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({scope:report.scope,chapters:summaries.length,requested:keys.length,passages:publisherPassages.length,mergedPassages:publisherPassages.filter(row=>row.end>row.start).length,issues:issues.length,issueSamples:issues.slice(0,5)}));
