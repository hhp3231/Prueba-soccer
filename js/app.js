let partidos=[], resultados=[], participantes=[];

async function cargar(){
partidos = await fetch("data/partidos.json").then(r=>r.json());
resultados = await fetch("data/resultados_oficiales.json").then(r=>r.json());
participantes = await fetch("data/participantes.json").then(r=>r.json());
generarRanking();
}

function calcularPuntos(oficial, pron){
if(!oficial || !pron) return 0;
const o1=oficial.goles1,o2=oficial.goles2;
const p1=pron.goles1,p2=pron.goles2;
if(o1===p1 && o2===p2) return 5;
const rO=Math.sign(o1-o2), rP=Math.sign(p1-p2);
if(rO===rP){
if(rO===0) return 3;
if((rO>0 && p1===o1)||(rO<0 && p2===o2)) return 3;
return 2;
}
if(p1===o1||p2===o2) return 1;
return 0;
}

function calcularBonus(b){
return (b.dieciseisavos*2)+(b.octavos*5)+(b.cuartos*10)+(b.semifinal*15)+(b.tercero*17)+(b.final*20);
}

function generarRanking(){
let ranking=participantes.map(p=>{
let total=0;
partidos.forEach(part=>{
const of=resultados.find(r=>r.id===part.id);
const pr=p.pronosticos.find(x=>x.id===part.id);
total+=calcularPuntos(of,pr);
});
total+=calcularBonus(p.bonus);
return {nombre:p.nombre,puntos:total};
});
ranking.sort((a,b)=>b.puntos-a.puntos);
const tbody=document.querySelector("#ranking tbody");
tbody.innerHTML="";
ranking.forEach((r,i)=>{
tbody.innerHTML+=`<tr><td>${i+1}</td><td>${r.nombre}</td><td>${r.puntos}</td></tr>`;
});
}

document.getElementById("buscador").addEventListener("input",e=>{
const nombre=e.target.value.toLowerCase();
const p=participantes.find(x=>x.nombre.toLowerCase().includes(nombre));
if(!p) return;
document.getElementById("nombreParticipante").innerText=p.nombre;
let total=0;
const tbody=document.querySelector("#tablaPartidos tbody");
tbody.innerHTML="";
partidos.forEach(part=>{
const of=resultados.find(r=>r.id===part.id);
const pr=p.pronosticos.find(x=>x.id===part.id);
const pts=calcularPuntos(of,pr);
total+=pts;
tbody.innerHTML+=`
<tr>
<td>${part.fecha}</td>
<td>${part.equipo1} vs ${part.equipo2}</td>
<td>${of?of.goles1+"-"+of.goles2:"-"}</td>
<td>${pr?pr.goles1+"-"+pr.goles2:"-"}</td>
<td>${pts}</td>
</tr>`;
});
total+=calcularBonus(p.bonus);
document.getElementById("totalPuntos").innerText=total;
});

cargar();