import {readFile,mkdir,writeFile,copyFile} from 'node:fs/promises';
const origin='https://dongdaemun-xi-briefing.pipedbug3.chatgpt.site';
await mkdir('docs',{recursive:true});
let html=await readFile('src/index.html','utf8');
html=html.replace('<meta charset="UTF-8">',`<meta charset="UTF-8"><meta name="api-base" content="${origin}">`)
 .replace('href="/style.css"','href="./style.css"')
 .replace('type="module" src="/app.js"','defer src="./app.js"');
await writeFile('docs/index.html',html);
await copyFile('src/style.css','docs/style.css');
await copyFile('src/app.js','docs/app.js');
await copyFile('src/places.json','docs/places.json');
await writeFile('docs/.nojekyll','');
await writeFile('index.html',html.replace('href="./style.css"','href="./docs/style.css"').replace('src="./app.js"','src="./docs/app.js"'));
console.log('Built GitHub Pages docs/ and local index.html. API keys remain on the server.');
