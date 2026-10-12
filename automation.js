import {state,automation,automationRules,runAutomation,save,nav,toast,modal,closeModal,confirmDialog,icon,esc,fmt,badge,empty,field} from './core.js';

const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const all=()=>state.automations||[];
const statusName=s=>({success:'运行成功',failed:'运行失败',partial:'部分完成',running:'运行中',cancelled:'已中断'})[s]||s;
const schedule=a=>a.frequency==='manual'?'仅手动运行':`${a.frequency==='weekly'?'每周一':'每天'} ${a.time||'08:30'}`;
const scopeName=a=>`${a.region} · ${a.product} · ${(a.warehouses||[]).join('、')}`;
const selected=()=>automation(state.automationId)||all()[0];
const enabledRules=a=>automationRules(a).filter(r=>r.status==='enabled');
const taskState=a=>a.running?badge('运行中','purple'):badge(a.enabled?'已启用':'已暂停',a.enabled?'green':'gray');
const runBadge=r=>badge(statusName(r.status),r.status==='success'?'green':r.status==='failed'?'red':r.status==='partial'?'amber':'purple');
const ui=()=>state.opsUI||(state.opsUI={homeTab:'open',taskTab:'pending',automationTab:'tasks',filters:{pending:{},all:{}}});
function nextRun(a){
 if(!a.enabled)return '已暂停，无下次计划';
 if(a.frequency==='manual')return '仅手动运行';
 const date=new Date(state.stage==='review'?'2026-11-02T09:00:00Z':'2026-09-30T09:00:00Z');
 if(a.frequency==='weekly')date.setUTCDate(date.getUTCDate()+((8-date.getUTCDay())%7||7));
 else date.setUTCDate(date.getUTCDate()+1);
 return `${date.toISOString().slice(0,10)} ${a.time||'08:30'}`;
}
function keepConfirm(host,title,description,onConfirm,label='确认'){
 if(host.querySelector('.ops-confirm-overlay'))return;
 const layer=document.createElement('div');layer.className='ops-confirm-overlay';
 layer.innerHTML=`<div class="ops-confirm-panel"><h3>${esc(title)}</h3><p>${esc(description)}</p><div class="drawer-footer"><button class="btn" data-back>继续编辑</button><button class="btn primary" data-ok>${esc(label)}</button></div></div>`;
 host.append(layer);$('[data-back]',layer).onclick=()=>layer.remove();
 $('[data-ok]',layer).onclick=e=>{e.currentTarget.disabled=true;closeModal();onConfirm();};
}

export function renderAutomationSummary(){
 const list=all(),enabled=list.filter(a=>a.enabled).length;
 return `<section class="card ops-automation-summary"><div class="card-header"><h2 class="section-title">AI持续任务 ${badge(list.length,'purple')}</h2><span class="tiny muted">${enabled} 个已启用</span></div><div class="card-body">${list.length?list.map(a=>`<div class="list-row" style="padding:14px 0;gap:12px"><div style="min-width:0"><b>${esc(a.name)}</b><p class="tiny muted">${esc(schedule(a))} · ${esc(a.warehouses.join('、'))}</p><div class="row">${taskState(a)}<span class="tiny muted">${a.running?'正在检查预测':a.runs[0]?statusName(a.runs[0].status):'尚未运行'}</span></div></div><button class="btn small" data-auto-run="${esc(a.id)}" ${a.running?'disabled':''}>${icon('play',14)}${a.running?'运行中':'立即运行'}</button></div>`).join(''):empty('尚未配置持续任务','按不同范围与频率创建独立任务。')}<div class="row between section-gap"><button class="btn small" data-auto-config="">${icon('plus',14)}新增任务</button><button class="text-button" data-nav="automation">管理全部任务 ${icon('arrow',14)}</button></div><div class="ops-boundary">${icon('shield',14)} 仅生成诊断与提醒，业务版本由你确认</div></div></section>`;
}

function renderRules(){return `<section class="card"><div class="card-header"><h3 class="section-title">业务判断规则</h3><button class="btn small" data-rule="">${icon('plus',14)}新增规则</button></div>${state.rules.map(r=>`<div class="list-row"><div class="row"><span class="icon-box">${icon('shield')}</span><div><b>${esc(r.name)}</b><p class="tiny muted">参考上限 ${fmt(r.threshold)}% · R${r.revision}${r.draft?` / 待启用 R${r.draft.revision||r.revision+1}`:''} · ${all().filter(a=>(a.ruleIds||[]).includes(r.id)).length} 个任务已关联</p></div></div><div class="row">${badge(r.status==='enabled'?'已启用':r.status==='paused'?'已暂停':'草稿',r.status==='enabled'?'green':r.status==='paused'?'amber':'gray')}<button class="btn small" data-rule="${esc(r.id)}">${r.draft?'检查修订':'查看规则'}</button></div></div>`).join('')}</section><div class="alert info section-gap">规则可被多个持续任务使用；后续运行仅采用任务所选规则的已启用修订。修改规则可能影响所有关联任务。</div>`;}
function renderCard(a,current){
 return `<section class="card ops-auto-card" data-auto-card="${esc(a.id)}" style="${current?'border-color:#bba7f2;':''}"><div class="card-body"><div class="row between"><div class="row"><span class="ops-bot-icon">${icon('sparkles',24)}</span><div><h2 class="section-title">${esc(a.name)}</h2><p class="muted tiny">${esc(a.id)} · 预测诊断与提醒</p></div></div>${taskState(a)}</div><div class="ops-auto-kvs" style="grid-template-columns:repeat(2,minmax(0,1fr));padding:16px 0;margin:4px 0 14px"><div><span>业务范围</span><b>${esc(a.region)} · ${esc(a.product)}</b><small>${esc(a.warehouses.join('、'))}</small></div><div><span>执行计划</span><b>${esc(schedule(a))}</b><small>下次：${esc(nextRun(a))}</small></div></div><div class="row between" style="flex-wrap:wrap;gap:10px"><span class="tiny muted">最近：${a.running?'运行中':a.runs[0]?statusName(a.runs[0].status):'尚未运行'} · ${a.runs.length} 次运行</span><button class="text-button" data-auto-select="${esc(a.id)}" aria-pressed="${current}">${current?'正在查看记录':'查看运行记录'} ${icon('chevron',13)}</button></div><div class="row section-gap" style="flex-wrap:wrap"><button class="btn small" data-auto-config="${esc(a.id)}">编辑配置</button><button class="btn small" data-auto-toggle="${esc(a.id)}">${icon(a.enabled?'pause':'play',14)}${a.enabled?'暂停':'启用'}</button><button class="btn primary small" data-auto-run="${esc(a.id)}" ${a.running?'disabled':''}>${icon('play',14)}${a.running?'运行中':'立即运行'}</button></div></div></section>`;
}
function renderDetail(a){
 const rules=state.rules.filter(r=>(a.ruleIds||[]).includes(r.id)),active=enabledRules(a);
 return `<div id="automation-detail" class="section-gap"><div class="row between"><div><h2 class="section-title">${esc(a.name)} · 运行详情</h2><p class="tiny muted">以下配置与记录仅属于 ${esc(a.id)}，查看其他任务请点击对应卡片的“查看运行记录”。</p></div>${taskState(a)}</div><div class="grid-2 section-gap"><section class="card"><div class="card-header"><h3 class="section-title">运行配置</h3><button class="text-button" data-auto-config="${esc(a.id)}">修改</button></div><div class="card-body"><div class="kv"><span>检查范围</span><b>${esc(scopeName(a))}</b></div><div class="kv"><span>检查对象</span><b>范围内已生成 / 待确认预测</b></div><div class="kv"><span>执行计划</span><b>${esc(schedule(a))} · Asia/Shanghai</b></div><div class="kv"><span>关联规则</span><div>${rules.length?rules.map(r=>`<div><button class="text-button" data-rule="${esc(r.id)}">${esc(r.name)} ${icon('external',13)}</button> ${badge(r.status==='enabled'?'已启用':r.status==='paused'?'已暂停':'草稿',r.status==='enabled'?'green':'gray')}</div>`).join(''):'<b>尚未选择规则</b>'}</div></div>${!active.length?'<div class="alert warning tiny">尚无已启用的关联规则，请编辑配置选择规则，并在业务规则中启用后再运行。</div>':''}<div class="kv"><span>结果去向</span><b>我的工作台 · 对应预测诊断</b></div><div class="kv"><span>操作边界</span><b>不自动确认、不生成订单、不对外发送</b></div></div></section><section class="card"><div class="card-header"><h3 class="section-title">运行概览</h3>${badge('本地演示','gray')}</div><div class="card-body"><div class="ops-run-metrics"><div><b>${a.runs.filter(r=>r.status==='success').length}</b><span>检查完成</span></div><div><b>${a.runs.filter(r=>r.status==='partial').length}</b><span>部分完成</span></div><div><b>${a.runs.filter(r=>r.status==='failed').length}</b><span>运行失败</span></div></div><div class="kv"><span>下次计划</span><b>${esc(nextRun(a))}</b></div><p class="tiny muted">检查完成后的问题仍需要业务判断。定时与执行为原型本地演示，保存配置不会立即运行。</p></div></section></div><section class="card section-gap"><div class="card-header"><h3 class="section-title">运行记录 ${badge(a.runs.length,'gray')}</h3><button class="text-button" data-run-demo="${esc(a.id)}">${icon('help',14)}原型状态示例</button></div>${a.runs.length?`<div class="table-wrap"><table><thead><tr><th>运行时间</th><th>运行状态</th><th>检查结果</th><th>操作</th></tr></thead><tbody>${a.runs.map(r=>`<tr><td><b>${esc(r.time)}</b><p class="tiny muted">${esc(r.id)}</p></td><td>${runBadge(r)}</td><td>${esc(r.summary)}${r.retryOf?`<p class="tiny muted">重试自 ${esc(r.retryOf)}${r.scope?' · '+esc(r.scope):''}</p>`:''}</td><td><button class="text-button" data-run-detail="${esc(r.id)}" data-automation-id="${esc(a.id)}">查看详情 ${icon('chevron',13)}</button></td></tr>`).join('')}</tbody></table></div>`:empty('还没有运行记录',a.enabled?'启用不会立即运行，可点击“立即运行”进行一次检查。':'任务已保存并暂停。可单独启用，或点击“立即运行”手动检查一次。')}</section></div>`;
}
export function renderAutomation(){
 const a=selected(),rules=state.opsUI?.automationTab==='rules';
 return `<div class="page-head"><div><div class="eyebrow">JINGHUI INTELLIGENCE</div><h1 class="page-title">我的托管</h1><p class="subtitle">按业务范围与执行计划，分别管理你的持续检查任务</p></div><div class="head-actions"><button class="btn primary" data-auto-config="">${icon('plus')}新增托管任务</button></div></div><div class="tabs ops-top-tabs"><button class="tab ${!rules?'active':''}" data-auto-tab="tasks">持续任务 ${badge(all().length,'purple')}</button><button class="tab ${rules?'active':''}" data-auto-tab="rules">业务规则 ${badge(state.rules.length,'gray')}</button></div>${rules?renderRules():`${all().length?`<div class="row between"><p class="tiny muted">共 ${all().length} 个任务 · ${all().filter(x=>x.enabled).length} 个已启用 · 各任务独立配置与运行</p></div><div class="grid-2">${all().map(x=>renderCard(x,x.id===a?.id)).join('')}</div>`:`<section class="card">${empty('还没有持续任务','可按仓库、执行频率和判断规则分别创建多个任务。','<button class="btn primary" data-auto-config="">配置第一个任务</button>')}</section>`}${a?renderDetail(a):''}`}`;
}

export function openAutomationConfig(id=null){
 const editing=id?automation(id):null;
 if(id&&!editing)return toast('持续任务不存在','error');
 const config=editing?structuredClone(editing):{name:'',region:state.settings.region||'华东',product:state.settings.product||'A商品',warehouses:[...state.settings.warehouses],frequency:state.settings.frequency||'daily',time:state.settings.time||'08:30',ruleIds:state.rules.filter(r=>r.status==='enabled').map(r=>r.id)};
 modal(editing?'编辑持续任务':'新增持续任务',`<p class="muted tiny">${editing?'修改仅影响本任务的后续运行，历史运行记录保留。':'每个任务拥有独立的范围、计划和运行记录；新任务保存后默认暂停。'}</p><div class="form-grid">${field('任务名称 *',`<input class="input" id="auto-name" maxlength="60" value="${esc(config.name)}" placeholder="例如：上海仓每日预测诊断">`)}${field('任务类型','<input class="input" value="预测诊断与提醒" disabled>')}</div><h3 class="section-gap">检查范围</h3><div class="form-grid">${field('区域',`<input class="input" value="${esc(config.region)}" disabled>`)}${field('商品',`<input class="input" value="${esc(config.product)}" disabled>`)}</div><div class="field"><label class="field-label">检查仓库 *</label><div class="row"><label class="check-row"><input type="checkbox" id="auto-sh" ${config.warehouses.includes('上海仓')?'checked':''}>上海仓</label><label class="check-row"><input type="checkbox" id="auto-hz" ${config.warehouses.includes('杭州仓')?'checked':''}>杭州仓</label></div><p class="field-hint">本任务只检查所选仓库的已有预测；不会修改你的工作设置或其他任务。</p></div><h3 class="section-gap">执行计划</h3><div class="form-grid">${field('执行频率',`<select class="select" id="auto-frequency"><option value="daily" ${config.frequency==='daily'?'selected':''}>每日</option><option value="weekly" ${config.frequency==='weekly'?'selected':''}>每周一</option><option value="manual" ${config.frequency==='manual'?'selected':''}>仅手动</option></select>`)}${field('执行时间',`<input class="input" type="time" id="auto-time" value="${esc(config.time)}">`,'Asia/Shanghai（北京时间）')}</div><p id="auto-schedule-preview" class="tiny muted" aria-live="polite"></p><h3 class="section-gap">关联业务规则</h3>${state.rules.length?state.rules.map(r=>`<label class="check-row" style="margin:12px 0"><input type="checkbox" data-auto-rule="${esc(r.id)}" ${(config.ruleIds||[]).includes(r.id)?'checked':''}><span>${esc(r.name)}<small class="muted"> · R${r.revision} · ${r.status==='enabled'?'已启用':r.status==='paused'?'已暂停':'草稿'}</small></span></label>`).join(''):'<div class="alert warning tiny">暂无业务规则，可先保存任务，再到业务规则中创建并启用。</div>'}<p class="field-hint">运行时仅使用所选规则中已启用的修订。未选择有效规则时可保存暂停的任务，启用和运行前需补齐。</p><h3 class="section-gap">结果与提醒</h3><div class="kv"><span>结果去向</span><b>我的工作台 · 对应预测诊断</b></div><div class="kv"><span>提醒方式</span><b>站内提醒 · 李明</b></div><div class="kv"><span>执行动作</span><b>检查预测并生成诊断，业务版本由你确认</b></div><div id="auto-config-error" class="field-hint" role="alert"></div><div class="drawer-footer"><button class="btn" id="auto-config-cancel">取消</button><button class="btn primary" id="auto-config-save">${editing?'检查并保存配置':'检查并创建任务'}</button></div>`,d=>{
  let dirty=false,submitted=false;
  const preview=()=>{const f=$('#auto-frequency',d).value,t=$('#auto-time',d);t.disabled=f==='manual';$('#auto-schedule-preview',d).textContent=f==='manual'?'仅在点击“立即运行”后执行，不安排定时检查。':`${f==='weekly'?'每周一':'每天'} ${t.value||'（请选择时间）'} 检查。${editing?.enabled?'保存后从下一次运行采用新配置。':'保存后保持暂停，可在任务卡片单独启用。'}`;};
  d.addEventListener('input',()=>dirty=true);d.addEventListener('change',()=>dirty=true);
  $('#auto-frequency',d).onchange=preview;$('#auto-time',d).oninput=preview;preview();
  $('#auto-config-cancel',d).onclick=()=>dirty?keepConfirm(d,'放弃本次配置？','尚未保存的任务配置将丢失。',closeModal,'放弃修改'):closeModal();
  $('#auto-config-save',d).onclick=()=>{
   if(submitted)return;
   const next={name:$('#auto-name',d).value.trim(),region:config.region,product:config.product,warehouses:[$('#auto-sh',d).checked?'上海仓':null,$('#auto-hz',d).checked?'杭州仓':null].filter(Boolean),frequency:$('#auto-frequency',d).value,time:$('#auto-time',d).value||'08:30',ruleIds:$$('[data-auto-rule]:checked',d).map(x=>x.dataset.autoRule)};
   const error=!next.name?'请输入任务名称。':next.name.length>60?'任务名称最多60个字。':!next.warehouses.length?'请至少选择一个仓库。':next.frequency!=='manual'&&!/^([01]\d|2[0-3]):[0-5]\d$/.test($('#auto-time',d).value)?'请选择有效的执行时间。':editing?.enabled&&!next.ruleIds.some(rid=>state.rules.some(r=>r.id===rid&&r.status==='enabled'))?'已启用任务需保留至少一条已启用规则。可先暂停任务，再保存不含生效规则的配置。':'';
   $('#auto-config-error',d).textContent=error;if(error)return;
   keepConfirm(d,editing?'确认修改此任务？':'确认创建持续任务？',`${next.name}；${next.warehouses.join('、')}；${schedule(next)}。${editing?'仅更新本任务配置，保留启停状态和历史记录。':'保存后为暂停状态，需要单独启用。'} 本次保存不会执行检查。`,()=>{
    if(submitted)return;submitted=true;
    let a=editing&&automation(editing.id);
    if(editing&&!a)return toast('任务不存在，请刷新后重试','error');
    if(a)Object.assign(a,next);
    else {const n=Math.max(0,...all().map(x=>Number(x.id.replace(/^T/,''))||0))+1;a={id:'T'+String(n).padStart(3,'0'),...next,enabled:false,running:false,runs:[]};state.automations.push(a);}
    state.automationId=a.id;ui().automationTab='tasks';save();
    toast(editing?'本任务配置已保存':'持续任务已创建并暂停，可单独启用');
   },editing?'保存配置':'创建任务');
  };
 });
}
function startAutomation(id,outcome='success',retryOf=null,scope=null){
 const a=automation(id);if(!a)return toast('持续任务不存在','error');
 if(a.running)return toast('此任务正在运行，请等待完成','info');
 if(!enabledRules(a).length)return toast('请为此任务选择至少一条已启用的业务规则','error');
 confirmDialog(retryOf?'重试本次范围':'立即运行一次',esc(`${a.name}：${scope?'仅检查'+scope:scopeName(a)}。按本任务保存的配置检查，不改变启停状态或后续计划。`),()=>runAutomation(outcome,a.id,{retryOf,scope}),'开始运行');
}
function runDetail(autoId,runId){
 const a=automation(autoId),r=a?.runs.find(x=>x.id===runId);if(!r)return toast('运行记录不存在','error');
 const snapshot=r.scopeSnapshot||r.configSnapshot||a,rs=r.rulesSnapshot||(Array.isArray(r.ruleSnapshot)?r.ruleSnapshot:r.ruleSnapshot?[r.ruleSnapshot]:[]);
 const taskIds=r.status==='partial'?(r.checkedTaskIds||r.relatedTaskIds):r.relatedTaskIds;
 const targets=Array.isArray(taskIds)?state.tasks.filter(t=>taskIds.includes(t.id)):state.tasks.filter(t=>!t.archived&&t.status==='success'&&t.region===snapshot.region&&t.product===snapshot.product&&(t.warehouses||[]).some(w=>(snapshot.warehouses||a.warehouses).includes(w)));
 const unfinished=r.remainingScope||a.warehouses.filter(w=>w==='杭州仓');
 const retryScope=r.status==='partial'?unfinished.join('、'):r.scope||null;
 modal('运行详情',`<div class="row between"><div><h3>${esc(r.id)}</h3><p class="tiny muted">${esc(r.time)} · ${esc(r.taskName||a.name)} · ${esc(a.id)}</p></div>${runBadge(r)}</div><div class="alert ${r.status==='failed'?'warning':'info'}">${esc(r.summary)}</div><div class="ops-run-steps">${['读取预测快照','按生效规则检查','整理诊断与提醒'].map((x,i)=>`<div><span class="${r.status==='failed'&&i===0?'failed':''}">${icon(r.status==='running'?'refresh':r.status==='failed'?'alert':'check',15)}</span><b>${x}</b><small>${r.status==='running'?'处理中':r.status==='failed'?(i===0?'读取失败':'未执行'):r.status==='partial'&&i===1?'部分范围未完成':r.status==='cancelled'?'已中断':'已完成'}</small></div>`).join('')}</div><div class="kv"><span>检查范围</span><b>${esc(r.scope||scopeName(snapshot))}</b></div><div class="kv"><span>规则快照</span><b>${rs.length?rs.map(x=>`${esc(x.name)} · R${x.revision}`).join('<br>'):'历史记录未保存规则快照'}</b></div>${r.status==='partial'?`<div class="kv"><span>未完成范围</span><b>${esc(retryScope||'请查看运行结果')}</b></div>`:''}<div class="kv"><span>结果说明</span><b>检查完成不代表预测已确认</b></div>${!['failed','running','cancelled'].includes(r.status)?`<h3 class="section-gap">关联预测 ${targets.length}</h3>${targets.length?targets.map(t=>`<div class="list-row"><div><b>${esc(t.name)}</b><p class="tiny muted">${esc(t.id)} · ${esc(t.warehouses.join('、'))}</p></div><button class="btn small" data-result-task="${esc(t.id)}">查看诊断</button></div>`).join(''):'<p class="tiny muted">本次范围内没有可查看的预测。</p>'}`:''}<div class="drawer-footer"><button class="btn" data-run-close>返回记录</button>${r.status==='failed'||r.status==='partial'?`<button class="btn primary" data-run-retry>${r.status==='partial'?'重跑未完成范围':'重试本次范围'}</button>`:''}</div>`,d=>{
  $('[data-run-close]',d).onclick=closeModal;
  $$('[data-result-task]',d).forEach(b=>b.onclick=()=>{closeModal();nav('forecast',{taskId:b.dataset.resultTask,tab:'diagnosis'});});
  if($('[data-run-retry]',d))$('[data-run-retry]',d).onclick=()=>{closeModal();startAutomation(a.id,'success',r.id,retryScope);};
 });
}
export function bindAutomation(root){
 $$('[data-auto-config]',root).forEach(b=>b.onclick=()=>openAutomationConfig(b.dataset.autoConfig||null));
 $$('[data-auto-tab]',root).forEach(b=>b.onclick=()=>{ui().automationTab=b.dataset.autoTab;save();});
 $$('[data-auto-select]',root).forEach(b=>b.onclick=()=>{state.automationId=b.dataset.autoSelect;save();$('#automation-detail')?.scrollIntoView({behavior:'smooth',block:'start'});});
 $$('[data-auto-run]',root).forEach(b=>b.onclick=()=>startAutomation(b.dataset.autoRun||selected()?.id));
 $$('[data-auto-toggle]',root).forEach(b=>b.onclick=()=>{
  const a=automation(b.dataset.autoToggle);if(!a)return;
  if(!a.enabled&&!enabledRules(a).length)return toast('请为此任务选择至少一条已启用的业务规则','error');
  const enabled=a.enabled;
  confirmDialog(enabled?'暂停此持续任务？':'启用此持续任务？',esc(`${a.name}：${enabled?(a.frequency==='manual'?'将本任务标记为暂停，本次正在进行的检查继续完成。':'停止本任务后续计划，本次正在进行的检查继续完成。'):(a.frequency==='manual'?'启用后仍仅在点击“立即运行”时检查，不安排定时执行。':'按本任务保存的计划启用，不立即执行或补跑历史。')}其他任务保持各自的运行状态。`),()=>{const current=automation(a.id);if(!current)return;current.enabled=!enabled;save();toast(enabled?'此任务已暂停':'此任务已启用');},enabled?'确认暂停':'确认启用');
 });
 $$('[data-run-detail]',root).forEach(b=>b.onclick=()=>runDetail(b.dataset.automationId,b.dataset.runDetail));
 $$('[data-run-demo]',root).forEach(b=>b.onclick=()=>{
  const id=b.dataset.runDemo,a=automation(id);if(!a)return;
  modal('原型状态示例',`<p class="muted">为“${esc(a.name)}”新增一条模拟运行，保留所有历史记录。</p><div class="stack"><button class="btn" data-outcome="success">成功：检查完成并关联待办</button><button class="btn" data-outcome="failed">失败：无法读取预测快照</button>${a.warehouses.length>1?'<button class="btn" data-outcome="partial">部分完成：杭州仓数据未就绪</button>':''}</div>`,d=>$$('[data-outcome]',d).forEach(b=>b.onclick=()=>{closeModal();startAutomation(id,b.dataset.outcome);}));
 });
}
