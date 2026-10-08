import { mkdir, writeFile } from 'node:fs/promises';
const root = '.local/corpus';
await mkdir(root,{recursive:true});
for (const repo of ['yuhwan/Bible-krv','bluesaurel/Korean-Bible-1961-KRV']) {
  const get = async url => { const r = await fetch(url,{headers:{'User-Agent':'garasadae-corpus-review'}}); if (!r.ok) throw new Error(`PUBLIC_SOURCE_HTTP_${r.status}`); return r.json(); };
  const metadata = await get(`https://api.github.com/repos/${repo}`);
  const commit = await get(`https://api.github.com/repos/${repo}/commits/${metadata.default_branch}`);
  const tree = await get(`https://api.github.com/repos/${repo}/git/trees/${commit.sha}?recursive=1`);
  const dataFiles = tree.tree.filter(f => f.type === 'blob' && /\.json$/i.test(f.path));
  const readmeEntry = tree.tree.find(f => f.path === 'README.md');
  const readme = readmeEntry ? await (await fetch(`https://raw.githubusercontent.com/${repo}/${commit.sha}/README.md`)).text() : '';
  await writeFile(`${root}/${repo.replace('/','-')}-manifest.json`, JSON.stringify({repo,commit:commit.sha,defaultBranch:metadata.default_branch,license:metadata.license?.spdx_id??null,files:dataFiles},null,2));
  await writeFile(`${root}/${repo.replace('/','-')}-README.md`,readme);
  console.log(JSON.stringify({repo,commit:commit.sha,license:metadata.license?.spdx_id??null,jsonFiles:dataFiles.map(f=>f.path)}));
  const sample = dataFiles.find(f => /bible_1961_krv\.json$/.test(f.path)) ?? dataFiles.find(f=>/창세기/.test(f.path)) ?? dataFiles[0];
  if (sample) {
    const raw = await (await fetch(`https://raw.githubusercontent.com/${repo}/${commit.sha}/${encodeURI(sample.path)}`)).text();
    const parsed=JSON.parse(raw); await writeFile(`${root}/${repo.replace('/','-')}-sample.json`,raw);
    console.log(JSON.stringify({repo,bytes:Buffer.byteLength(raw),structure:typeof parsed,keys:Object.keys(parsed).slice(0,8),sample:JSON.stringify(parsed).slice(0,650)}));
  }
}
