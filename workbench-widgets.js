import {state,version,icon,esc,fmt,sum,badge} from './core.js';

const currentVersion=t=>version(t,t?.candidate)||version(t,t?.confirmed)||version(t,t?.viewed)||t?.versions?.[0];
const inScope=(t,c)=>c.warehouse==='all'||!c.warehouse||(t.warehouses||[]).includes(c.warehouse);
const unresolved=t=>t.diagnosis&&[t.candidate,t.confirmed].includes(t.diagnosis.version)&&['open','waiting','snoozed'].includes(t.diagnosis.status);
const warehouseName=w=>['上海仓','杭州仓'].includes(w)?w:'all';
const grainName=g=>g==='day'?'day':'week';
const liveTask=id=>(state.tasks||[]).find(t=>t.id===id&&!t.archived);
function forecastLink(t,c,label,warehouse=c.warehouse||'all'){
 return `<button class="text-button" data-personal-forecast="${esc(t.id)}" data-warehouse="${esc(warehouseName(warehouse))}" data-grain="${grainName(c.grain)}">${esc(label)} ${icon('arrow',12)}</button>`;
}
function header(title,kicker,command,extra=''){
 return `<div class="personal-module-head"><div><span class="personal-kicker">${esc(kicker)}</span><h2>${esc(title)}</h2></div><div class="wb-widget-controls">${extra}<button class="wb-widget-hide" data-workbench-command="${esc(command)}" title="隐藏${esc(title)}" aria-label="隐藏${esc(title)}">${icon('x',14)}</button></div></div>`;
}
function amount(v,w){
 if(!v?.data?.length)return null;
 if(w==='all')return sum(v.data);
 const key=w==='上海仓'?'sh':'hz';
 // Same per-day demonstration split used in the forecast result page.
 return sum(v.data.map((value,i)=>Number(v.warehouseData?.[i]?.[key]??(key==='sh'?Math.round(Number(value)*.6):Number(value)-Math.round(Number(value)*.6)))));
}
function brief(c){
 const tasks=(state.tasks||[]).filter(t=>!t.archived&&inScope(t,c));
 const pending=tasks.filter(t=>t.status==='success'&&t.candidate&&version(t,t.candidate));
 const open=tasks.filter(unresolved),autos=(state.automations||[]).filter(a=>inScope(a,c));
 const running=autos.filter(a=>a.running),abnormal=autos.filter(a=>!a.running&&['failed','partial','cancelled'].includes(a.runs?.[0]?.status));
 const selected=pending.find(t=>t.id===state.taskId)||pending[0];
 const v=selected&&version(selected,selected.candidate),base=selected&&version(selected,selected.confirmed),w=warehouseName(c.warehouse);
 const value=amount(v,w),baseValue=amount(base,w),diff=value!==null&&baseValue!==null?value-baseValue:null;
 return `<section class="card personal-module wb-brief" data-personal-module="brief">${header('今日业务简报','先看重点','隐藏业务简报')}<div class="wb-brief-content"><div class="wb-brief-lead">${icon('sparkles',21)}<div><strong>${pending.length?`${pending.length} 个预测版本等待确认`:tasks.length?'当前没有待确认的预测版本':'当前范围还没有预测任务'}</strong><p>${open.length?`${open.length} 项诊断仍需跟进，可结合业务依据继续核对。`:'当前没有需要跟进的未关闭诊断。'}${running.length?` ${running.length} 项托管正在运行。`:''}</p></div><button class="text-button" data-nav="tasks">查看预测任务 ${icon('arrow',12)}</button></div><div class="wb-brief-facts"><article><span>预测变化</span>${selected&&diff!==null?`<p><strong>${esc(w==='all'?selected.name:w)}：${esc(v.id)}</strong> 较当前采用 ${esc(base.id)} ${diff>0?'增加':diff<0?'减少':'总量不变'}${diff!==0?` <b>${fmt(Math.abs(diff))}</b> 件`:''}。</p>${forecastLink(selected,c,'查看版本差异')}`:`<p>${selected?'当前候选版本暂无可比较的采用版本。':'暂无待确认版本与当前采用版本的差异。'}</p>`}</article><article><span>诊断进展</span><p>${open.length?`当前有 <b>${open.length}</b> 项诊断待核对或等待信息。`:'当前预测没有待核对、等待信息或已暂缓的诊断。'}</p>${open.length?`<button class="text-button" data-nav="forecast" data-task="${esc(open[0].id)}" data-tab="diagnosis">查看预测诊断 ${icon('arrow',12)}</button>`:''}</article><article><span>托管情况</span><p>${abnormal.length?`<b>${abnormal.length}</b> 项任务最近一次运行异常。`:'暂无已结束运行的托管异常。'}${running.length?` ${running.length} 项运行中，完成后更新。`:''}${!autos.length?' 当前尚无托管任务。':autos.filter(a=>!a.runs?.length&&!a.running).length?` ${autos.filter(a=>!a.runs?.length&&!a.running).length} 项尚未运行。`:''}</p><button class="text-button" data-nav="automation">查看托管任务 ${icon('arrow',12)}</button></article></div></div><div class="personal-module-foot">${icon('info',12)}根据当前范围的预测版本、诊断和最近运行记录汇总，随业务状态更新。${selected&&w!=='all'&&!v?.warehouseData?'分仓数采用演示拆分：上海60%逐日取整，杭州取剩余量。':''}</div></section>`;
}
function watchlist(c){
 const entries=Array.isArray(c.watchlist)?c.watchlist:[];
 return `<section class="card personal-module wb-watchlist" data-personal-module="watchlist">${header('我的关注清单','持续关注','隐藏关注清单',`<button class="text-button" data-wb-watch-add>${icon('plus',12)} 添加关注</button>`)}${entries.length?`<div class="wb-watch-list">${entries.map((entry,index)=>{const t=liveTask(entry.taskId),v=currentVersion(t),w=warehouseName(entry.warehouse);const scopeAvailable=t&&(w==='all'||(t.warehouses||[]).includes(w));const label=!t?'关联预测已归档或不可用':!scopeAvailable?'仓库不在当前预测范围':t.status==='running'?'正在计算':t.status==='failed'?'计算未完成':t.status==='draft'?'预测草稿':t.candidate?'待确认草稿':t.confirmed?'当前采用':'尚无采用版本';const n=scopeAvailable?amount(v,w):null;return `<article class="wb-watch-item"><div class="wb-watch-main"><div class="wb-watch-title">${icon('chart',16)}<strong>${esc(t?.name||entry.taskId||'关联预测')}</strong></div><p>${esc(w==='all'?'全部负责仓库':w)}${v?` · ${esc(v.id)}`:''} ${badge(label,t?.candidate?'purple':t?.status==='failed'?'red':!t||!scopeAvailable?'gray':'green')}</p>${scopeAvailable&&v&&n!==null?`<div class="wb-watch-total">${fmt(n)}<small> 件 · 当前预测总量</small></div>`:''}${scopeAvailable?forecastLink(t,c,'查看最新结果',w):'<span class="wb-widget-muted">可移除后重新添加关注对象。</span>'}</div><button class="wb-widget-hide" data-wb-watch-remove="${index}" title="移除关注" aria-label="移除${esc(t?.name||entry.taskId||'预测')}的关注">${icon('x',14)}</button></article>`;}).join('')}</div>`:`<div class="personal-empty">${icon('layers',25)}<div><strong>把经常看的预测放在这里</strong><p>添加一个预测或仓库，即使没有待办，也能持续查看它的最新结果。</p><button class="btn small" data-wb-watch-add>${icon('plus',13)} 添加关注</button></div></div>`}<div class="personal-module-foot">关注对象会保留在清单中；版本、状态与预测量随当前结果更新。</div></section>`;
}
function notes(c){
 const entries=Array.isArray(c.notes)?c.notes:[],remaining=entries.filter(n=>!n.done).length;
 return `<section class="card personal-module wb-notes" data-personal-module="notes">${header('业务备忘',`${remaining} 条待完成`,'隐藏业务备忘',`<button class="text-button" data-wb-note-add>${icon('plus',12)} 添加备忘</button>`)}${entries.length?`<div class="wb-notes-list">${entries.map(n=>{const t=liveTask(n.taskId);return `<article class="wb-note-item${n.done?' is-done':''}"><button class="wb-note-check" data-wb-note-toggle="${esc(n.id)}" aria-label="${n.done?'重新打开':'标记完成'}备忘" aria-pressed="${n.done?'true':'false'}">${n.done?icon('check',13):''}</button><div class="wb-note-main"><p class="wb-note-text">${esc(n.text)}</p><div class="wb-note-meta">${n.done?'<span class="wb-note-done">已完成</span>':''}${t?forecastLink(t,c,`关联：${t.name}`):n.taskId?'<span>关联预测已归档或不可用</span>':'<span>未关联预测</span>'}</div></div><button class="text-button wb-note-edit" data-wb-note-edit="${esc(n.id)}">编辑</button></article>`;}).join('')}</div>`:`<div class="personal-empty">${icon('edit',25)}<div><strong>记下待核实的业务信息</strong><p>可以在右侧说“帮我记一下”，或手动添加备忘并关联预测。</p><button class="btn small" data-wb-note-add>${icon('plus',13)} 添加备忘</button></div></div>`}<div class="personal-module-foot">${icon('info',12)}备忘用于记录判断和待办，不会自动作为活动证据或修改预测。</div></section>`;
}
export function renderWorkbenchWidgets(c={}){
 return {brief:c.showBrief?brief(c):'',watchlist:c.showWatchlist?watchlist(c):'',notes:c.showNotes?notes(c):''};
}
