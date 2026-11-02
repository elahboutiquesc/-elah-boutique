import {Readable} from 'node:stream';

export async function invoke(handler, request, query={}) {
 const headers=Object.fromEntries(request.headers);
 const limit=handler.limit||6_000_000;
 if(Number(headers['content-length'])>limit)return Response.json({error:'Archivo demasiado grande'},{status:413});
 const chunks=[];let size=0;
 if(request.body){
  const reader=request.body.getReader();
  try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();return Response.json({error:'Archivo demasiado grande'},{status:413});}chunks.push(Buffer.from(value));}}
  finally{reader.releaseLock();}
 }
 const raw=Buffer.concat(chunks),req=Readable.from(raw.length?[raw]:[]);
 req.method=request.method;req.headers=headers;req.query=query;
 const type=headers['content-type']?.split(';')[0];
 try{req.body=raw.length?(type==='application/json'?JSON.parse(raw.toString()):raw.toString()):undefined;}
 catch{return Response.json({error:'JSON inválido'},{status:400});}
 const outputHeaders=new Headers();let status=200,body=null;const finish=[];
 const res={
  setHeader(name,value){if(Array.isArray(value)){outputHeaders.delete(name);for(const item of value)outputHeaders.append(name,item);}else outputHeaders.set(name,String(value));return this;},
  status(code){status=code;return this;},
  get statusCode(){return status;},
  json(value){outputHeaders.set('Content-Type','application/json; charset=utf-8');body=JSON.stringify(value);return this;},
  end(value){body=value??null;return this;},
  redirect(code,url){status=code;outputHeaders.set('Location',url);return this;},
  on(event,callback){if(event==='finish')finish.push(callback);return this;}
 };
 await handler(req,res);for(const fn of finish)fn();
 return new Response(request.method==='HEAD'?null:body,{status,headers:outputHeaders});
}
