
const KEY='whiskylogg_v17_full_table';
const TYPES=['Whisky','Single Malt Scotch','Blended Scotch','Bourbon','Rye Whiskey','Irish Whiskey','Japanese Whisky','Rum','Dark Rum','Aged Rum','Agricole Rum','Cognac','Armagnac','Brandy','Calvados','Tequila','Mezcal','Gin','Vodka','Aquavit','Grappa','Pisco','Liqueur','Amaro','Annet'];
const DENSITY_TABLE = [
  {abv:0, dens:0.9982},
  {abv:5, dens:0.9892},
  {abv:10, dens:0.9807},
  {abv:15, dens:0.9723},
  {abv:20, dens:0.9640},
  {abv:25, dens:0.9559},
  {abv:30, dens:0.9479},
  {abv:35, dens:0.9399},
  {abv:40, dens:0.9319},
  {abv:45, dens:0.9239},
  {abv:50, dens:0.9157},
  {abv:55, dens:0.9073},
  {abv:60, dens:0.8987}
];
const state=load();
let pendingBaseImage='';
document.addEventListener('DOMContentLoaded',()=>{init();render();});

function load(){const raw=localStorage.getItem(KEY); return raw?JSON.parse(raw):{bases:[],bottles:[],tastings:[]};}
function save(){localStorage.setItem(KEY,JSON.stringify(state));}
function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,8);}
function esc(v=''){return String(v).replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));}
function money(n){return Math.round(Number(n||0)).toLocaleString('no-NO')+' kr';}
function ml(n){return Math.round(Number(n||0)).toLocaleString('no-NO')+' ml';}
function avg(a){return a.length?a.reduce((s,x)=>s+x,0)/a.length:0;}

function init(){
  document.getElementById('typeSelect').innerHTML=TYPES.map(t=>`<option>${t}</option>`).join('');
  document.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>show(b.dataset.go));
  document.getElementById('backupBtn').onclick=()=>show('backup');
  document.getElementById('baseForm').onsubmit=saveBase;
  document.getElementById('bottleForm').onsubmit=saveBottle;
  document.getElementById('tastingForm').onsubmit=saveTasting;
  document.getElementById('baseCancelBtn').onclick=resetBaseForm;
  document.getElementById('bottleCancelBtn').onclick=resetBottleForm;
  document.getElementById('tastingCancelBtn').onclick=resetTastingForm;
  document.getElementById('exportBtn').onclick=exportBackup;
  document.getElementById('importInput').onchange=importBackup;
  document.getElementById('resetBtn').onclick=resetAll;
  document.getElementById('seedBtn').onclick=seed;
  document.getElementById('baseSearch').oninput=renderBaseList;
  document.getElementById('bottleSearch').oninput=renderBottleList;
  document.getElementById('baseImageInput').onchange=handleBaseImage;
  const today=new Date().toISOString().slice(0,10);
  document.querySelector('#bottleForm input[name="purchaseDate"]').value=today;
  document.querySelector('#tastingForm input[name="date"]').value=today;
  ['abv','volume','fullWeight'].forEach(name=>{
    document.querySelector(`#baseForm [name="${name}"]`).addEventListener('input', updateBaseHints);
  });
  updateBaseHints();
}
function show(name){
  document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.dataset.view===name));
  document.querySelectorAll('.navbtn').forEach(v=>v.classList.toggle('active',v.dataset.go===name));
  window.scrollTo({top:0,behavior:'smooth'});
}
async function handleBaseImage(e){
  const file=e.target.files[0]; if(!file) return;
  pendingBaseImage=await resizeImage(file);
  const p=document.getElementById('baseImagePreview'); p.src=pendingBaseImage; p.classList.remove('hidden');
}
function resizeImage(file){
  return new Promise((resolve,reject)=>{
    const fr=new FileReader();
    fr.onload=()=>{const img=new Image(); img.onload=()=>{const ratio=Math.min(1,1200/Math.max(img.width,img.height)); const c=document.createElement('canvas'); c.width=Math.round(img.width*ratio); c.height=Math.round(img.height*ratio); c.getContext('2d').drawImage(img,0,0,c.width,c.height); resolve(c.toDataURL('image/jpeg',0.82));}; img.onerror=reject; img.src=fr.result;};
    fr.onerror=reject; fr.readAsDataURL(file);
  });
}

function densityFromAbv(abv){
  let a=Math.max(0, Math.min(60, Number(abv||0)));
  for(let i=0;i<DENSITY_TABLE.length-1;i++){
    const lo=DENSITY_TABLE[i], hi=DENSITY_TABLE[i+1];
    if(a>=lo.abv && a<=hi.abv){
      const t=(a-lo.abv)/(hi.abv-lo.abv);
      return lo.dens + t*(hi.dens-lo.dens);
    }
  }
  return DENSITY_TABLE[DENSITY_TABLE.length-1].dens;
}
function computedEmptyWeight(base){
  const fw=Number(base.fullWeight||0);
  const vol=Number(base.volume||0);
  const dens=densityFromAbv(Number(base.abv||0));
  if(fw>0 && vol>0) return fw - vol*dens;
  return null;
}
function updateBaseHints(){
  const f=document.getElementById('baseForm');
  const abv=Number(f.querySelector('[name="abv"]').value||0);
  const volume=Number(f.querySelector('[name="volume"]').value||0);
  const full=Number(f.querySelector('[name="fullWeight"]').value||0);
  const dens=densityFromAbv(abv);
  document.getElementById('densityHint').textContent = dens.toFixed(4)+' g/ml';
  const empty=(full>0 && volume>0) ? (full - volume*dens) : null;
  document.getElementById('emptyHint').textContent = empty!==null ? Math.round(empty)+' g' : '—';
}
function getBase(id){return state.bases.find(b=>b.id===id);}
function getBottle(id){return state.bottles.find(b=>b.id===id);}
function bottleName(b){
  const base=getBase(b.baseId);
  const parts=[];
  if(b.batchNo) parts.push('Batch '+b.batchNo);
  if(b.bottleNo) parts.push('Flaske '+b.bottleNo);
  return `${base?base.name:'Ukjent'}${parts.length?' ('+parts.join(' · ')+')':''}`;
}
function bottleTastings(id){return state.tastings.filter(t=>t.bottleId===id);}
function bottleAvg(id){return avg(bottleTastings(id).map(t=>Number(t.score||0)));}
function bottleUsed(id){return bottleTastings(id).reduce((s,t)=>s+Number(t.ml||0),0);}
function bottleVolume(id){
  const bottle=getBottle(id); if(!bottle) return 0;
  const base=getBase(bottle.baseId); if(!base) return 0;
  const ew=computedEmptyWeight(base);
  const fw=Number(base.fullWeight||0);
  const cw=Number(bottle.currentWeight||0);
  if(ew!==null && fw>ew && cw>0){
    const fraction=Math.max(0,Math.min(1,(cw-ew)/(fw-ew)));
    return Math.round(Number(base.volume||0)*fraction);
  }
  return Math.max(0, Math.round(Number(base.volume||0)-bottleUsed(id)));
}
function lastTasted(id){
  const arr=bottleTastings(id).sort((a,b)=>String(b.date).localeCompare(String(a.date)));
  return arr[0]?.date||'—';
}
function bestValueScore(id){
  const bottle=getBottle(id); const base=getBase(bottle?.baseId);
  if(!bottle||!base) return 0;
  const ppm=Number(bottle.price||0)/Math.max(1,Number(base.volume||0));
  return bottleAvg(id)/Math.max(0.001,ppm);
}
function bottleNeedsWeighing(id){
  const bottle=getBottle(id); const base=getBase(bottle?.baseId);
  if(!bottle || !base) return false;
  if(Number(bottle.currentWeight||0) > 0) return false;
  return Number(base.fullWeight||0) > 0 && Number(base.volume||0) > 0;
}

function saveBase(e){
  e.preventDefault();
  const f=new FormData(e.target);
  const id=f.get('editId')||uid();
  upsert(state.bases,{
    id,
    name:f.get('name'),
    distillery:f.get('distillery')||'',
    type:f.get('type')||'Whisky',
    abv:Number(f.get('abv')||0),
    volume:Number(f.get('volume')||700),
    fullWeight:Number(f.get('fullWeight')||0),
    region:f.get('region')||'',
    notes:f.get('notes')||'',
    image: pendingBaseImage || (getBase(id)?.image || '')
  });
  save(); resetBaseForm(); render(); show('library');
}
function saveBottle(e){
  e.preventDefault();
  const f=new FormData(e.target);
  const id=f.get('editId')||uid();
  upsert(state.bottles,{
    id,
    baseId:f.get('baseId'),
    batchNo:f.get('batchNo')||'',
    bottleNo:f.get('bottleNo')||'',
    price:Number(f.get('price')||0),
    purchasePlace:f.get('purchasePlace')||'',
    purchaseDate:f.get('purchaseDate')||'',
    currentWeight:Number(f.get('currentWeight')||0),
    notes:f.get('notes')||''
  });
  save(); resetBottleForm(); render(); show('bottles');
}
function saveTasting(e){
  e.preventDefault();
  const f=new FormData(e.target);
  const id=f.get('editId')||uid();
  const nose=Number(f.get('nose')||0), palate=Number(f.get('palate')||0), finish=Number(f.get('finish')||0), balance=Number(f.get('balance')||0);
  upsert(state.tastings,{
    id,
    bottleId:f.get('bottleId'),
    date:f.get('date'),
    ml:Number(f.get('ml')||20),
    nose,palate,finish,balance,
    score:Number(((nose+palate+finish+balance)/4).toFixed(1)),
    notes:f.get('notes')||''
  });
  save(); resetTastingForm(); render(); show('tastings');
}
function upsert(arr,item){
  const idx=arr.findIndex(x=>x.id===item.id);
  if(idx>=0) arr[idx]=item; else arr.unshift(item);
}
function resetBaseForm(){
  document.getElementById('baseForm').reset();
  document.querySelector('#baseForm [name="editId"]').value='';
  pendingBaseImage='';
  const p=document.getElementById('baseImagePreview'); p.src=''; p.classList.add('hidden');
  document.getElementById('baseSaveBtn').textContent='Lagre grunndata';
  document.getElementById('baseCancelBtn').classList.add('hidden');
  updateBaseHints();
}
function resetBottleForm(){
  document.getElementById('bottleForm').reset();
  document.querySelector('#bottleForm [name="editId"]').value='';
  document.getElementById('bottleSaveBtn').textContent='Lagre flaske';
  document.getElementById('bottleCancelBtn').classList.add('hidden');
  document.querySelector('#bottleForm input[name="purchaseDate"]').value=new Date().toISOString().slice(0,10);
}
function resetTastingForm(){
  document.getElementById('tastingForm').reset();
  document.querySelector('#tastingForm [name="editId"]').value='';
  document.getElementById('tastingSaveBtn').textContent='Lagre smaking';
  document.getElementById('tastingCancelBtn').classList.add('hidden');
  document.querySelector('#tastingForm input[name="date"]').value=new Date().toISOString().slice(0,10);
}
function editBase(id){
  const b=getBase(id); if(!b) return;
  const f=document.getElementById('baseForm');
  f.querySelector('[name="name"]').value=b.name||'';
  f.querySelector('[name="distillery"]').value=b.distillery||'';
  f.querySelector('[name="type"]').value=b.type||'Whisky';
  f.querySelector('[name="abv"]').value=b.abv||'';
  f.querySelector('[name="volume"]').value=b.volume||700;
  f.querySelector('[name="fullWeight"]').value=b.fullWeight||'';
  f.querySelector('[name="region"]').value=b.region||'';
  f.querySelector('[name="notes"]').value=b.notes||'';
  f.querySelector('[name="editId"]').value=b.id;
  if(b.image){ pendingBaseImage=b.image; const p=document.getElementById('baseImagePreview'); p.src=b.image; p.classList.remove('hidden'); }
  document.getElementById('baseSaveBtn').textContent='Oppdater grunndata';
  document.getElementById('baseCancelBtn').classList.remove('hidden');
  updateBaseHints();
  show('library');
}
function editBottle(id){
  const b=getBottle(id); if(!b) return;
  const f=document.getElementById('bottleForm');
  f.querySelector('[name="baseId"]').value=b.baseId||'';
  f.querySelector('[name="batchNo"]').value=b.batchNo||'';
  f.querySelector('[name="bottleNo"]').value=b.bottleNo||'';
  f.querySelector('[name="price"]').value=b.price||'';
  f.querySelector('[name="purchasePlace"]').value=b.purchasePlace||'';
  f.querySelector('[name="purchaseDate"]').value=b.purchaseDate||'';
  f.querySelector('[name="currentWeight"]').value=b.currentWeight||'';
  f.querySelector('[name="notes"]').value=b.notes||'';
  f.querySelector('[name="editId"]').value=b.id;
  document.getElementById('bottleSaveBtn').textContent='Oppdater flaske';
  document.getElementById('bottleCancelBtn').classList.remove('hidden');
  show('add-bottle');
}
function editTasting(id){
  const t=state.tastings.find(x=>x.id===id); if(!t) return;
  const f=document.getElementById('tastingForm');
  f.querySelector('[name="bottleId"]').value=t.bottleId||'';
  f.querySelector('[name="date"]').value=t.date||'';
  f.querySelector('[name="ml"]').value=t.ml||20;
  f.querySelector('[name="nose"]').value=t.nose||7;
  f.querySelector('[name="palate"]').value=t.palate||7;
  f.querySelector('[name="finish"]').value=t.finish||7;
  f.querySelector('[name="balance"]').value=t.balance||7;
  f.querySelector('[name="notes"]').value=t.notes||'';
  f.querySelector('[name="editId"]').value=t.id;
  document.getElementById('tastingSaveBtn').textContent='Oppdater smaking';
  document.getElementById('tastingCancelBtn').classList.remove('hidden');
  show('tastings');
}
function deleteBase(id){
  if(!confirm('Slette grunndata? Tilknyttede flasker og smakinger slettes også.')) return;
  const bottleIds=state.bottles.filter(b=>b.baseId===id).map(b=>b.id);
  state.bases=state.bases.filter(b=>b.id!==id);
  state.bottles=state.bottles.filter(b=>b.baseId!==id);
  state.tastings=state.tastings.filter(t=>!bottleIds.includes(t.bottleId));
  save(); render();
}
function deleteBottle(id){
  if(!confirm('Slette flaske? Tilknyttede smakinger slettes også.')) return;
  state.bottles=state.bottles.filter(b=>b.id!==id);
  state.tastings=state.tastings.filter(t=>t.bottleId!==id);
  save(); render();
}
function deleteTasting(id){
  if(!confirm('Slette smaking?')) return;
  state.tastings=state.tastings.filter(t=>t.id!==id);
  save(); render();
}
function weighBottle(id){
  const b=getBottle(id); if(!b) return;
  const val=prompt('Ny vekt i gram?', b.currentWeight||'');
  if(val===null) return;
  b.currentWeight=Number(val||0); save(); render();
}
function exportBackup(){
  const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='whiskylogg_backup.json'; a.click();
}
function importBackup(e){
  const file=e.target.files[0]; if(!file) return;
  const fr=new FileReader();
  fr.onload=()=>{try{const data=JSON.parse(fr.result); state.bases=Array.isArray(data.bases)?data.bases:[]; state.bottles=Array.isArray(data.bottles)?data.bottles:[]; state.tastings=Array.isArray(data.tastings)?data.tastings:[]; save(); render(); alert('Backup importert.');}catch(err){alert('Kunne ikke lese backup-filen.');}};
  fr.readAsText(file);
}
function resetAll(){
  if(!confirm('Nullstille all data?')) return;
  state.bases=[]; state.bottles=[]; state.tastings=[]; save(); render();
}
function seed(){
  if(state.bases.length && !confirm('Legge inn eksempler i tillegg?')) return;
  const base={id:uid(),name:'Woodford Reserve Double Oaked',distillery:'Brown-Forman',type:'Bourbon',abv:43.2,volume:700,fullWeight:1525,region:'Kentucky, USA',notes:'Eksempel',image:''};
  state.bases.push(base);
  const bottle={id:uid(),baseId:base.id,batchNo:'23A',bottleNo:'1',price:699,purchasePlace:'Vinmonopolet',purchaseDate:new Date().toISOString().slice(0,10),currentWeight:1163,notes:''};
  state.bottles.push(bottle);
  state.tastings.push({id:uid(),bottleId:bottle.id,date:new Date().toISOString().slice(0,10),ml:20,nose:7,palate:8,finish:7,balance:7,score:7.3,notes:'Eksempelsmaking'});
  save(); render();
}

function render(){renderPickers(); renderHome(); renderBaseList(); renderBottleList(); renderTastings();}
function renderPickers(){
  document.getElementById('basePick').innerHTML = state.bases.length ? state.bases.map(b=>`<option value="${b.id}">${esc(b.name)} — ${esc(b.type)}</option>`).join('') : '<option value="">Ingen grunndata ennå</option>';
  document.getElementById('bottlePick').innerHTML = state.bottles.length ? state.bottles.map(b=>`<option value="${b.id}">${esc(bottleName(b))}</option>`).join('') : '<option value="">Ingen flasker ennå</option>';
}
function renderHome(){
  document.getElementById('homeCost').textContent=money(state.bottles.reduce((s,b)=>s+Number(b.price||0),0));
  document.getElementById('homeVolume').textContent=ml(state.bottles.reduce((s,b)=>s+bottleVolume(b.id),0));
  document.getElementById('homeBottles').textContent=String(state.bottles.length);
  document.getElementById('homeTastings').textContent=String(state.tastings.length);

  const best=[...state.bottles].sort((a,b)=>bestValueScore(b.id)-bestValueScore(a.id)).slice(0,5);
  document.getElementById('bestValueList').innerHTML = best.length ? best.map(renderBottleMiniCard).join('') : '<div class="sub">Ingen flasker ennå.</div>';

  const weigh=[...state.bottles].filter(b=>bottleNeedsWeighing(b.id)).slice(0,5);
  document.getElementById('weighNowList').innerHTML = weigh.length ? weigh.map(b=>`<div class="item"><div></div><div><div class="title">${esc(bottleName(b))}</div><div class="meta">Kan veies nå for mer presist volum</div></div><div class="side"><button class="smallbtn" onclick="weighBottle('${b.id}')">Vei</button></div></div>`).join('') : '<div class="sub">Ingen flasker trenger veiing akkurat nå.</div>';

  const low=[...state.bottles].filter(b=>bottleVolume(b.id)<=200).sort((a,b)=>bottleVolume(a.id)-bottleVolume(b.id)).slice(0,5);
  document.getElementById('lowStockList').innerHTML = low.length ? low.map(renderBottleMiniCard).join('') : '<div class="sub">Ingen flasker med lav beholdning.</div>';

  const recent=[...state.tastings].sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,5);
  document.getElementById('recentList').innerHTML = recent.length ? recent.map(t=>`<div class="item"><div></div><div><div class="title">${esc(bottleName(getBottle(t.bottleId)||{}))}</div><div class="meta">${esc(t.date)} · Score ${t.score} · ${t.ml} ml</div><div class="sub">${esc(t.notes||'')}</div></div></div>`).join('') : '<div class="sub">Ingen smakinger ennå.</div>';

  const typeTotals={};
  state.bottles.forEach(b=>{
    const base=getBase(b.baseId); const type=base?.type||'Ukjent';
    typeTotals[type]=(typeTotals[type]||0)+bottleVolume(b.id);
  });
  document.getElementById('typeVolumeList').innerHTML = Object.keys(typeTotals).length ? Object.entries(typeTotals).sort((a,b)=>b[1]-a[1]).map(([type,vol])=>`<div class="item"><div></div><div><div class="title">${esc(type)}</div><div class="meta">${ml(vol)}</div></div></div>`).join('') : '<div class="sub">Ingen flasker registrert ennå.</div>';
}
function renderBottleMiniCard(b){
  const base=getBase(b.baseId);
  const img = base?.image ? `<img class="thumb" src="${base.image}" alt="">` : '<div></div>';
  return `<div class="item">${img}<div><div class="title">${esc(bottleName(b))}</div><div class="meta">${ml(bottleVolume(b.id))} igjen · Snitt ${bottleAvg(b.id).toFixed(1)}</div></div></div>`;
}
function renderBaseList(){
  const q=(document.getElementById('baseSearch').value||'').toLowerCase().trim();
  const items=state.bases.filter(b=>[b.name,b.distillery,b.type,b.region,b.notes].join(' ').toLowerCase().includes(q));
  document.getElementById('baseList').innerHTML = items.length ? items.map(b=>{
    const dens=densityFromAbv(Number(b.abv||0));
    const calc=computedEmptyWeight(b);
    const img = b.image ? `<img class="thumb" src="${b.image}" alt="">` : '<div></div>';
    return `<div class="item">${img}<div><div class="title">${esc(b.name)}</div><div class="meta">${esc(b.type)} · ${esc(b.distillery||'Ukjent produsent')}</div><div class="meta">${esc(b.region||'—')} · ${b.abv?b.abv+'%':'ABV ukjent'} · tetthet ${dens.toFixed(4)} g/ml</div><div class="tags"><span class="pill">${ml(b.volume)}</span><span class="pill">${b.fullWeight?Math.round(b.fullWeight)+' g full':'Fullvekt TBA'}</span><span class="pill ok">${calc!==null?Math.round(calc)+' g tom':''}</span></div></div><div class="side"><button class="smallbtn" onclick="editBase('${b.id}')">Rediger</button><button class="smallbtn" onclick="deleteBase('${b.id}')">Slett</button></div></div>`;
  }).join('') : '<div class="sub">Ingen grunndata registrert.</div>';
}
function renderBottleList(){
  const q=(document.getElementById('bottleSearch').value||'').toLowerCase().trim();
  const items=state.bottles.filter(b=>{const base=getBase(b.baseId); return [base?.name,b.batchNo,b.bottleNo,b.purchasePlace,b.notes].join(' ').toLowerCase().includes(q);});
  document.getElementById('bottleList').innerHTML = items.length ? items.map(b=>{
    const base=getBase(b.baseId);
    const img = base?.image ? `<img class="thumb" src="${base.image}" alt="">` : '<div></div>';
    return `<div class="item">${img}<div><div class="title">${esc(bottleName(b))}</div><div class="meta">${esc(base?.type||'Ukjent')} · ${esc(base?.distillery||'Ukjent produsent')}</div><div class="meta">${esc(b.purchasePlace||'—')} · Sist smakt ${esc(lastTasted(b.id))}</div><div class="tags"><span class="pill">${ml(bottleVolume(b.id))} igjen</span><span class="pill">${money(b.price||0)}</span><span class="pill ok">Snitt ${bottleAvg(b.id).toFixed(1)}</span><span class="pill ${Number(base?.fullWeight||0)>0?'ok':'warn'}">${Number(base?.fullWeight||0)>0?'Veiing aktiv':'Veiing delvis/manuell'}</span></div></div><div class="side"><button class="smallbtn" onclick="weighBottle('${b.id}')">Vei</button><button class="smallbtn" onclick="editBottle('${b.id}')">Rediger</button><button class="smallbtn" onclick="deleteBottle('${b.id}')">Slett</button></div></div>`;
  }).join('') : '<div class="sub">Ingen flasker registrert.</div>';
}
function renderTastings(){
  const items=[...state.tastings].sort((a,b)=>String(b.date).localeCompare(String(a.date)));
  document.getElementById('tastingList').innerHTML = items.length ? items.map(t=>`<div class="item"><div></div><div><div class="title">${esc(bottleName(getBottle(t.bottleId)||{}))}</div><div class="meta">${esc(t.date)} · ${t.ml} ml · Score ${t.score}</div><div class="sub">${esc(t.notes||'')}</div></div><div class="side"><button class="smallbtn" onclick="editTasting('${t.id}')">Rediger</button><button class="smallbtn" onclick="deleteTasting('${t.id}')">Slett</button></div></div>`).join('') : '<div class="sub">Ingen smakinger ennå.</div>';
}
