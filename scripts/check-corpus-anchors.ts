import { readFile, writeFile } from "node:fs/promises";
import { verses } from "../src/data/verses";
async function main() {
  const corpus = JSON.parse(await readFile("data/source/krv-full.json","utf8")) as {id:string;text:string}[];
  const strip = (value:string) => value.normalize("NFC").replace(/\s+/g, "");
  const results = verses.map(verse => {
    const source = corpus.find(row=>row.id===verse.id);
    return {id:verse.id,matched:!!source && strip(source.text)===strip(verse.text),...(source && strip(source.text)!==strip(verse.text)?{source:source.text,checked:verse.text}: {})};
  });
  await writeFile(".local/corpus/anchor-checks.json", JSON.stringify({at:new Date().toISOString(),checks:results},null,2));
  console.log(JSON.stringify({checked:results.length,matched:results.filter(r=>r.matched).length,differences:results.filter(r=>!r.matched)}));
}
main().catch(()=>{console.error("CORPUS_ANCHOR_CHECK_FAILED");process.exitCode=1;});
