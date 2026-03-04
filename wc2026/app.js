// Carga de datos JSON y lógica de puntuación
const DATA = {
  matches: 'data/matches.json',
  predictions: 'data/predictions.json',
  results: 'data/results.json',
  bonusPicks: 'data/bonus_picks.json',
  bonusActual: 'data/bonus_actual.json'
};

let STATE = {
  matches: [],
  participants: [],
  resultsById: new Map(),
  bonus: { picks: [], actual: {} }
};

async function loadAll(){
  const [m,p,r,bp,ba] = await Promise.all([
    fetch(DATA.matches).then(r=>r.json()),
    fetch(DATA.predictions).then(r=>r.json()),
    fetch(DATA.results).then(r=>r.json()),
    fetch(DATA.bonusPicks).then(r=>r.json()),
    fetch(DATA.bonusActual).then(r=>r.json()),
  ]);
  STATE.matches = m.matches;
  STATE.participants = p.participants;
  STATE.resultsById = new Map((r.results||[]).map(x=>[x.matchId, x]));
  STATE.bonus.picks = bp.participants||[];
  STATE.bonus.actual = ba||{};
}

function outcome(h,a){
  if(h>a) return 'H';
  if(h<a) return 'A';
  return 'D';
}

function pointsPerMatch(pred, actual){
  if(!actual) return {pts:0, label:'Sin resultado'};
  const ph = pred?.homeGoalsPred, pa = pred?.awayGoalsPred;
  const ah = actual.homeGoals, aa = actual.awayGoals;
  if(ph==null || pa==null) return {pts:0, label:'Sin predicción'};
  // Regla
  if(ph===ah && pa===aa) return {pts:5, label:'Marcador exacto (5)'};
  const po = outcome(ph,pa), ao = outcome(ah,aa);
  // 3 pts: ganador correcto y sus goles, o empate con marcador diferente
  const threeByWinnerGoals = (ao!=='D' && po===ao && ((ao==='H' && ph===ah) || (ao==='A' && pa===aa)) && (ph!==ah || pa!==aa));
  const threeByDrawDiff = (ao==='D' && po==='D' && (ph!==ah)); // ambos empates pero marcador distinto
  if(threeByWinnerGoals || threeByDrawDiff) return {pts:3, label:'Ganador y sus goles / empate distinto (3)'};
  // 2 pts: solo resultado correcto (ganador o empate) con otro marcador
  if(po===ao) return {pts:2, label:'Resultado correcto (2)'};
  // 1 pt: acierta los goles de un equipo (sin importar resultado)
  if((ph===ah) ^ (pa===aa)) return {pts:1, label:'Acierta goles de un equipo (1)'};
  return {pts:0, label:'No acierta (0)'};
}

const BONUS_WEIGHTS = {
  roundOf32: 2,
  roundOf16: 5,
  quarterfinals: 10,
  semifinals: 15,
  thirdPlace: 17,
  final: 20
};

function pointsBonusForParticipant(email){
  const picks = STATE.bonus.picks.find(x=>x.email===email)?.picks || {};
  const actual = STATE.bonus.actual || {};
  let total = 0; let breakdown = [];
  for(const k of Object.keys(BONUS_WEIGHTS)){
    const weight = BONUS_WEIGHTS[k];
    const wanted = new Set((picks[k]||[]).map(x=>x.trim().toLowerCase()));
    const real = new Set((actual[k]||[]).map(x=>x.trim().toLowerCase()));
    let hit=0;
    for(const t of wanted) if(real.has(t)) hit++;
    const pts = hit*weight; total+=pts;
    breakdown.push({stage:k, hits:hit, pts});
  }
  return {total, breakdown};
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
  let sum = 0;
  for(const m of STATE.matches){
    const pred = p?.predictions?.find(pp=>pp.matchId===m.matchId) || {};
    const actual = STATE.resultsById.get(m.matchId);
    const sc = pointsPerMatch(pred, actual);
    sum += sc.pts;
  }
  return sum;
}

function computeStandings(){
  const rows = STATE.participants.map(p=>{
    const matchPts = matchPointsForParticipant(p);
    const bonus = pointsBonusForParticipant(p.email);
    const total = matchPts + (bonus.total||0);
    return {
      name: p.name,
      email: p.email,
      matchPts,
      bonusPts: bonus.total||0,
      total
    };
  });
  rows.sort((a,b)=> b.total - a.total || b.matchPts - a.matchPts || a.name.localeCompare(b.name));
  return rows;
}

function renderStandings(){
  const tbody = document.querySelector('#standings tbody');
  tbody.innerHTML = '';
  const rows = computeStandings();
  rows.forEach((r, idx)=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="rank">${idx+1}</td>
      <td>
        <div style="font-weight:700">${r.name}</div>
        <div class="muted" style="font-size:12px">${r.email}</div>
      </td>
      <td class="num">${r.matchPts}</td>
      <td class="num">${r.bonusPts}</td>
      <td class="num" style="font-weight:700">${r.total}</td>
    `;
    tbody.appendChild(tr);
  });
}

function wire(){
  const q = document.getElementById('q');
  document.getElementById('btnSearch').addEventListener('click', ()=>renderParticipant(q.value));
  q.addEventListener('keypress', (e)=>{ if(e.key==='Enter'){ renderParticipant(q.value); }});

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
      // When switching to standings, (re)render to ensure it's fresh
      if(target === '#tab-standings') renderStandings();
    });
  });
}

(async function(){
  await loadAll();
  wire();
  // Pre-cargar primer participante como ejemplo
  if(STATE.participants.length) renderParticipant(STATE.participants[0].name);
  // Render inicial de posiciones
  renderStandings();
})();
