import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const books = [
 ['GEN','창세기','Genesis',50],['EXO','출애굽기','Exodus',40],['LEV','레위기','Leviticus',27],['NUM','민수기','Numbers',36],['DEU','신명기','Deuteronomy',34],['JOS','여호수아','Joshua',24],['JDG','사사기','Judges',21],['RUT','룻기','Ruth',4],['1SA','사무엘상','1Samuel',31],['2SA','사무엘하','2Samuel',24],['1KI','열왕기상','1Kings',22],['2KI','열왕기하','2Kings',25],['1CH','역대상','1Chronicles',29],['2CH','역대하','2Chronicles',36],['EZR','에스라','Ezra',10],['NEH','느헤미야','Nehemiah',13],['EST','에스더','Esther',10],['JOB','욥기','Job',42],['PSA','시편','Psalms',150],['PRO','잠언','Proverbs',31],['ECC','전도서','Ecclesiastes',12],['SNG','아가','SongofSolomon',8],['ISA','이사야','Isaiah',66],['JER','예레미야','Jeremiah',52],['LAM','예레미야애가','Lamentations',5],['EZK','에스겔','Ezekiel',48],['DAN','다니엘','Daniel',12],['HOS','호세아','Hosea',14],['JOL','요엘','Joel',3],['AMO','아모스','Amos',9],['OBA','오바댜','Obadiah',1],['JON','요나','Jonah',4],['MIC','미가','Micah',7],['NAM','나훔','Nahum',3],['HAB','하박국','Habakkuk',3],['ZEP','스바냐','Zephaniah',3],['HAG','학개','Haggai',2],['ZEC','스가랴','Zechariah',14],['MAL','말라기','Malachi',4],['MAT','마태복음','Matthew',28],['MRK','마가복음','Mark',16],['LUK','누가복음','Luke',24],['JHN','요한복음','John',21],['ACT','사도행전','Acts',28],['ROM','로마서','Romans',16],['1CO','고린도전서','1Corinthians',16],['2CO','고린도후서','2Corinthians',13],['GAL','갈라디아서','Galatians',6],['EPH','에베소서','Ephesians',6],['PHP','빌립보서','Philippians',4],['COL','골로새서','Colossians',4],['1TH','데살로니가전서','1Thessalonians',5],['2TH','데살로니가후서','2Thessalonians',3],['1TI','디모데전서','1Timothy',6],['2TI','디모데후서','2Timothy',4],['TIT','디도서','Titus',3],['PHM','빌레몬서','Philemon',1],['HEB','히브리서','Hebrews',13],['JAS','야고보서','James',5],['1PE','베드로전서','1Peter',5],['2PE','베드로후서','2Peter',3],['1JN','요한1서','1John',5],['2JN','요한2서','2John',1],['3JN','요한3서','3John',1],['JUD','유다서','Jude',1],['REV','요한계시록','Revelation',22]
];
const hash = value => createHash('sha256').update(value).digest('hex');
const normalize = text => text.normalize('NFC').replace(/\s+/g,'');
const letters = text => normalize(text).replace(/\p{P}/gu,'');
const root='.local/corpus';
const aManifest=JSON.parse(await readFile(`${root}/yuhwan-Bible-krv-manifest.json`,'utf8'));
const bManifest=JSON.parse(await readFile(`${root}/bluesaurel-Korean-Bible-1961-KRV-manifest.json`,'utf8'));
const bRaw=await readFile(`${root}/bluesaurel-Korean-Bible-1961-KRV-sample.json`,'utf8');
const bBooks=JSON.parse(bRaw);
await mkdir(`${root}/source-a`,{recursive:true});
const aBooks = new Map();
for (let offset=0; offset<books.length; offset+=4) {
 const results=await Promise.all(books.slice(offset,offset+4).map(async ([code,name])=>{
   const filename=`${root}/source-a/${code}.json`;
   let raw;
   try { raw=await readFile(filename,'utf8'); }
   catch {const response=await fetch(`https://raw.githubusercontent.com/${aManifest.repo}/${aManifest.commit}/${encodeURIComponent(name+'.json')}`);if(!response.ok)throw new Error(`CORPUS_FETCH_${code}_${response.status}`);raw=await response.text();await writeFile(filename,raw);}
   return [code,JSON.parse(raw)];
 }));
 for(const [code,book] of results)aBooks.set(code,book);
}
const rows=[], sourceDifferences=[], issues=[], bookStats=[];
for(const [code,name,english,expectedChapters] of books){
 const a=aBooks.get(code), b=bBooks.find(x=>x.book===english);
 if(!a||!b) throw new Error(`CORPUS_BOOK_MISSING_${code}`);
 if(a.chapters.length!==expectedChapters||b.chapters.length!==expectedChapters)issues.push({code,type:'chapter-count'});
 let count=0;
 for(let chapter=1;chapter<=expectedChapters;chapter++){
  const ac=a.chapters.find(x=>x.chapter===chapter),bc=b.chapters.find(x=>x.chapter===chapter);
  if(!ac||!bc){issues.push({code,chapter,type:'chapter-missing'});continue;}
  const maximum=Math.max(...ac.verses.map(v=>v.verse),...bc.verses.map(v=>v.verse));
  for(let verse=1;verse<=maximum;verse++){
   const av=ac.verses.filter(v=>v.verse===verse),bv=bc.verses.filter(v=>v.verse===verse);
   const id=`KRV:${code}:${chapter}:${verse}`;
   if(av.length!==1||bv.length!==1){issues.push({id,type:'verse-missing-or-duplicate',a:av.length,b:bv.length});continue;}
   const text=av[0].text,other=bv[0].text;
   if(typeof text!=='string'||typeof other!=='string'){issues.push({id,type:'text-type'});continue;}
   let comparison='exact';
   if(text!==other)comparison=normalize(text)===normalize(other)?'spacing':letters(text)===letters(other)?'punctuation':'content';
   if(comparison!=='exact')sourceDifferences.push({id,comparison,a:text,b:other});
   const isEmpty= !text.trim() || /^\(?없음\)?$/.test(text.trim());
   // Preferred source preserves KRV's historical spelling; differences remain auditable.
   const body=other.normalize('NFC');
   const row={id,code,book:name,chapter,verse,text:body,translation:'개역한글',sourceUrl:`https://www.bible.com/ko/bible/88/${code}.${chapter}.${verse}.KRV`,textSha256:hash(body),sourceComparison:comparison,emptySlot:isEmpty};
   rows.push(row);count++;
  }
 }
 bookStats.push({code,book:name,english,chapters:a.chapters.length,slots:count});
}
const unique=new Set(rows.map(x=>x.id));if(unique.size!==rows.length)throw new Error('CORPUS_DUPLICATE_ID');
const corpusString=JSON.stringify(rows,null,2)+'\n';
await mkdir('data/source',{recursive:true});
await writeFile('data/source/krv-full.json',corpusString);
const manifest={importedAt:new Date().toISOString(),translation:'개역한글',officialEdition:false,sources:[{repo:aManifest.repo,commit:aManifest.commit},{repo:bManifest.repo,commit:bManifest.commit,sha256:hash(bRaw)}],copyrightNotice:'개역한글 본문의 저작재산권 만료는 대한성서공회 안내를 기준으로 확인. 데이터 제공자의 공식 정본 지위를 뜻하지 않음.',copyrightSource:'https://www.bskorea.or.kr/bbs/content.php?co_id=subpage2_3_4_1',corpusSha256:hash(corpusString),books:bookStats,bookCount:books.length,chapterCount:bookStats.reduce((n,b)=>n+b.chapters,0),verseSlots:rows.length,textEntries:rows.filter(r=>!r.emptySlot).length,emptySlots:rows.filter(r=>r.emptySlot).map(r=>r.id),sourceDifferenceCounts:Object.fromEntries(['spacing','punctuation','content'].map(type=>[type,sourceDifferences.filter(x=>x.comparison===type).length])),issues,reviewComplete:false};
await writeFile('data/source/krv-manifest.json',JSON.stringify(manifest,null,2)+'\n');
await writeFile(`${root}/source-differences.json`,JSON.stringify(sourceDifferences,null,2));
console.log(JSON.stringify({books:manifest.bookCount,chapters:manifest.chapterCount,slots:manifest.verseSlots,textEntries:manifest.textEntries,empty:manifest.emptySlots.length,differences:manifest.sourceDifferenceCounts,structuralIssues:issues.length,totalCharacters:rows.reduce((n,r)=>n+r.text.length,0)}));
console.log(JSON.stringify({differenceSamples:sourceDifferences.filter(x=>x.comparison==='content').slice(0,8),issueSamples:issues.slice(0,10)}));
