import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fetchHandler} from '../src/server.js';
const env={...process.env,OSM_PLACES:JSON.parse(await readFile('src/places.json','utf8'))};
try{for(const line of (await readFile('.env','utf8')).split(/\r?\n/)){const m=line.match(/^([A-Z_]+)=(.*)$/);if(m)env[m[1]]=m[2];}}catch{}
http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost:4173');let response;if(url.pathname.startsWith('/api/'))response=await fetchHandler(new Request(url),env,{});else{const file={'/':'index.html','/app.js':'app.js','/style.css':'style.css'}[url.pathname];if(!file){res.writeHead(404);res.end();return;}response=new Response(await readFile('src/'+file),{headers:{'Content-Type':file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.css')?'text/css':'text/javascript'}});}res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));}catch{res.writeHead(500);res.end('Server error');}}).listen(4173,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:4173'));
