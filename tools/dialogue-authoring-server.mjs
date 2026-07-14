import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";

const appRoot = path.resolve("app");
const dialogueRoot = path.join(appRoot, "data", "dialogue");
const port = Number(process.env.PORT || 8134);
const acts = new Set(["1_Greyharbour", "2_Necropolis", "3_Backlands"]);
const scenePattern = /^scene:([a-z0-9]+(?:\.[a-z0-9]+)*)$/;
const contentTypes = new Map([[".css","text/css; charset=utf-8"],[".html","text/html; charset=utf-8"],[".js","text/javascript; charset=utf-8"],[".json","application/json; charset=utf-8"],[".png","image/png"],[".svg","image/svg+xml"]]);

function send(res,status,body,type="application/json; charset=utf-8"){
  res.writeHead(status,{"Content-Type":type,"Cache-Control":"no-store"});
  res.end(type.startsWith("application/json")?JSON.stringify(body):body);
}

async function readJson(req){
  let body="";
  for await(const chunk of req){body+=chunk;if(body.length>5_000_000)throw new Error("Scene package is too large.")}
  return JSON.parse(body);
}

const server=http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url||"/",`http://${req.headers.host||"localhost"}`);
    if(req.method==="POST"&&url.pathname==="/api/dialogue/save"){
      const scenePackage=await readJson(req);
      const act=scenePackage?.scene?.act;
      const match=scenePackage?.scene?.id?.match(scenePattern);
      if(!acts.has(act))return send(res,400,{error:"Invalid or missing Act."});
      if(!match)return send(res,400,{error:"Invalid or missing scene ID."});
      const folder=path.join(dialogueRoot,act);
      const filename=`${match[1]}.json`;
      await fs.mkdir(folder,{recursive:true});
      await fs.writeFile(path.join(folder,filename),`${JSON.stringify(scenePackage,null,2)}\n`,"utf8");
      return send(res,200,{ok:true,path:`app/data/dialogue/${act}/${filename}`});
    }
    const decoded=decodeURIComponent(url.pathname==="/"?"/dialogue_upload/":url.pathname);
    const safe=path.normalize(decoded).replace(/^(\.\.[/\\])+/,"");
    let filePath=path.join(appRoot,safe);
    const stat=await fs.stat(filePath).catch(()=>null);
    if(stat?.isDirectory())filePath=path.join(filePath,"index.html");
    if(!filePath.startsWith(appRoot))return send(res,403,"Forbidden","text/plain; charset=utf-8");
    const body=await fs.readFile(filePath);
    res.writeHead(200,{"Content-Type":contentTypes.get(path.extname(filePath))||"application/octet-stream","Cache-Control":"no-store"});res.end(body);
  }catch(error){send(res,error.code==="ENOENT"?404:500,{error:error.code==="ENOENT"?"Not found":String(error.message||error)})}
});

server.listen(port,"127.0.0.1",()=>console.log(`[dialogue-authoring] ${appRoot} -> http://127.0.0.1:${port}/dialogue_upload/`));
