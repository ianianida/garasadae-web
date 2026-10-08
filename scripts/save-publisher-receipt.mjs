import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const hash=value=>createHash('sha256').update(value).digest('hex');
const report=JSON.parse(await readFile('.local/corpus/publisher/comparison-all.json','utf8'));
const manifest=JSON.parse(await readFile('data/source/krv-manifest.json','utf8'));
const corpus=JSON.parse(await readFile('data/source/krv-full.json','utf8'));
if(report.corpusSha256!==manifest.corpusSha256 || report.chapters.length!==manifest.chapterCount || report.issues.length) throw new Error('PUBLISHER_CHECK_INCOMPLETE');
const covered=new Set(report.passages.flatMap(row=>row.slotIds));
if(covered.size!==corpus.length || corpus.some(row=>!covered.has(row.id)) || report.passages.some(row=>row.comparison!=='match')) throw new Error('PUBLISHER_COVERAGE_INCOMPLETE');
const receipt={
  checkedAt:report.checkedAt, corpusSha256:manifest.corpusSha256,
  publisher:report.publisher,
  method:'automated-whole-chapter-body-comparison',
  normalization:'NFC; whitespace removed. Subheadings, footnote markers and alternative footnotes are not body text.',
  note:'원문 일치 확인이며 개별 의미 검수나 사용자 만족의 증명이 아니다. 장 HTML은 .local/corpus/publisher에 보존하고 공개 페이지에서 다시 대조할 수 있다.',
  bookCount:manifest.bookCount,chapterCount:report.chapters.length,verseSlots:covered.size,passageCount:report.passages.length,
  emptySlots:manifest.emptySlots,
  chapters:report.chapters.map(summary=>{
    const rows=report.passages.filter(row=>row.code===summary.code && row.chapter===summary.chapter);
    return {...summary,url:rows[0].url,checkedAt:rows[0].checkedAt,htmlSha256:rows[0].htmlSha256,normalizedBodySha256:hash(JSON.stringify(rows.map(row=>[row.start,row.end,row.text.normalize('NFC').replace(/\s+/g,'')]))) };
  }),
  mergedPassages:report.passages.filter(row=>row.end>row.start).map(row=>({id:row.id,slotIds:row.slotIds,start:row.start,end:row.end,textSha256:corpus.find(verse=>verse.id===row.id).textSha256,url:row.url}))
};
await writeFile('data/source/krv-publisher-audit.json',JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify({chapters:receipt.chapterCount,slots:receipt.verseSlots,passages:receipt.passageCount,merged:receipt.mergedPassages.length}));
