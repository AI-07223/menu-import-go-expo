const el=id=>document.getElementById(id);
function node(tag,text){const e=document.createElement(tag);e.textContent=text;return e}
const money=n=>(n/100).toFixed(2);
function minor(text){return /^\d{1,5}(\.\d{1,2})?$/.test(text.trim())?Math.round(Number(text)*100):null}
function request(req){return new Promise((ok,fail)=>{req.onsuccess=()=>ok(req.result);req.onerror=()=>fail(req.error)})}
let rows=[],local,active,filter="All";
async function init(){
 const SQL=await window.initSqlJs({locateFile:n=>"/kitchen/"+n});
 const res=await fetch("menu.sqlite");if(!res.ok)throw Error("Menu database unavailable.");
 const db=new SQL.Database(new Uint8Array(await res.arrayBuffer()));
 const stmt=db.prepare("SELECT * FROM catalog ORDER BY id");while(stmt.step())rows.push(stmt.getAsObject());stmt.free();db.close();
 for(const name of ["All",...new Set(rows.map(r=>r.category))]){
  const b=node("button",name);b.onclick=()=>{filter=name;gallery()};el("filters").append(b);
  if(name!=="All")el("categories").append(node("option",name));
 }
 gallery();
 const open=indexedDB.open("market-kitchen-edits",1);open.onupgradeneeded=()=>open.result.createObjectStore("dishes",{keyPath:"id"});
 local=await request(open);await saved();el("status").textContent="Choose a dish or download a reference photo and upload it to try exact matching.";
}
function tile(r,personal=false){
 const wrap=node("article","");wrap.className="tile";const b=node("button","");const img=new Image();img.src=r.image;img.alt=r.name;
 b.append(img,node("small",r.category),node("h3",r.name),node("span",r.currency+" "+money(r.price_minor)));
 b.onclick=()=>edit({...r,id:personal?r.id:crypto.randomUUID()},personal?"YOUR SAVED DISH":"HOUSE RECIPE");wrap.append(b);
 if(!personal){const a=node("a","Download reference ↓");a.href=r.image;a.download=r.image.split("/").pop();wrap.append(document.createElement("br"),a)}
 return wrap;
}
function gallery(){for(const b of el("filters").children)b.setAttribute("aria-pressed",String(b.textContent===filter));el("gallery").replaceChildren(...rows.filter(r=>filter==="All"||r.category===filter).map(r=>tile(r)))}
async function saved(){const dishes=await request(local.transaction("dishes").objectStore("dishes").getAll());el("saved").replaceChildren(...(dishes.length?dishes.map(r=>tile(r,true)):[node("p","Saved edits will appear here.")]))}
function edit(r,reason){active=r;el("editor").hidden=false;el("reason").textContent=reason;el("preview").src=r.image;el("dish").value=r.name;el("category").value=r.category;el("price").value=r.price_minor==null?"":money(r.price_minor);el("currency").value=r.currency;el("diet").value=r.vegetarian==null?"":String(r.vegetarian);el("feedback").textContent="";suggest();el("editor").scrollIntoView()}
function distance(a,b){let row=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){const next=[i];for(let j=1;j<=b.length;j++)next[j]=Math.min(row[j]+1,next[j-1]+1,row[j-1]+Number(a[i-1]!==b[j-1]));row=next}return row[b.length]}
function suggest(){const q=el("dish").value.trim().toLowerCase();const ranked=rows.map(r=>({r,d:distance(q,r.name.toLowerCase())})).sort((a,b)=>a.d-b.d);const best=ranked[0];const b=el("suggest");b.hidden=true;if(!q||!best||best.d>Math.min(2,Math.floor(q.length/4))||best.d===ranked[1]?.d||(el("dish").value===best.r.name&&el("category").value===best.r.category))return;b.hidden=false;b.textContent="Use name and category: "+best.r.name;b.onclick=()=>{el("dish").value=best.r.name;el("category").value=best.r.category;suggest()}}
el("dish").oninput=suggest;
async function upload(input,replace){
 const f=input.files[0];if(!f)return;input.value="";
 if(!["image/jpeg","image/png","image/webp"].includes(f.type)||f.size>4*1024*1024)throw Error("Choose a JPEG, PNG or WebP under 4 MiB.");
 const uri=await new Promise((ok,fail)=>{const reader=new FileReader();reader.onload=()=>ok(reader.result);reader.onerror=()=>fail(reader.error);reader.readAsDataURL(f)});
 const check=new Image();check.src=uri;await check.decode();
 if(replace){active.image=uri;el("preview").src=uri;el("feedback").textContent="Photo replaced. Save to keep it.";return}
 const bytes=new Uint8Array(await crypto.subtle.digest("SHA-256",await f.arrayBuffer()));
 const hash=Array.from(bytes,b=>b.toString(16).padStart(2,"0")).join("");
 const hit=rows.find(r=>r.sha256===hash);
 edit({...hit,id:crypto.randomUUID(),image:uri,...(hit?{}:{name:"",category:"",currency:"",price_minor:null,vegetarian:null})},hit?"EXACT REFERENCE PHOTO · HOUSE RECIPE":"NEW PHOTO · ENTER THE DISH DETAILS");
}
for(const id of ["upload","replace"])el(id).onchange=()=>upload(el(id),id==="replace").catch(e=>{(id==="replace"?el("feedback"):el("status")).textContent=e.message});
for(const n of [-10,-1,1,10]){const b=node("button",(n>0?"+":"")+n);b.type="button";b.onclick=()=>{const price=minor(el("price").value||"0");if(price!==null&&price+n*100>0&&price+n*100<=9999999)el("price").value=money(price+n*100)};el("steps").append(b)}
el("form").onsubmit=async e=>{
 e.preventDefault();const price=minor(el("price").value);const name=el("dish").value.trim(),category=el("category").value.trim();
 if(!name||!category||!price||!el("currency").value){el("feedback").textContent="Enter a name, category, currency and positive price with up to two decimal places.";return}
 try{const tx=local.transaction("dishes","readwrite");const complete=new Promise((ok,fail)=>{tx.oncomplete=ok;tx.onabort=()=>fail(tx.error)});
 tx.objectStore("dishes").put({id:active.id,image:active.image,name,category,price_minor:price,currency:el("currency").value,vegetarian:el("diet").value===""?null:Number(el("diet").value)});
 await complete;await saved();el("feedback").textContent="Saved in this browser."}catch{el("feedback").textContent="Could not save in this browser. Your draft is still here."}
};
init().catch(e=>el("status").textContent="Could not open the menu: "+e.message);
