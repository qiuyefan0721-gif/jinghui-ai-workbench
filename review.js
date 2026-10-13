import {relatedExperiences} from './forecast-experiences.js';
import { automation, state, save, nav, toast, modal, closeModal, confirmDialog, icon, esc, fmt, sum, badge, empty, field, baseline, actual, switchStage, task } from './core.js';

const PERIOD = '2026-10-01 — 2026-10-30';
const SOURCE = 'P001:historical-review:V3:2026-10';
let analysisTimer;
let incomingExperience = null;
const signed = n => `${n > 0 ? '+' : ''}${fmt(n)}`;
const input = (name, value, extra = '') => `<input class="input" name="${name}" value="${esc(value ?? '')}" ${extra}>`;
const textarea = (name, value, rows = 3) => `<textarea class="textarea" name="${name}" rows="${rows}">${esc(value ?? '')}</textarea>`;
const dateLabel = () => state.stage === 'review' ? '2026-11-02 09:00' : '2026-09-30 09:00';

function ui() {
  state.reviewUI ??= { tab: 'history', view: 'list', status: 'idle', warehouse: 'all', granularity: 'day', search: '', statusFilter: 'all', experienceSearch: '', experienceStatus: 'active', days: 30, selectedDay: null, sortError: false };
  state.experiences ??= [];
  state.rules ??= [];
  return state.reviewUI;
}

function data() {
  const u = ui();
  const b = baseline.slice(0, u.days);
  const v = baseline.map((n, i) => i < 7 ? Math.round(n * 1.1) : n).slice(0, u.days);
  const a = actual.slice(0, u.days);
  const split = values => values.map(n => u.warehouse === 'shanghai' ? Math.round(n * .6) : u.warehouse === 'hangzhou' ? n - Math.round(n * .6) : n);
  const bs = split(b), vs = split(v), as = split(a);
  const total = sum(as), bt = sum(bs), vt = sum(vs);
  const percent = n => total ? n / total * 100 : null;
  return { b: bs, v: vs, a: as, total, bt, vt, bp: percent(Math.abs(bt - total)), vp: percent(Math.abs(vt - total)), bw: percent(sum(bs.map((n, i) => Math.abs(n - as[i])))), vw: percent(sum(vs.map((n, i) => Math.abs(n - as[i])))) };
}

const pct = (value, digits = 1) => value === null ? '—' : `${fmt(value, digits)}%`;
const warehouseName = () => ui().warehouse === 'shanghai' ? '上海仓' : ui().warehouse === 'hangzhou' ? '杭州仓' : '上海仓、杭州仓';
const periodHint = () => ui().days < 30 ? `共同日期范围：10月1—${ui().days}日` : '完整预测周期：10月1—30日';

export function renderReview() {
  const u = ui();
  if (state.stage !== 'review') return `<div class="page-head"><div><div class="eyebrow">REVIEW & KNOWLEDGE</div><h1 class="page-title">复盘与经验</h1><p class="subtitle">把每次预测的观察，沉淀为有边界的业务经验。</p></div></div><div class="card">${empty('预测周期尚未结束', '当前演示日期为2026年9月30日，10月预测尚未发生。周期结束并回流销量后，才能核对结果。', '<button class="btn primary" data-review-stage>切换到历史复盘演示</button>')}<div class="card-body"><div class="alert info">切换将保存当前计划进度，加载独立的11月2日历史快照。它不会覆盖你在计划阶段生成或确认的版本。</div></div></div>`;
  if (u.status === 'running') resumeAnalysis();
  if (u.view === 'detail' && u.tab === 'history' && u.status === 'done') return detailPage();
  return `<div class="page-head"><div><div class="eyebrow">REVIEW & KNOWLEDGE</div><h1 class="page-title">复盘与经验</h1><p class="subtitle">核对真实结果，留下下一次工作可参考的经验。</p></div><div class="head-actions">${badge('历史快照 · 只读','blue')}</div></div>
    <div class="alert info" style="margin-bottom:20px">${icon('info')} 2026年11月2日复盘演示。此处是独立历史数据，不是前一阶段操作的真实未来结果。</div>
    <div class="tabs"><button class="tab ${u.tab === 'history' ? 'active' : ''}" data-review-tab="history">预测复盘</button><button class="tab ${u.tab === 'experience' ? 'active' : ''}" data-review-tab="experience">参考经验 <span class="tiny">${state.experiences.filter(e => e.status !== 'archived').length}</span></button></div>
    ${u.tab === 'history' ? historyList() : experienceList()}`;
}

function historyList() {
  const u = ui();
  const labels = { idle:'待复盘', running:'分析中', done:'已复盘', failed:'分析失败' };
  const match = (!u.search || `A商品 华东 上海仓 杭州仓 10月需求预测 ${PERIOD}`.toLowerCase().includes(u.search.toLowerCase())) && (u.statusFilter === 'all' || u.statusFilter === u.status);
  return `<div class="grid-3 section-gap">${[['idle','待复盘'],['running','分析中'],['done','已复盘']].map(([s,l]) => `<button class="card metric" style="text-align:left;cursor:pointer;border-color:${u.statusFilter === s ? '#a899ee' : '#edf0f5'}" data-review-filter="${s}"><div class="metric-label">${l}</div><div class="metric-value">${u.status === s ? 1 : 0}</div><div class="metric-foot">点击筛选对应预测</div></button>`).join('')}</div>
    <div class="card"><div class="toolbar"><div style="flex:1;min-width:220px">${input('review-search',u.search,'placeholder="搜索任务、商品或仓库" aria-label="搜索复盘"')}</div><select class="select" data-review-status><option value="all">全部状态</option>${Object.entries(labels).map(([s,l])=>`<option value="${s}" ${u.statusFilter===s?'selected':''}>${l}</option>`).join('')}</select><button class="btn" data-review-clear>清空筛选</button></div>
    ${match ? `<div class="table-wrap"><table><thead><tr><th>预测任务 / 对象范围</th><th>预测周期</th><th>历史确认版本</th><th style="text-align:right">实际销量</th><th>总量偏差改善</th><th>状态</th><th>操作</th></tr></thead><tbody><tr><td><strong>A商品 · 10月需求预测</strong><div class="tiny muted" style="margin-top:6px">华东 · 上海仓、杭州仓</div></td><td>10/01 — 10/30</td><td>V3 · 13,020件</td><td style="text-align:right">12,880件</td><td>${u.status==='done'?'2.6个百分点':'待分析'}</td><td>${badge(labels[u.status],u.status==='done'?'green':u.status==='failed'?'red':'purple')}</td><td><button class="text-button" data-review-start ${u.status==='running'?'disabled':''}>${u.status==='done'?'查看复盘 →':u.status==='running'?'分析中…':u.status==='failed'?'重试分析':'开始复盘 →'}</button></td></tr></tbody></table></div>` : empty('没有匹配记录','请调整关键词或筛选条件。','<button class="btn" data-review-clear>清空筛选</button>')}
    <div class="card-body tiny muted">筛选后 ${match ? 1 : 0} 项 · 总量偏差不等同于逐日预测误差。数据截至2026-10-31 23:59。</div></div>
    ${u.status==='running'?'<div class="alert info section-gap">正在核对共同日期、计算偏差和整理关联记录。可以离开页面，本地演示分析将继续。</div>':''}`;
}

function detailPage() {
  const u = ui(), d = data();
  const improvement = d.bp === null ? '—' : fmt(d.bp-d.vp,1);
  const saved = state.experiences.find(e=>e.sourceKey===`${SOURCE}:${u.warehouse}` && e.status!=='archived');
  return `<button class="text-button" data-review-back style="margin-bottom:16px">${icon('chevronLeft',16)} 返回预测复盘</button>
  <div class="page-head"><div><div class="eyebrow">FORECAST REVIEW</div><h1 class="page-title">A商品 · 华东区域 · 预测复盘</h1><p class="subtitle">${PERIOD}　${warehouseName()}　历史确认版本 V3</p></div><div class="head-actions"><button class="btn" data-review-integrity>${icon('shield')} ${u.days}/30日已回流</button><button class="btn primary" data-review-experience>${icon('file')} ${saved?'查看参考经验':'整理参考经验'}</button></div></div>
  <div class="alert ${u.days<30?'warning':'info'}" style="margin-bottom:20px">${icon('info')} ${u.days<30?'部分日期已回流。仅评价两版都有预测和实际值的共同日期，不推断全周期表现。':'独立历史演示快照 · 数据截至2026-10-31 23:59 · 销量可能受缺货限制，不等同于潜在需求。'}</div>
  <div class="toolbar" style="padding:0 0 16px"><span class="muted">${periodHint()}</span><div style="margin-left:auto"><select class="select" data-review-warehouse aria-label="查看仓库"><option value="all" ${u.warehouse==='all'?'selected':''}>全部仓库</option><option value="shanghai" ${u.warehouse==='shanghai'?'selected':''}>上海仓</option><option value="hangzhou" ${u.warehouse==='hangzhou'?'selected':''}>杭州仓</option></select></div></div>
  <div class="grid-4">${metric('实际销量',fmt(d.total),'已回流共同日期 · 件')}${metric('AI基线 V0',fmt(d.bt),`净偏差 ${signed(d.bt-d.total)}件`)}${metric('历史确认 V3',fmt(d.vt),`净偏差 ${signed(d.vt-d.total)}件`)}${metric('总量绝对偏差率',`${pct(d.bp)} → ${pct(d.vp)}`,`改善 ${improvement} 个百分点`)}</div>
  <div class="alert success section-gap">${icon('checkCircle')} ${d.vp < d.bp?'本期确认版本总量更接近实际销量。':'本期确认版本总量偏差未优于基线。'}逐日表现请结合下图检查，不能据此认定某个因素造成销量变化。</div>
  <div class="card section-gap"><div class="card-header"><div><h2 class="section-title">预测与实际销量</h2><p class="tiny muted">${warehouseName()} · ${periodHint()}</p></div><div class="segmented">${[['day','日'],['week','周'],['month','月']].map(([g,l])=>`<button class="btn small ${u.granularity===g?'soft':''}" data-review-granularity="${g}">${l}</button>`).join('')}</div></div><div class="card-body">${reviewChart(d)}<div class="row between" style="flex-wrap:wrap;gap:12px"><span class="tiny muted">按日汇总 WMAPE：基线 <strong>${pct(d.bw,2)}</strong>　确认版本 <strong>${pct(d.vw,2)}</strong></span><button class="text-button" data-review-formula>查看计算口径</button></div></div></div>
  <div class="card section-gap" id="review-days"><div class="card-header"><div><h2 class="section-title">逐日核对明细</h2><span class="tiny muted">点击图中日期定位明细；正数表示预测偏高，负数表示预测偏低</span></div><button class="btn small ${u.sortError?'soft':''}" data-review-sort>${icon('filter',15)} ${u.sortError?'恢复日期顺序':'按确认偏差绝对值排序'}</button></div><div class="table-wrap" style="max-height:410px;overflow:auto"><table><thead><tr><th>日期</th><th style="text-align:right">AI基线</th><th style="text-align:right">历史确认</th><th style="text-align:right">实际销量</th><th style="text-align:right">基线净偏差</th><th style="text-align:right">确认净偏差</th></tr></thead><tbody>${d.a.map((n,i)=>({n,i})).sort((a,b)=>u.sortError?Math.abs(d.v[b.i]-b.n)-Math.abs(d.v[a.i]-a.n):a.i-b.i).map(({n,i})=>`<tr data-review-row="${i}" style="${u.selectedDay===i?'background:#f1edff':''}"><td>10/${String(i+1).padStart(2,'0')}${i<7?'<span class="tiny muted"> · 促销周</span>':''}</td><td style="text-align:right">${fmt(d.b[i])}</td><td style="text-align:right">${fmt(d.v[i])}</td><td style="text-align:right">${fmt(n)}</td><td style="text-align:right">${signed(d.b[i]-n)}</td><td style="text-align:right;color:${d.v[i]-n>0?'#b57928':'#538b7c'}">${signed(d.v[i]-n)}</td></tr>`).join('')}</tbody></table></div></div>
  <div class="card section-gap"><div class="card-header"><div><h2 class="section-title">调整记录回看</h2><p class="tiny muted">关联记录不能直接解释因果贡献</p></div>${badge('历史只读','gray')}</div><div class="card-body"><div class="row between"><div><strong>国庆促销假设 +10%</strong><p class="muted">10月1—7日 · 基于V0生成历史V3 · 全部两仓合计增加620件</p></div><button class="btn" data-review-adjustment>查看当时调整 ${icon('arrow',15)}</button></div><div class="divider"></div><div class="row between"><div><strong>把有边界的观察留下来</strong><p class="tiny muted">保存参考经验不代表模型已学习，也不自动改变下一次预测。</p></div><button class="btn soft" data-review-experience>${saved?'已保存 · 查看经验':'整理参考经验'}</button></div></div></div>`;
}

function metric(label, value, foot) {
  return `<div class="card metric"><div class="metric-label">${label}</div><div class="metric-value" style="font-size:${value.length>14?'22':'28'}px">${value}</div><div class="metric-foot">${foot}</div></div>`;
}

function reviewChart(d) {
  const u = ui();
  const chunks = u.granularity === 'day' ? d.a.map((_,i)=>[i,i+1]) : u.granularity === 'week' ? Array.from({length:Math.ceil(d.a.length/7)},(_,i)=>[i*7,Math.min((i+1)*7,d.a.length)]) : [[0,d.a.length]];
  const series = [{name:'实际销量',data:d.a,color:'#334461'},{name:'AI基线 V0',data:d.b,color:'#b1a3ea'},{name:'历史确认 V3',data:d.v,color:'#7154e8'}].map(s=>({...s,values:chunks.map(([start,end])=>sum(s.data.slice(start,end)))}));
  const w=1040,h=280,left=58,right=24,top=26,bottom=42,max=Math.max(...series.flatMap(s=>s.values))*1.15;
  const x=i=>chunks.length===1?(w+left-right)/2:left+i*(w-left-right)/(chunks.length-1);
  const y=n=>h-bottom-(n/max)*(h-top-bottom);
  let svg = `<svg viewBox="0 0 ${w} ${h}" style="width:100%;display:block" role="img" aria-label="实际销量、基线和确认预测对比"><text x="0" y="14" fill="#9296a9" font-size="11">销量（件）</text>`;
  for(let i=0;i<5;i++){const val=max*i/4;svg+=`<line x1="${left}" y1="${y(val)}" x2="${w-right}" y2="${y(val)}" stroke="#edf0f5"/><text x="${left-10}" y="${y(val)+4}" text-anchor="end" fill="#979aaf" font-size="10">${fmt(val)}</text>`;}
  for(const s of series){svg+=`<polyline fill="none" stroke="${s.color}" stroke-width="${s.name==='历史确认 V3'?3:2}" ${s.name==='AI基线 V0'?'stroke-dasharray="5 5"':''} points="${s.values.map((n,i)=>`${x(i)},${y(n)}`).join(' ')}"/>`;if(chunks.length===1)svg+=`<circle cx="${x(0)}" cy="${y(s.values[0])}" r="5" fill="${s.color}"/>`;}
  chunks.forEach(([start,end],i)=>{const label=u.granularity==='day'?`10/${start+1}`:u.granularity==='month'?'10月':`10/${start+1}—${end}`; if(chunks.length<=6||i%5===0||i===chunks.length-1)svg+=`<text x="${x(i)}" y="${h-12}" text-anchor="middle" fill="#979aaf" font-size="11">${label}</text>`;svg+=`<rect x="${x(i)-Math.max(6,(w-left-right)/Math.max(chunks.length,1)/2)}" y="${top}" width="${Math.max(12,(w-left-right)/Math.max(chunks.length,1))}" height="${h-top-bottom}" fill="transparent" style="cursor:pointer" tabindex="0" role="button" data-review-day="${start}" aria-label="查看${label}明细"><title>${label}\n${series.map(s=>`${s.name}：${fmt(s.values[i])}件`).join('\n')}</title></rect>`;});
  svg+='</svg>';
  return `<div class="row" style="justify-content:flex-end;gap:20px;margin-bottom:6px">${series.map(s=>`<span class="tiny" style="color:${s.color}">● ${s.name}</span>`).join('')}</div>${svg}`;
}

function experienceList() {
  const u=ui();
  const rows=state.experiences.filter(e=>(u.experienceStatus==='all'||(u.experienceStatus==='archived'?e.status==='archived':e.status!=='archived'))&&(!u.experienceSearch||`${e.title} ${e.scope} ${e.event}`.includes(u.experienceSearch)));
  return `<div class="card section-gap"><div class="toolbar"><div style="flex:1">${input('experience-search',u.experienceSearch,'placeholder="搜索经验标题、适用范围或事件" aria-label="搜索参考经验"')}</div><select class="select" data-experience-status><option value="active" ${u.experienceStatus==='active'?'selected':''}>可用经验</option><option value="archived" ${u.experienceStatus==='archived'?'selected':''}>已归档</option><option value="all" ${u.experienceStatus==='all'?'selected':''}>全部</option></select></div>${rows.length?`<div class="table-wrap"><table><thead><tr><th>参考经验</th><th>适用范围</th><th>来源周期</th><th>修订</th><th>状态</th><th>操作</th></tr></thead><tbody>${rows.map(e=>`<tr><td><strong>${esc(e.title)}</strong><div class="tiny muted" style="margin-top:6px">${esc(e.event)} · 李明保存</div></td><td>${esc(e.scope)}</td><td>2026年10月</td><td>R${e.revision}</td><td>${badge(e.status==='archived'?'已归档':'可参考',e.status==='archived'?'gray':'green')}</td><td><button class="text-button" data-experience-view="${e.id}">查看经验 →</button></td></tr>`).join('')}</tbody></table></div>`:empty('没有符合条件的参考经验','从历史复盘整理观察，并保存适用条件和限制。','<button class="btn soft" data-review-tab="history">前往预测复盘</button>')}<div class="card-body tiny muted">参考经验保留来源与修订；归档不会删除历史引用或停用关联规则。</div></div>`;
}

function resumeAnalysis() {
  if(analysisTimer)return;
  const current=ui();
  analysisTimer=setTimeout(()=>{analysisTimer=null;if(state.stage!=='review'||ui()!==current)return;current.status=current.failNext||state.demoFailure?'failed':'done';current.failNext=false;state.demoFailure=false;save();toast(current.status==='done'?'复盘分析完成，可查看历史结果':'演示分析失败，已保留销量数据，可重试',current.status==='done'?'success':'error');},1300);
}

export function bindReview(root) {
  root.querySelectorAll('[data-review-stage]').forEach(b=>b.onclick=()=>confirmDialog('切换到历史复盘演示','当前计划进度将保存。接下来载入独立的2026年11月2日历史快照，不覆盖计划阶段版本。',()=>{switchStage('review');state.route='review';save();},'保存进度并切换'));
  root.querySelectorAll('[data-review-tab]').forEach(b=>b.onclick=()=>{ui().tab=b.dataset.reviewTab;ui().view='list';save();});
  root.querySelector('[data-review-start]')?.addEventListener('click',()=>{if(ui().status==='done'){ui().view='detail';save();return;}if(ui().status==='running')return;ui().status='running';save();resumeAnalysis();});
  root.querySelector('[data-review-back]')?.addEventListener('click',()=>{ui().view='list';save();});
  root.querySelectorAll('[data-review-filter]').forEach(b=>b.onclick=()=>{ui().statusFilter=ui().statusFilter===b.dataset.reviewFilter?'all':b.dataset.reviewFilter;save();});
  root.querySelector('[data-review-status]')?.addEventListener('change',e=>{ui().statusFilter=e.target.value;save();});
  root.querySelectorAll('[data-review-clear]').forEach(b=>b.onclick=()=>{ui().search='';ui().statusFilter='all';save();});
  bindSearch(root,'review-search','search');
  bindSearch(root,'experience-search','experienceSearch');
  root.querySelector('[data-experience-status]')?.addEventListener('change',e=>{ui().experienceStatus=e.target.value;save();});
  root.querySelector('[data-review-warehouse]')?.addEventListener('change',e=>{ui().warehouse=e.target.value;ui().selectedDay=null;save();});
  root.querySelectorAll('[data-review-granularity]').forEach(b=>b.onclick=()=>{ui().granularity=b.dataset.reviewGranularity;save();});
  root.querySelectorAll('[data-review-day]').forEach(b=>{const select=()=>{ui().selectedDay=Number(b.dataset.reviewDay);save();setTimeout(()=>document.querySelector(`[data-review-row="${ui().selectedDay}"]`)?.scrollIntoView({behavior:'smooth',block:'center'}),30);};b.onclick=select;b.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();select();}};});
  root.querySelector('[data-review-sort]')?.addEventListener('click',()=>{ui().sortError=!ui().sortError;save();});
  root.querySelector('[data-review-integrity]')?.addEventListener('click',()=>modal('销量数据覆盖情况',`<div class="alert info">${ui().days}/30日已回流 · ${warehouseName()}</div><p>数据截至2026-10-31 23:59。仅计算实际销量已回流、且两版预测均有值的共同日期。缺失值不会补成0。</p><p class="muted">销量可能受缺货等因素限制，不能把观测销量直接等同潜在需求。</p><div class="divider"></div><p class="tiny muted">本地演示数据状态</p><div class="row"><button class="btn" data-demo-partial>演示仅前20日回流</button><button class="btn soft" data-demo-full>恢复30日完整回流</button></div>`,d=>{d.querySelector('[data-demo-partial]').onclick=()=>{ui().days=20;closeModal();save();};d.querySelector('[data-demo-full]').onclick=()=>{ui().days=30;closeModal();save();};}));
  root.querySelector('[data-review-formula]')?.addEventListener('click',()=>modal('两个不同的评价口径','<div class="stack"><div class="card card-body"><strong>总量绝对偏差率</strong><p>|预测总量 − 实际销量总量| ÷ 实际销量总量。</p><p class="muted">正负偏差可在汇总中抵消，仅评价总量是否接近。</p></div><div class="card card-body"><strong>按日汇总 WMAPE</strong><p>Σ |每日预测 − 每日实际销量| ÷ Σ 每日实际销量。</p><p class="muted">各日先取绝对值再汇总。切换周/月展示，不改变按日评价口径。</p></div><p class="tiny muted">数据仅在同一对象、同一共同日期范围比较。实际销量为0时显示无法计算。</p></div>'));
  root.querySelector('[data-review-adjustment]')?.addEventListener('click',()=>modal('历史调整与确认记录',`<div class="alert info">只读历史快照 · ${PERIOD}</div><div class="detail-grid" style="margin-top:20px"><div class="kv"><span class="muted">父版本</span><strong>AI基线 V0 · 12,400件</strong></div><div class="kv"><span class="muted">历史确认</span><strong>V3 · 13,020件</strong></div><div class="kv"><span class="muted">调整范围</span><strong>两仓 · 10月1—7日</strong></div><div class="kv"><span class="muted">数量变化</span><strong>6,200 × 10% = +620件</strong></div></div><div class="divider"></div><p><strong>来源情景：</strong>扩量方案</p><p><strong>当时活动证据原文：</strong>演示快照未提供</p><p><strong>接受风险理由原文：</strong>演示快照未提供</p><div class="alert warning">当时的+10%仍高于历史参考上限9%。不能用事后销量为当时的证据补齐或反推合理性。</div>`));
  root.querySelectorAll('[data-review-experience]').forEach(b=>b.onclick=()=>{const e=state.experiences.find(e=>e.sourceKey===`${SOURCE}:${ui().warehouse}`&&e.status!=='archived');e?viewExperience(e.id):editExperience();});
  root.querySelectorAll('[data-experience-view]').forEach(b=>b.onclick=()=>viewExperience(b.dataset.experienceView));
}

function bindSearch(root,name,key){
  const el=root.querySelector(`[name="${name}"]`);if(!el)return;
  el.addEventListener('input',()=>{const pos=el.selectionStart;ui()[key]=el.value;save();requestAnimationFrame(()=>{const next=document.querySelector(`[name="${name}"]`);if(next){next.focus();next.setSelectionRange(pos,pos);}});});
}

function guardEditor(dialog, dirty, onClose=closeModal) {
  // The shared modal already guards its close icon, Escape and backdrop.
  // Route editor cancellation through the same handler for one consistent prompt.
  dialog.querySelectorAll('[data-editor-cancel]').forEach(b=>b.setAttribute('data-close',''));
}

function seedExperience(){
  const d=data();
  return {title:'促销期调整的参考记录',scope:`华东 · A商品 · ${warehouseName()}`,event:'国庆促销',judgment:'',observation:`${periodHint()}。历史确认版本${fmt(d.vt)}件与基线${fmt(d.bt)}件对比，本期实际销量${fmt(d.total)}件，总量绝对偏差率由${pct(d.bp)}变为${pct(d.vp)}；逐日表现需另看。`,conditions:'用于商品、渠道与活动力度相近的业务核对，先检查数据和活动覆盖。',limits:'单次复盘不能证明促销假设的因果效果，+10%不能直接复用。',evidence:'',sourceKey:`${SOURCE}:${ui().warehouse}`,warehouse:ui().warehouse,days:ui().days};
}

function editExperience(id=null){
  if(state.stage!=='review'){toast('请先进入独立历史复盘演示','error');return;}
  const existing=state.experiences.find(e=>e.id===id), seed=existing?{...existing}:seedExperience();
  const keys=['title','scope','event','judgment','observation','conditions','limits','evidence'];
  modal(existing?'编辑参考经验':'整理参考经验',`<div class="alert info">来源：A商品 · 2026年10月 · 历史V3 · 独立复盘快照。保存不会训练模型、修改预测或启用任务。</div><form data-experience-form style="margin-top:20px"><div class="form-grid">${field('经验标题 *',input('title',seed.title))}${field('适用范围 *',input('scope',seed.scope))}${field('业务事件',input('event',seed.event))}${field('证据来源 / 链接',input('evidence',seed.evidence),'仅记录来源，不自动读取外部内容。')}<div class="full">${field('当时判断',textarea('judgment',seed.judgment,2),'快照未提供证据原文，请按实际信息填写。')}</div><div class="full">${field('本次观察 *',textarea('observation',seed.observation),'编辑后的内容标为人工整理；请保持与数据一致。')}</div><div class="full">${field('适用条件',textarea('conditions',seed.conditions,2))}</div><div class="full">${field('限制与不确定性 *',textarea('limits',seed.limits,2))}</div></div><p class="tiny muted">${periodHint()} · ${warehouseName()} · 来源版本不可修改。</p><div data-form-error class="alert warning" hidden></div><div data-editor-footer><div class="drawer-footer"><button type="button" class="btn" data-editor-cancel>取消</button><button class="btn primary" type="submit">${existing?'保存新修订':'保存参考经验'}</button></div></div></form>`,dialog=>{
    const form=dialog.querySelector('form');const collect=()=>Object.fromEntries(keys.map(k=>[k,form.elements[k].value.trim()]));const initial=JSON.stringify(collect());
    guardEditor(dialog,()=>JSON.stringify(collect())!==initial);
    form.onsubmit=e=>{e.preventDefault();const values=collect(),err=dialog.querySelector('[data-form-error]');const missing=['title','scope','observation','limits'].find(k=>!values[k]);if(missing){err.hidden=false;err.textContent='请补齐标题、适用范围、本次观察和限制。';form.elements[missing].focus();return;}
      const button=form.querySelector('[type="submit"]');button.disabled=true;
      if(state.demoFailure){state.demoFailure=false;save();button.disabled=false;err.hidden=false;err.textContent='演示保存失败，输入已保留。请再次点击保存重试。';return;}
      const target=existing||state.experiences.find(x=>x.sourceKey===seed.sourceKey);
      if(target&&keys.every(k=>(target[k]||'')===values[k])){closeModal();toast('相同来源与内容已保存，打开已有经验');viewExperience(target.id);return;}
      if(target){target.history??=[];target.history.push({...Object.fromEntries(keys.map(k=>[k,target[k]||''])),revision:target.revision,updated:target.updated});Object.assign(target,values,{revision:target.revision+1,updated:dateLabel(),status:'active'});}else state.experiences.push({...seed,...values,id:`E${String(state.experiences.length+1).padStart(3,'0')}`,revision:1,status:'active',history:[],updated:dateLabel(),created:dateLabel(),stage:'review'});
      const saved=target||state.experiences[state.experiences.length-1];save();closeModal();toast(target?'参考经验已保存新修订，关联规则未自动改变':'参考经验已保存，可在相关预测诊断查看');viewExperience(saved.id);
    };
  },{wide:true});
}

export function viewExperience(id){
  const e=state.experiences.find(e=>e.id===id);if(!e)return;
  const relatedTask=[task(),...state.tasks].find(t=>t?.status==='success'&&!t.archived&&relatedExperiences(t).some(item=>item.id===id));
  const refs=state.rules.filter(r=>(r.origins||[]).some(o=>o.id===id)||r.draft?.origin?.id===id);
  modal(e.title,`<div class="row between">${badge(e.status==='archived'?'已归档':'参考经验',e.status==='archived'?'gray':'purple')}<span class="tiny muted">修订R${e.revision} · 李明 · ${esc(e.updated)}</span></div><p class="muted">${esc(e.scope)} · ${esc(e.event)}</p><div class="stack">${[['当时判断',e.judgment||'演示快照未提供'],['本次观察',e.observation],['适用条件',e.conditions||'未填写'],['限制',e.limits],['证据来源',e.evidence||'待补充']].map(([l,v])=>`<div><div class="tiny muted" style="margin-bottom:6px">${l}</div><div style="white-space:pre-wrap;line-height:1.7">${esc(v)}</div></div>`).join('')}</div><div class="divider"></div><div class="row between"><button class="text-button" data-exp-source>查看来源复盘 →</button><button class="text-button" data-exp-history>修订历史（${e.history?.length||0}）</button></div>${refs.length?`<div class="alert info" style="margin-top:16px">已关联规则：${refs.map(r=>esc(r.name)).join('、')}。经验更新不会自动改变规则。</div>`:''}<div class="drawer-footer">${relatedTask?'<button class="btn soft" data-exp-diagnosis>查看预测诊断</button>':''}<button class="btn" data-exp-archive>${e.status==='archived'?'恢复可用':'归档'}</button><button class="btn" data-exp-edit>编辑经验</button><button class="btn primary" data-exp-rule ${e.status==='archived'?'disabled title="恢复经验后可创建新规则"':''}>创建检查规则</button></div>`,dialog=>{
    dialog.querySelector('[data-exp-diagnosis]')?.addEventListener('click',()=>{closeModal();nav('forecast',{taskId:relatedTask.id,tab:'diagnosis'});});
    dialog.querySelector('[data-exp-source]').onclick=()=>{closeModal();ui().tab='history';ui().view='detail';ui().status='done';ui().warehouse=e.warehouse||'all';ui().days=e.days||30;nav('review');};
    dialog.querySelector('[data-exp-edit]').onclick=()=>editExperience(id);
    dialog.querySelector('[data-exp-rule]').onclick=()=>{incomingExperience={id:e.id,revision:e.revision,title:e.title};openRule();};
    dialog.querySelector('[data-exp-archive]').onclick=()=>confirmDialog(e.status==='archived'?'恢复参考经验':'归档参考经验',e.status==='archived'?'恢复后可供未来匹配场景参考。':'归档后不再主动推荐。已有引用和关联规则继续保留，不会暂停规则。',()=>{e.status=e.status==='archived'?'active':'archived';save();closeModal();toast(e.status==='archived'?'经验已归档，关联规则保持原状态':'经验已恢复');},e.status==='archived'?'恢复':'归档');
    dialog.querySelector('[data-exp-history]').onclick=()=>modal('参考经验修订历史',`<div class="stack">${[{...e},...(e.history||[]).slice().reverse()].map(h=>`<div class="card card-body"><div class="row between"><strong>R${h.revision}${h.revision===e.revision?' · 当前修订':''}</strong><span class="tiny muted">${esc(h.updated)}</span></div><p>${esc(h.observation)}</p><p class="tiny muted">限制：${esc(h.limits)}</p></div>`).join('')}</div><div class="drawer-footer"><button class="btn" data-history-back>返回经验</button></div>`,d=>d.querySelector('[data-history-back]').onclick=()=>viewExperience(id),{wide:true});
  },{wide:true});
}

function ruleValues(r){return {name:r?.name||'促销假设超过参考范围时提醒核对',threshold:r?.threshold??9,scope:r?.scope||'商家A · 华东 · A商品 · 上海仓、杭州仓',evidenceMissing:r?.evidenceMissing??true,automationId:r?.automationId===null?null:(r?.automationId||state.automations[0]?.id||null),origin:r?.origin||null};}
function sameRule(a,b){return Number(a.threshold)===Number(b.threshold)&&a.scope===b.scope&&a.evidenceMissing===b.evidenceMissing&&a.automationId===b.automationId;}

export function openRule(ruleId=null){
  ui();
  const origin=incomingExperience;incomingExperience=null;
  const r=state.rules.find(x=>x.id===ruleId);
  if(ruleId&&!r){toast('规则不存在或已被移除','error');return;}
  if(!r&&origin){const existing=state.rules.find(x=>sameRule(ruleValues(x),ruleValues(null)));if(existing){modal('发现可复用的检查规则',`<div class="alert info">已有同义规则，无需重复创建提醒。</div><h3>${esc(existing.name)}</h3><p class="muted">阈值 ${existing.threshold}% · ${esc(ruleValues(existing).scope)} · 当前R${existing.revision}</p><p>来源经验：${esc(origin.title)} R${origin.revision}</p><div class="drawer-footer"><button class="btn" data-reuse-cancel>返回经验</button><button class="btn" data-reuse-link>关联现有规则</button><button class="btn primary" data-reuse-revision>创建修订草稿</button></div>`,dialog=>{dialog.querySelector('[data-reuse-cancel]').onclick=()=>viewExperience(origin.id);dialog.querySelector('[data-reuse-link]').onclick=()=>{existing.origins??=[];if(!existing.origins.some(x=>x.id===origin.id&&x.revision===origin.revision))existing.origins.push(origin);save();toast('已关联现有规则，没有新增重复检查');openRule(existing.id);};dialog.querySelector('[data-reuse-revision]').onclick=()=>{existing.draft={...ruleValues(existing.draft||existing),origin,revision:existing.status==='draft'?existing.revision:existing.revision+1};save();toast('已创建修订草稿，当前生效规则保持不变');openRule(existing.id);};});return;}}
  const seed={...ruleValues(r?.draft||r),origin:r?.draft?.origin||origin||null};
  const active=r&&r.status!=='draft';
  const nextRevision=r?(r.status==='draft'?r.revision:r.revision+1):1;
  const statusText=r?.status==='enabled'?'已启用':r?.status==='paused'?'已暂停':'未启用';
  modal(r?'业务规则详情':'创建检查规则',`<div class="row between">${badge(statusText,r?.status==='enabled'?'green':r?.status==='paused'?'amber':'gray')}<span class="tiny muted">${active?`当前生效修订 R${r.revision}`:'检查规则草稿'}${r?.draft?` · 待启用 R${nextRevision}`:''}</span></div><div class="alert info" style="margin-top:16px">只检查并生成诊断提醒，不修改预测、不确认业务版本、不下单。编辑后先保存草稿，再单独启用。</div>
  ${seed.origin?`<p class="tiny muted">来源经验：${esc(seed.origin.title)} R${seed.origin.revision}</p>`:''}
  <form data-rule-form style="margin-top:20px"><div class="form-grid"><div class="full">${field('规则名称 *',input('name',seed.name))}</div><div class="full">${field('适用范围 *',input('scope',seed.scope))}</div>${field('促销周增幅上限（%） *',input('threshold',seed.threshold,'type="number" min="0" max="100" step="0.1"'),'历史参考为7%—9%，不是最佳比例。')}${field('运行载体',`<select class="select" name="automationId">${state.automations.map(a=>`<option value="${esc(a.id)}" ${seed.automationId===a.id?'selected':''}>${esc(a.name)}</option>`).join('')}<option value="" ${!seed.automationId?'selected':''}>暂不关联</option></select>`,'启用时关联所选任务；其他任务也可在配置中选用此规则。')}<label class="check-row full"><input type="checkbox" name="evidenceMissing" ${seed.evidenceMissing?'checked':''}> 活动证据未补齐时也提醒核对</label><div class="full"><div class="card card-body"><div class="tiny muted">满足任一条件后</div><p>生成诊断提醒，附草稿版本、参数、历史参考与待核对信息。</p><div class="tiny muted">负责人李明 · 本人站内提醒 · 不对外发送</div></div></div></div><div data-rule-test-result></div><div data-form-error class="alert warning" hidden></div><div data-editor-footer><div class="drawer-footer"><button type="button" class="btn" data-editor-cancel>关闭</button>${r?.status==='enabled'?'<button type="button" class="btn" data-rule-pause>暂停规则</button>':''}${r?.status==='paused'?'<button type="button" class="btn" data-rule-resume>恢复当前修订</button>':''}<button type="button" class="btn" data-rule-test>试运行检查</button><button type="submit" class="btn ${r?.draft?'':'primary'}">保存规则草稿</button>${r?.draft||r?.status==='draft'?'<button type="button" class="btn primary" data-rule-enable>启用已保存草稿</button>':''}</div></div></form>${r?.history?.length?`<details style="margin-top:16px"><summary class="text-button">查看 ${r.history.length} 条历史操作记录</summary><div class="timeline" style="margin-top:12px">${r.history.slice().reverse().map(h=>`<div class="timeline-item"><strong>${esc(h.action)}</strong><div class="tiny muted">${esc(h.time)} · R${h.revision} · 阈值${h.threshold}%</div></div>`).join('')}</div></details>`:''}`,dialog=>{
    const form=dialog.querySelector('form'),err=dialog.querySelector('[data-form-error]');
    const collect=()=>({name:form.elements.name.value.trim(),scope:form.elements.scope.value.trim(),threshold:Number(form.elements.threshold.value),evidenceMissing:form.elements.evidenceMissing.checked,automationId:form.elements.automationId.value||null,origin:seed.origin});
    const initial=JSON.stringify(collect());const dirty=()=>JSON.stringify(collect())!==initial;
    guardEditor(dialog,dirty);
    const validate=()=>{const value=collect();if(!value.name||!value.scope||form.elements.threshold.value===''||!Number.isFinite(value.threshold)||value.threshold<0||value.threshold>100){err.hidden=false;err.textContent='请填写名称、适用范围和0—100之间的百分比阈值。';return null;}err.hidden=true;return value;};
    form.onsubmit=e=>{e.preventDefault();const values=validate();if(!values)return;
      if(state.demoFailure){state.demoFailure=false;save();err.hidden=false;err.textContent='演示保存失败，表单内容已保留，请重试。';return;}
      const duplicate=state.rules.find(x=>x.id!==r?.id&&sameRule(ruleValues(x.draft||x),values));
      if(duplicate){err.hidden=false;err.innerHTML=`已存在相同条件规则：${esc(duplicate.name)}。<button type="button" class="text-button" data-open-duplicate>查看并复用现有规则 →</button>`;err.querySelector('button').onclick=()=>{if(values.origin){duplicate.origins??=[];if(!duplicate.origins.some(o=>o.id===values.origin.id&&o.revision===values.origin.revision))duplicate.origins.push(values.origin);save();}openRule(duplicate.id);};return;}
      if(r){r.draft={...values,revision:nextRevision};}else{const id=`R${String(Math.max(0,...state.rules.map(x=>Number(x.id.replace(/\D/g,''))||0))+1).padStart(3,'0')}`;state.rules.push({id,...values,revision:1,status:'draft',draft:{...values,revision:1},history:[],origins:[]});ruleId=id;}
      save();toast('规则草稿已保存，尚未改变生效规则');openRule(r?.id||ruleId);
    };
    dialog.querySelector('[data-rule-test]').onclick=()=>{const values=validate();if(!values)return;const target=dialog.querySelector('[data-rule-test-result]');const t=task();let rate,versionName,evidence;
      if(state.stage==='review'){rate=10;versionName='历史V3（独立复盘快照）';evidence=false;}else {const v=t?.versions?.find(v=>v.id===(t.candidate||t.viewed));if(!v){target.innerHTML='<div class="alert warning" style="margin-top:16px">暂无可试运行的已计算预测。先创建预测或进入已有结果。</div>';return;}rate=v.rate??0;versionName=`${t.name} · ${v.id}`;evidence=!!t.diagnosis?.evidence&&!!t.diagnosis?.source;}
      const hit=rate>values.threshold||(values.evidenceMissing&&!evidence);target.innerHTML=`<div class="alert ${hit?'warning':'success'}" style="margin-top:16px"><strong>${hit?'命中检查条件':'未命中当前检查条件'}</strong><p>${esc(versionName)} · 促销增幅${rate}% ${rate>values.threshold?'>':'≤'} 上限${values.threshold}%</p><p class="tiny">${values.evidenceMissing&&!evidence?'活动证据未齐全，仍需核对。':''}试运行只展示匹配结果，不创建待办、不改预测、不启用规则。${dirty()?'当前测试的是尚未保存的表单条件。':''}</p></div>`;
    };
    dialog.querySelector('[data-rule-enable]')?.addEventListener('click',()=>{if(dirty()){err.hidden=false;err.textContent='表单有未保存修改，请先保存草稿，再启用。';return;}enableRule(r.id);});
    dialog.querySelector('[data-rule-pause]')?.addEventListener('click',()=>{if(dirty()){err.hidden=false;err.textContent='请先保存草稿或关闭并放弃编辑，再暂停当前规则。';return;}confirmDialog('暂停业务规则','停止未来检查，既有提醒与历史记录保留。当前已启动运行仍使用其启动时的规则快照。',()=>{r.history??=[];r.history.push({action:'暂停规则',revision:r.revision,threshold:r.threshold,time:dateLabel()});r.status='paused';save();toast('规则已暂停，已有提醒未删除');openRule(r.id);},'暂停规则');});
    dialog.querySelector('[data-rule-resume]')?.addEventListener('click',()=>{if(dirty()){err.hidden=false;err.textContent='请先处理未保存修改。';return;}confirmDialog('恢复当前生效修订',`恢复R${r.revision}，不会自动启用待修改草稿。${state.automations.some(a=>a.enabled&&a.ruleIds.includes(r.id))?'已关联任务从下一次运行起检查。':'可在托管任务中关联此规则并启用任务。'}`,()=>{r.status='enabled';r.history??=[];r.history.push({action:'恢复规则',revision:r.revision,threshold:r.threshold,time:dateLabel()});save();toast('当前规则修订已恢复');openRule(r.id);},'恢复规则');});
  },{wide:true});
}

function enableRule(id){
  const r=state.rules.find(x=>x.id===id);if(!r)return;
  const storedDraft=r.draft||(r.status==='draft'?r:null);if(!storedDraft){toast('没有待启用草稿','error');return;}
  const draft=ruleValues(storedDraft);
  if(!automation(draft.automationId)){toast('请先关联持续任务并保存草稿，规则才能启用','error');return;}
  const next=r.status==='draft'?r.revision:r.revision+1;
  confirmDialog(`启用规则 R${next}`,`${esc(draft.name)}；增幅超过${draft.threshold}%${draft.evidenceMissing?'或活动证据未齐全时':''}生成本人诊断提醒。${automation(draft.automationId)?.enabled?'关联任务从下一次运行起生效，历史记录保留。':'关联任务当前已暂停，需单独启用任务。'}`,()=>{
    if(state.demoFailure){state.demoFailure=false;save();toast('演示启用失败，草稿和原生效修订已保留，可重试','error');openRule(id);return;}
    if(r.draft!==storedDraft&&r.status!=='draft'){toast('规则草稿已变化，请重新检查','error');openRule(id);return;}
    r.history??=[];r.history.push({action:'启用规则',revision:next,threshold:draft.threshold,time:dateLabel(),snapshot:{...draft}});
    Object.assign(r,draft,{revision:next,status:'enabled',draft:null});const carrier=automation(draft.automationId);if(carrier&&!carrier.ruleIds.includes(r.id))carrier.ruleIds.push(r.id);r.origins??=[];if(draft.origin&&!r.origins.some(x=>x.id===draft.origin.id&&x.revision===draft.origin.revision))r.origins.push(draft.origin);
    state.opsUI??={homeTab:'open',taskTab:'pending',automationTab:'tasks',filters:{pending:{},all:{}}};state.opsUI.automationTab='rules';save();closeModal();toast(automation(draft.automationId)?.enabled?'规则已启用，将在关联任务下次运行使用':'规则已启用，等待关联任务启用');nav('automation');
  },'确认启用规则');
}

export function openExperienceLibrary(){const u=ui();u.tab='experience';u.view='list';u.experienceSearch='';u.experienceStatus='active';nav('review');}
