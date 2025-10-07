
// PWA registration & install prompt (relative path)
let deferredPrompt=null;
if('serviceWorker' in navigator){navigator.serviceWorker.register('sw.js').catch(console.error)}
window.addEventListener('beforeinstallprompt',(e)=>{e.preventDefault();deferredPrompt=e;const b=document.getElementById('installBtn');if(b)b.disabled=false});
document.getElementById('installBtn')?.addEventListener('click',async()=>{if(!deferredPrompt)return;await deferredPrompt.prompt();deferredPrompt=null});

// Local profiles
const LS_USERS='focusly_users';
const LS_ACTIVE='focusly_activeUserId';
const LS_USER_PREFIX='focusly_user_';
const defaultState=()=>({userStats:{level:1,currentXP:0,nextLevelXP:100,streak:0,weeklyCompleted:0,weeklyGoal:15,totalCompleted:0,waterToday:0,bathroomToday:0},tasks:{q1:[],q2:[],q3:[],q4:[]},createdAt:new Date().toISOString()});
let users=JSON.parse(localStorage.getItem(LS_USERS)||'[]');
let activeId=localStorage.getItem(LS_ACTIVE)||null;let state=null;
const $=(s)=>document.querySelector(s);const toast=(t)=>{const el=$('#toast');el.textContent=t;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),2200)};
const saveState=()=>localStorage.setItem(LS_USER_PREFIX+activeId,JSON.stringify(state));
const loadState=(id)=>JSON.parse(localStorage.getItem(LS_USER_PREFIX+id)||'null');
function setTs(key){ localStorage.setItem(key, String(Date.now())); }
function getTs(key){ return parseInt(localStorage.getItem(key) || '0', 10); }
function minutesSince(key){ const t=getTs(key); return t? Math.floor((Date.now()-t)/60000) : Infinity; }

function mountAuth(){$('#authView').classList.remove('hidden');$('#appView').classList.add('hidden');renderProfiles();$('#profileChip').textContent=''}
function mountApp(){$('#authView').classList.add('hidden');$('#appView').classList.remove('hidden');$('#profileChip').textContent=users.find(u=>u.id===activeId)?.name||'';renderAll()}
function renderProfiles(){const box=$('#profilesList');box.innerHTML='';if(!users.length){box.innerHTML='<p>Nessun profilo. Creane uno.</p>';return}users.forEach(u=>{const row=document.createElement('div');row.className='row';row.innerHTML=`<button data-act="sel" data-id="${u.id}">Apri: ${u.name}</button><button class="secondary" data-act="del" data-id="${u.id}">Elimina</button>`;box.appendChild(row)});box.onclick=(e)=>{const id=e.target.dataset.id,act=e.target.dataset.act;if(!id)return;if(act==='sel'){activeId=id;localStorage.setItem(LS_ACTIVE,id);state=loadState(id)||defaultState();mountApp()}else if(act==='del'){if(!confirm('Eliminare il profilo e i suoi dati?'))return;localStorage.removeItem(LS_USER_PREFIX+id);users=users.filter(x=>x.id!==id);localStorage.setItem(LS_USERS,JSON.stringify(users));if(activeId===id){activeId=null;localStorage.removeItem(LS_ACTIVE)}renderProfiles()}}}
$('#createProfileBtn').addEventListener('click',()=>{const name=($('#newProfileName').value||'').trim();if(!name)return toast('Inserisci un nome profilo');const id=(crypto?.randomUUID?.()||Date.now().toString(36));users.push({id,name,createdAt:new Date().toISOString()});localStorage.setItem(LS_USERS,JSON.stringify(users));localStorage.setItem(LS_USER_PREFIX+id,JSON.stringify(defaultState()));activeId=id;localStorage.setItem(LS_ACTIVE,id);state=defaultState();mountApp()});

function addTask(q){const title=prompt('Titolo task');if(!title)return;const desc=prompt('Descrizione (opzionale)')||'';state.tasks[q].push({id:Date.now(),title,desc,done:false});state.userStats.currentXP+=10;saveState();renderAll();toast('Task creato (+10 XP)')}
function toggleTask(q,id){const t=state.tasks[q].find(x=>x.id===id);if(!t)return;if(!t.done){if(!confirm('Confermi completamento?'))return;t.done=true;state.userStats.currentXP+=50;state.userStats.weeklyCompleted+=1;state.userStats.totalCompleted+=1;if(state.userStats.currentXP>=state.userStats.nextLevelXP){state.userStats.level+=1;state.userStats.currentXP-=state.userStats.nextLevelXP;state.userStats.nextLevelXP=Math.floor(state.userStats.nextLevelXP*1.5);toast(`Level up! Lv ${state.userStats.level}`)}else{toast('Task completato (+50 XP)')}}else{t.done=false}saveState();renderAll()}
function renderQuadrant(q){const ul=document.getElementById(q);ul.innerHTML='';state.tasks[q].forEach(item=>{const li=document.createElement('li');li.className=item.done?'done':'';li.innerHTML=`<input type="checkbox" ${item.done?'checked':''} /> <span>${item.title}</span>`;li.querySelector('input').addEventListener('change',()=>toggleTask(q,item.id));ul.appendChild(li)})}
function renderStats(){$('#xpVal').textContent=state.userStats.currentXP;$('#lvlVal').textContent=state.userStats.level;$('#wkVal').textContent=`${state.userStats.weeklyCompleted}/${state.userStats.weeklyGoal}`}
function renderAll(){['q1','q2','q3','q4'].forEach(renderQuadrant);renderStats()}
document.querySelectorAll('.add').forEach(b=>b.addEventListener('click',()=>addTask(b.dataset.q)));
$('#switchProfileBtn').addEventListener('click',mountAuth);

// Notifications every 6h (relative icon paths)
function scheduleAt(h,m,msg){
  const now=new Date();
  const target=new Date(now.getFullYear(),now.getMonth(),now.getDate(),h,m,0);
  if(target<=now) target.setDate(target.getDate()+1);
  const delay=target.getTime()-now.getTime();
  setTimeout(()=>{
    if(Notification.permission==='granted'){
      new Notification('Focusly ADHD',{body:msg,icon:'icons/icon-192.png',tag:'6h'});
      setTs('focusly_last_6h_'+h+'_'+m);
    }
    scheduleAt(h,m,msg);
  },delay)
}
function start6hReminders(){scheduleAt(6,0,'🌅 Buongiorno! Inizia con Q1.');scheduleAt(12,0,'☀️ Metà giornata: rivedi i progressi.');scheduleAt(18,0,'🌆 Sera: completa gli urgenti.');scheduleAt(0,0,'🌙 Chiudi il giorno e pianifica domani.')}

// Frequent local reminders + catch-up
const REMINDERS = { q1Minutes: 45, waterMinutes: 60, bathMinutes: 180 };
let _reminderTimerStarted = false;
function runFrequentRemindersOnce(){
  if(Notification.permission!=='granted') return;
  const hasQ1 = state?.tasks?.q1?.some(t=>!t.done);
  if(hasQ1 && minutesSince('focusly_last_q1')>=REMINDERS.q1Minutes){
    new Notification('Focusly ADHD',{body:'⏱️ Rivedi Q1: completa i più urgenti',icon:'icons/icon-192.png',tag:'q1-frequent'});
    setTs('focusly_last_q1');
  }
  if(minutesSince('focusly_last_water')>=REMINDERS.waterMinutes){
    new Notification('Focusly ADHD',{body:'💧 Bevi un bicchiere d’acqua',icon:'icons/icon-192.png',tag:'water-frequent'});
    setTs('focusly_last_water');
  }
  if(minutesSince('focusly_last_bath')>=REMINDERS.bathMinutes){
    new Notification('Focusly ADHD',{body:'🚻 Fai una breve pausa bagno',icon:'icons/icon-192.png',tag:'bath-frequent'});
    setTs('focusly_last_bath');
  }
}
function startFrequentRemindersLoop(){
  if(_reminderTimerStarted) return; _reminderTimerStarted=true;
  runFrequentRemindersOnce();
  setInterval(runFrequentRemindersOnce, 60*1000);
  document.addEventListener('visibilitychange',()=>{ if(!document.hidden) runFrequentRemindersOnce(); });
}
async function enableNotifications(){
  if(!('Notification'in window))return toast('Notifiche non supportate');
  let p=Notification.permission;
  if(p==='default')p=await Notification.requestPermission();
  if(p!=='granted')return toast('Permessi negati');
  toast('Notifiche attive');
  start6hReminders();
  startFrequentRemindersLoop();
}
document.addEventListener('visibilitychange',()=>{
  if(document.hidden) return;
  if(Notification.permission==='granted'){
    const lastKeys=['focusly_last_6h_6_0','focusly_last_6h_12_0','focusly_last_6h_18_0','focusly_last_6h_0_0'];
    const vals=lastKeys.map(k=>getTs(k)).filter(v=>v>0);
    if(!vals.length || ((Date.now()-Math.min(...vals))/60000)>=360){
      new Notification('Focusly ADHD',{body:'🔔 Promemoria: rivedi i tuoi task oggi',icon:'icons/icon-192.png',tag:'sixh-catchup'});
      setTs('focusly_last_6h_catch');
    }
  }
});

(function(){if(users.length&&activeId){state=loadState(activeId)||defaultState();mountApp()}else{mountAuth()}})();
