import { readFile, mkdir, writeFile, access } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { parseEnv } from 'node:util';

const cli=process.argv[2];
if(!cli) throw new Error('Pass the verified Vercel CLI JavaScript entry point.');
await access(cli);
const expected={projectId:'prj_GroYvxVmIbBMKdrWEFR0qAFAkWlo',orgId:'team_z1jwHfC5oHfsTtEpYmUCXOvq',projectName:'garasadae-web'};
const link=JSON.parse(await readFile('.vercel/project.json','utf8'));
if(Object.keys(expected).some(key=>link[key]!==expected[key])) throw new Error('Vercel destination does not match the user-approved project.');
const env=parseEnv(await readFile('.env.local','utf8'));
const fields=[
  ['NEXT_PUBLIC_SUPABASE_URL','config'],['NEXT_PUBLIC_SUPABASE_ANON_KEY','config'],
  ['SUPABASE_SERVICE_ROLE_KEY','secret'],['OPENAI_API_KEY','secret'],['OPENAI_MODEL','config'],
  ['DRAW_SIGNING_SECRET','secret'],['ADMIN_EMAILS','secret'],['ADMIN_USER_IDS','secret'],
  ['NEXT_PUBLIC_CONTACT_EMAIL','config'],['AI_DAILY_REQUEST_LIMIT','config']
];
const absent=fields.filter(([key])=>!env[key]?.trim()).map(([key])=>key);
if(absent.length) throw new Error(`Missing required fields: ${absent.join(', ')}`);
const report=[];
for(const [key,type] of fields){
  const code=await new Promise((resolve,reject)=>{
    // Values travel only through stdin. They are never command arguments, logs,
    // committed files, or subprocess output returned to the conversation.
    const child=spawn(process.execPath,[cli,'env','add',key,'production','--type',type,'--force','--yes','--project',expected.projectId,'--scope','ian19-6602'],{stdio:['pipe','ignore','ignore'],windowsHide:true});
    child.on('error',reject); child.on('exit',resolve);
    child.stdin.on('error',()=>{}); child.stdin.end(env[key].trim());
  });
  const item={name:key,environment:'production',type,saved:code===0};
  report.push(item); console.log(JSON.stringify(item));
  if(code!==0) throw new Error(`Vercel environment save failed for ${key}. Inspect project access without printing secret values.`);
}
await mkdir('.local/verification',{recursive:true});
await writeFile('.local/verification/vercel-environment.json',JSON.stringify({project:expected.projectName,org:expected.orgId,at:new Date().toISOString(),fields:report},null,2));
