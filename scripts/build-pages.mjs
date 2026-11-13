import {readFile,mkdir,writeFile,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const live=process.argv.includes('--live');
const origin='https://dongdaemun-xi-briefing.pipedbug3.chatgpt.site';
await mkdir('docs',{recursive:true});
const app=await readFile('src/app.js','utf8');
const appName='app-'+createHash('sha256').update(app).digest('hex').slice(0,12)+'.js';
let html=await readFile('src/index.html','utf8');
html=html.replace('<meta charset="UTF-8">',`<meta charset="UTF-8"><meta name="api-base" content="${origin}"><meta name="data-mode" content="${live?'live':'snapshot'}">`)
 .replace('href="/style.css"','href="./style.css"')
 .replace('type="module" src="/app.js"',`defer src="./${appName}"`);
await writeFile('docs/index.html',html);
await copyFile('src/style.css','docs/style.css');
await copyFile('src/app.js','docs/app.js');
await writeFile('docs/'+appName,app);
await copyFile('src/places.json','docs/places.json');
await writeFile('docs/.nojekyll','');
await writeFile('index.html','<!doctype html><html lang="ko"><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=https://sill202023-jpg.github.io/dongdaemun-realestate-dashboard/"><title>동대문구 대시보드 열기</title><body><h1>1등자이부동산 · 동대문구 대시보드</h1><p>공개 대시보드로 이동합니다. 인터넷 연결이 필요합니다.</p><a href="https://sill202023-jpg.github.io/dongdaemun-realestate-dashboard/">대시보드 열기</a></body></html>');
console.log('Built GitHub Pages docs/ and local index.html. API keys remain on the server.');
