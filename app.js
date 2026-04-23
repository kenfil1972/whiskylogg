let data = JSON.parse(localStorage.getItem('wl')||'[]');

function save(){localStorage.setItem('wl',JSON.stringify(data));render();}

function addBottle(){
  let name = prompt("Navn på flaske?");
  let batch = prompt("Batch nr?");
  let bottle = prompt("Flaske nr?");
  data.push({name,batch,bottle});
  save();
}

function render(){
  let el=document.getElementById('list');
  el.innerHTML='';
  data.forEach((b,i)=>{
    let li=document.createElement('li');
    li.innerHTML = b.name + " ("+b.batch+"/"+b.bottle+") <button onclick='del("+i+")'>X</button>";
    el.appendChild(li);
  });
}

function del(i){
  data.splice(i,1);
  save();
}

render();
