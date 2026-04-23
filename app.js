
let db = JSON.parse(localStorage.getItem('wl_v15')||'{"bases":[],"bottles":[],"tastings":[]}');

function save(){localStorage.setItem('wl_v15',JSON.stringify(db));render();}

// ---------- BASE ----------
function addBase(){
  let name = prompt("Navn på type?");
  let vol = Number(prompt("Standard ml?",700));
  let empty = Number(prompt("Tom vekt?",800));
  let full = Number(prompt("Full vekt?",1500));
  db.bases.push({id:Date.now(),name,vol,empty,full});
  save();
}

// ---------- BOTTLE ----------
function addBottle(){
  if(db.bases.length==0){alert("Lag grunndata først");return;}
  let list = db.bases.map((b,i)=>i+": "+b.name).join("\n");
  let index = Number(prompt("Velg type:\n"+list));
  let base = db.bases[index];

  let batch = prompt("Batch?");
  let nr = prompt("Flaske nr?");
  let price = Number(prompt("Pris?"));

  db.bottles.push({
    id:Date.now(),
    baseId:base.id,
    batch,nr,price,
    weight:0
  });
  save();
}

// ---------- TASTING ----------
function addTasting(i){
  let score = Number(prompt("Score 1-10"));
  let ml = Number(prompt("ml drukket"));

  db.tastings.push({
    bottleId:db.bottles[i].id,
    score,ml
  });

  save();
}

// ---------- CALC ----------
function calcAvg(id){
  let t = db.tastings.filter(x=>x.bottleId==id);
  if(t.length==0)return 0;
  return t.reduce((s,x)=>s+x.score,0)/t.length;
}

function calcValue(b){
  let base = db.bases.find(x=>x.id==b.baseId);
  if(!base)return 0;
  let avg = calcAvg(b.id);
  return avg/(b.price/base.vol);
}

function calcVolume(b){
  let base = db.bases.find(x=>x.id==b.baseId);
  if(!base)return 0;

  if(b.weight>0){
    let liquid = b.weight - base.empty;
    let fullLiquid = base.full - base.empty;
    return Math.max(0, base.vol * (liquid/fullLiquid));
  }

  let used = db.tastings
    .filter(t=>t.bottleId==b.id)
    .reduce((s,x)=>s+x.ml,0);

  return Math.max(0, base.vol - used);
}

// ---------- WEIGH ----------
function weigh(i){
  let w = Number(prompt("Ny vekt?"));
  db.bottles[i].weight = w;
  save();
}

// ---------- RENDER ----------
function render(){
  let el=document.getElementById('list');
  el.innerHTML='';

  db.bottles.sort((a,b)=>calcValue(b)-calcValue(a));

  db.bottles.forEach((b,i)=>{
    let base=db.bases.find(x=>x.id==b.baseId);

    let div=document.createElement('div');
    div.className='card';

    div.innerHTML = `
      <b>${base.name}</b><br>
      <span class="small">Batch: ${b.batch} | Flaske: ${b.nr}</span><br>
      Volum: ${calcVolume(b).toFixed(0)} ml<br>
      Snittscore: ${calcAvg(b.id).toFixed(1)}<br>
      Verdi-score: ${calcValue(b).toFixed(2)}<br><br>
      <button onclick="addTasting(${i})">Smak</button>
      <button onclick="weigh(${i})">Vei</button>
    `;

    el.appendChild(div);
  });
}

// ---------- EXPORT ----------
function exportData(){
  let blob = new Blob([JSON.stringify(db,null,2)],{type:'application/json'});
  let a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download='whiskylogg_backup.json';
  a.click();
}

render();
