// Carga de datos JSON con anti-cache + mejoras UX
const DATA = {
  matches: 'data/matches.json',
  predictions: 'data/predictions.json',
  results: 'data/results.json',
  bonusPicks: 'data/bonus_picks.json',
  bonusActual: 'data/bonus_actual.json'
};

const VERSION = '20260305-UX';
function bust(url){
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}v=${VERSION}&t=${Date.now()}`; // fuerza no usar caché
}

let STATE = {
  matches: [],
  participants: [],
  resultsById: new Map(),
  bonus: { picks: [], actual: {} }
};

async function safeJson(url){
  const res = await fetch(bust(url), {cache:'no-store'});
  if(!res.ok){ throw new Error(`Error ${res.status} al cargar ${url}`); }
  return res.json();
}

async function loadAll(){
  const [m,p,r,bp,ba] = await Promise.all([
    safeJson(DATA.matches),
    safeJson(DATA.predictions),
    safeJson(DATA.results).catch(()=>({results:[]})),
    safeJson(DATA.bonusPicks).catch(()=>({participants:[]})),
    safeJson(DATA.bonusActual).catch(()=>({})),
  ]);
  STATE.matches = m.matches || [];
  STATE.participants = (p.participants || []).slice();
  STATE.participants.sort((a,b)=> a.name.localeCompare(b.name));
  STATE.resultsById = new Map((r.results||[]).map(x=>[x.matchId, x]));
  STATE.bonus.picks = bp.participants||[];
  STATE.bonus.actual = ba||{};
}

function outcome(h,a){ if(h>a) return 'H'; if(h<a) return 'A'; return 'D'; }

function pointsPerMatch(pred, actual){
  if(!actual) return {pts:0, label:'Sin resultado'};
  const ph = pred?.homeGoalsPred, pa = pred?.awayGoalsPred;
  const ah = actual.homeGoals, aa = actual.awayGoals;
  if(ph==null || pa==null) return {pts:0, label:'Sin predicción'};
  if(ph===ah && pa===aa) return {pts:5, label:'Marcador exacto (5)'};
  const po = outcome(ph,pa), ao = outcome(ah,aa);
  const threeByWinnerGoals = (ao!=='D' && po===ao && ((ao==='H' && ph===ah) || (ao==='A' && pa===aa)) && (ph!==ah || pa!==aa));
  const threeByDrawDiff = (ao==='D' && po==='D' && (ph!==ah));
  if(threeByWinnerGoals || threeByDrawDiff) return {pts:3, label:'Ganador y sus goles / empate distinto (3)'};
  if(po===ao) return {pts:2, label:'Resultado correcto (2)'};
  if((ph===ah) ^ (pa===aa)) return {pts:1, label:'Acierta goles de un equipo (1)'};
  return {pts:0, label:'No acierta (0)'};
}

const BONUS_WEIGHTS = { roundOf32: 2, roundOf16: 5, quarterfinals: 10, semifinals: 15, thirdPlace: 17, final: 20 };

function pointsBonusForParticipant(email){
  const picks = STATE.bonus.picks.find(x=>x.email===email)?.picks || {};
  const actual = STATE.bonus.actual || {};
  let total = 0; let breakdown = [];
  for(const k of Object.keys(BONUS_WEIGHTS)){
    const weight = BONUS_WEIGHTS[k];
    const wanted = new Set((picks[k]||[]).map(x=>x.trim().toLowerCase()));
    const real = new Set((actual[k]||[]).map(x=>x.trim().toLowerCase()));
    let hit=0; for(const t of wanted) if(real.has(t)) hit++;
    const pts = hit*weight; total+=pts; breakdown.push({stage:k, hits:hit, pts});
  }
  return {total, breakdown};
}

function renderParticipantByEmail(email){
  const p = STATE.participants.find(x=>x.email===email);
  if(!p){
    // limpiar vista
    document.getElementById('matches').innerHTML='';
    document.getElementById('s_name').textContent = '—';
    document.getElementById('s_match_pts').textContent = 0;
    document.getElementById('s_bonus').textContent = 0;
    document.getElementById('s_total').textContent = 0;
    return;
  }
  renderParticipant(p.name);
}

function renderParticipant(nameOrEmail){
  const q = (nameOrEmail||'').trim().toLowerCase();
  const p = STATE.participants.find(x=>x.name.toLowerCase().includes(q) || x.email.toLowerCase().includes(q));
  const matchesEl = document.getElementById('matches');
  matchesEl.innerHTML = '';
  let matchPts = 0;
  for(const m of STATE.matches){
    const pred = p?.predictions?.find(pp=>pp.matchId===m.matchId) || {};
    const actual = STATE.resultsById.get(m.matchId);
    const sc = pointsPerMatch(pred, actual);
    matchPts += sc.pts;

    const div = document.createElement('div');
    div.className='match';
    div.innerHTML = `
      <div class="match__id">#${m.matchId}</div>
      <div>
        <div class="team"><span class="team__name">${m.homeTeam}</span>
          <span class="badge">Pred: ${pred.homeGoalsPred??'—'} - ${pred.awayGoalsPred??'—'}</span>
        </div>
        <div class="team"><span class="team__name">${m.awayTeam}</span></div>
      </div>
      <div class="score">
        <div class="badge ${actual? 'badge--ok':'badge--warn'}">Final: ${actual? `${actual.homeGoals} - ${actual.awayGoals}` : '—'}</div>
        <div class="pts">+${sc.pts}</div>
      </div>`;
    div.title = sc.label;
    matchesEl.appendChild(div);
  }
  const bonus = p ? pointsBonusForParticipant(p.email) : {total:0};
  const total = matchPts + (bonus.total||0);
  document.getElementById('s_name').textContent = p ? `${p.name}` : '—';
  document.getElementById('s_match_pts').textContent = matchPts;
  document.getElementById('s_bonus').textContent = bonus.total||0;
  document.getElementById('s_total').textContent = total;
}

function matchPointsForParticipant(p){
  let sum = 0; for(const m of STATE.matches){
    const pred = p?.predictions?.find(pp=>pp.matchId===m.matchId) || {};
    const actual = STATE.resultsById.get(m.matchId);
    sum += pointsPerMatch(pred, actual).pts;
  } return sum;
}

function computeStandings(){
  const rows = STATE.participants.map(p=>{
    const matchPts = matchPointsForParticipant(p);
    const bonus = pointsBonusForParticipant(p.email);
    const total = matchPts + (bonus.total||0);
    return { name: p.name, email: p.email, matchPts, bonusPts: bonus.total||0, total };
  });
  rows.sort((a,b)=> b.total - a.total || b.matchPts - a.matchPts || a.name.localeCompare(b.name));
  return rows;
}

function renderStandings(){
  const tbody = document.querySelector('#standings tbody');
  if(!tbody) return;
  tbody.innerHTML = '';
  computeStandings().forEach((r, idx)=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="rank">${idx+1}</td>
      <td>
        <div style="font-weight:700">${r.name}</div>
        <div class="muted" style="font-size:12px">${r.email}</div>
      </td>
      <td class="center">${r.matchPts}</td>
      <td class="center">${r.bonusPts}</td>
      <td class="center" style="font-weight:700">${r.total}</td>
    `;
    tbody.appendChild(tr);
  });
}

function populateSelect(){
  const sel = document.getElementById('sel');
  if(!sel) return;
  // limpia y agrega opción inicial
  sel.innerHTML = '<option value="">— Selecciona —</option>';
  for(const p of STATE.participants){
    const opt = document.createElement('option');
    opt.value = p.email; opt.textContent = p.name; sel.appendChild(opt);
  }
  sel.addEventListener('change', ()=>{
    const v = sel.value; renderParticipantByEmail(v);
  });
}

function wire(){
  const q = document.getElementById('q');
  const btn = document.getElementById('btnSearch');
  if(btn) btn.addEventListener('click', ()=>renderParticipant(q.value));
  if(q) q.addEventListener('keypress', (e)=>{ if(e.key==='Enter'){ renderParticipant(q.value); }});

  // Tabs
  document.querySelectorAll('.tab').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      document.querySelectorAll('.tab').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      const target = btn.getAttribute('data-target');
      document.querySelectorAll('.tabpanel').forEach(p=>{
        if('#'+p.id === target){ p.classList.add('active'); p.removeAttribute('aria-hidden'); }
        else { p.classList.remove('active'); p.setAttribute('aria-hidden', 'true'); }
      });
      if(target === '#tab-standings') renderStandings();
    });
  });
}

(async function(){
  try{
    await loadAll();
    populateSelect();
    wire();
    // Importante: NO render por defecto de ningún participante
    // Queda todo en '—' hasta que el usuario seleccione o busque
  }catch(err){
    console.error('Error cargando datos:', err);
    alert('No se pudieron cargar los datos. Revisa la consola y las rutas /data/*.json');
  }
})();
