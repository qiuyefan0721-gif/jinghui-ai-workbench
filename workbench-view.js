import {renderWorkbenchCharts} from './workbench-charts.js';
import {renderWorkbenchWidgets} from './workbench-widgets.js';
import {state,task,version,chart,icon,esc,fmt,sum,badge} from './core.js';

const DEFAULTS={layout:'tasks',split:true,warehouse:'all',grain:'week',compact:true,exceptionsOnly:true,showTrend:true,showTasks:true,showAutomation:true};
const unresolved=t=>!!(t.diagnosis&&[t.candidate,t.confirmed].includes(t.diagnosis.version)&&['open','waiting','snoozed'].includes(t.diagnosis.status));
const pending=t=>t.status==='failed'||!!t.candidate||unresolved(t);
const inWarehouse=(t,c)=>c.warehouse==='all'||(t.warehouses||[]).includes(c.warehouse);
const currentVersion=t=>version(t,t.candidate)||version(t,t.confirmed)||version(t,t.viewed)||t.versions?.[0];
const adoption=(t,v)=>v?.id===t.candidate?'待确认草稿':v?.id===t.confirmed?(v.autoAdopted?'系统自动采用':'当前采用'):'当前查看版本';
const runName=s=>({success:'检查完成',failed:'运行失败',partial:'部分完成',running:'运行中',cancelled:'已中断'})[s]||'尚未运行';
const schedule=a=>a.frequency==='manual'?'仅手动运行':`${a.frequency==='weekly'?'每周一':'每日'} ${a.time||'08:30'}`;
function taskStatus(t){
 if(t.status==='running')return ['正在计算','purple'];
 if(t.status==='failed')return ['计算未完成','red'];
 if(t.status==='cancelled')return ['已取消','gray'];
 if(t.status==='draft')return ['预测草稿','gray'];
 if(unresolved(t))return [['waiting','snoozed'].includes(t.diagnosis.status)?'等待信息':'诊断待核对','amber'];
 return t.candidate?['版本待确认','purple']:['当前采用','green'];
}
function taskAction(t){
 if(unresolved(t))return `<button class="btn small soft" data-nav="forecast" data-task="${esc(t.id)}" data-tab="diagnosis">查看预测诊断 ${icon('arrow',13)}</button>`;
 if(t.candidate)return `<button class="btn small soft" data-nav="forecast" data-task="${esc(t.id)}" data-tab="result" data-pending-version="${esc(t.candidate)}">检查待确认结果 ${icon('arrow',13)}</button>`;
 return `<button class="btn small" data-nav="forecast" data-task="${esc(t.id)}" data-tab="result">${t.status==='success'?'查看预测':'查看任务'} ${icon('arrow',13)}</button>`;
}
function tasksSection(c,tasks){
 const shown=tasks.filter(pending);
 return `<section class="card personal-module personal-tasks" data-personal-module="tasks"><div class="personal-module-head"><div><span class="personal-kicker">待办优先</span><h2>需要我处理 ${badge(shown.length,'purple')}</h2></div><button class="text-button" data-nav="tasks">全部预测 ${icon('arrow',13)}</button></div>${shown.length?`<div class="personal-task-list">${shown.slice(0,6).map(t=>{const v=currentVersion(t),status=taskStatus(t);return `<article class="personal-task-row"><span class="personal-task-icon">${icon(t.status==='failed'?'alert':unresolved(t)?'shield':'chart',18)}</span><div class="personal-task-copy"><div class="personal-task-title"><h3>${esc(t.name)}</h3>${badge(...status)}</div><p>${esc((t.warehouses||[]).join('、'))} · ${esc(t.period||'周期待配置')}${v?` · ${esc(v.id)} ${adoption(t,v)}`:''}</p>${unresolved(t)?`<p class="personal-task-hint">${['waiting','snoozed'].includes(t.diagnosis.status)?'正在等待补充信息，问题尚未关闭。':t.diagnosis.kind==='baseline'?'初始预测有待核对事项，请检查对应诊断。':'请核对当前版本的活动依据与促销假设。'}</p>`:t.status==='failed'?`<p class="personal-task-hint">${esc(t.error||'本次计算未完成，请打开任务查看原因。')}</p>`:t.candidate?'<p class="personal-task-hint">新结果已生成，确认采用后才改变当前业务参考。</p>':''}</div><div class="personal-task-action">${taskAction(t)}${unresolved(t)&&t.candidate?`<button class="text-button" data-nav="forecast" data-task="${esc(t.id)}" data-tab="result" data-pending-version="${esc(t.candidate)}">查看 ${esc(t.candidate)} 结果</button>`:''}</div></article>`;}).join('')}</div>${shown.length>6?`<div class="personal-module-foot"><span>另有 ${shown.length-6} 项，可到预测任务查看</span></div>`:''}`:`<div class="personal-empty">${icon('checkCircle',26)}<div><strong>${tasks.length?'当前范围暂无待处理事项':'当前范围暂无预测任务'}</strong><p>${tasks.length?'当前筛选下没有待确认版本、未处理诊断或计算失败任务。':'创建预测后，可以在这里跟进结果和诊断。'}</p><button class="btn small" data-nav="new">${icon('plus',13)}新建预测</button></div></div>`}</section>`;
}
function automationsSection(c){
 const list=(state.automations||[]).filter(a=>inWarehouse(a,c)),enabled=list.filter(a=>a.enabled).length,running=list.filter(a=>a.running).length;
 const shown=c.exceptionsOnly?list.filter(a=>['failed','partial','cancelled'].includes(a.runs?.[0]?.status)):list;
 return `<section class="card personal-module personal-automations" data-personal-module="automation"><div class="personal-module-head"><div><span class="personal-kicker">持续关注</span><h2>我的托管 ${badge(list.length,'purple')}</h2></div><button class="text-button" data-nav="automation">管理任务 ${icon('arrow',13)}</button></div><div class="personal-auto-stats"><div><strong>${enabled}</strong><span>已启用</span></div><div><strong>${running}</strong><span>正在运行</span></div><div><strong>${list.filter(a=>a.runs?.[0]?.status==='failed').length}</strong><span>最近运行失败</span></div></div>${shown.length?`<div class="personal-auto-list">${shown.map(a=>{const last=a.runs?.[0];return `<article class="personal-auto-row"><span class="personal-auto-icon">${icon('sparkles',18)}</span><div><h3>${esc(a.name)}</h3><p>${esc(schedule(a))} · ${esc(a.warehouses.join('、'))}</p><p>${a.running?'正在读取预测并检查规则':last?`${runName(last.status)} · ${esc(last.time||'')}`:'尚无运行记录'}${last?.status==='failed'?` · ${esc(last.summary||'请查看运行记录')}`:''}</p></div><div class="personal-auto-action">${badge(a.running?'运行中':a.enabled?'已启用':'已暂停',a.running?'purple':a.enabled?'green':'gray')}<button class="text-button" data-personal-automation="${esc(a.id)}">查看配置 ${icon('chevron',12)}</button></div></article>`;}).join('')}</div>`:`<div class="personal-empty">${icon('clock',26)}<div><strong>${list.length?'暂无需要展开的异常任务':'当前范围暂无托管任务'}</strong><p>${list.length?(running?`当前有 ${running} 项任务正在运行；结果以完成后的运行记录为准。`:`已筛选最近运行失败、部分完成或中断的任务；${list.filter(a=>!a.runs?.length).length} 项尚无运行记录。`):'按不同仓库与执行频率配置独立的检查任务。'}</p><button class="btn small" data-nav="automation">${list.length?'查看全部托管任务':'配置持续任务'}</button></div></div>`}<div class="personal-module-foot">${icon('shield',13)} 本地演示 · 托管生成诊断与提醒，业务版本由你决定</div></section>`;
}
function dailyData(t,v,warehouse){
 if(warehouse==='all')return v.data.map(Number);
 return v.data.map((n,i)=>Number(v.warehouseData?.[i]?.[warehouse==='上海仓'?'sh':'hz']??(warehouse==='上海仓'?Math.round(Number(n)*.6):Number(n)-Math.round(Number(n)*.6))));
}
const aggregate=(data,grain)=>grain==='week'?Array.from({length:Math.ceil(data.length/7)},(_,i)=>sum(data.slice(i*7,i*7+7))):data;
function dateLabel(t,index,end){
 const start=t.form?.start||String(t.period||'').match(/\d{4}-\d{2}-\d{2}/)?.[0]||'2026-10-01';
 const format=i=>{const date=new Date(start+'T00:00:00Z');date.setUTCDate(date.getUTCDate()+i);return `${date.getUTCMonth()+1}/${date.getUTCDate()}`;};
 return end===undefined?format(index):`${format(index)}—${format(end)}`;
}
function forecastChart(t,series,c){
 // The shared chart supports weekly axis labels but daily tooltips; provide exact
 // period labels for both axes and tooltips after aggregating each series.
 const count=Math.max(...series.map(s=>s.data.length)),sourceDays=currentVersion(t).data.length;
 let tooltip=0;
 let html=chart(series,{height:c.compact?175:225,compact:true,grain:c.grain});
 html=html.replace(/<title>[^<]*<\/title>/g,()=>{const si=Math.floor(tooltip/count),i=tooltip++%count,label=c.grain==='week'?dateLabel(t,i*7,Math.min(sourceDays-1,i*7+6)):dateLabel(t,i);return `<title>${esc(label)} · ${esc(series[si]?.name||'预测')}：${fmt(series[si]?.data[i])}件</title>`;});
 let axis=0;const indices=count===30?[0,4,9,14,19,24,29]:Array.from({length:count},(_,i)=>i);
 html=html.replace(/(<text\b[^>]*>)10\/[\s\S]*?(<\/text>)/g,(_,open,close)=>{const i=indices[axis++]??0;return open+esc(c.grain==='week'?dateLabel(t,i*7,Math.min(sourceDays-1,i*7+6)):dateLabel(t,i))+close;});
 html=html.replace(/<rect\b[^>]*fill="#f1ecff"[^>]*\/>/g,'');
 return html.replaceAll('area-fill','personal-area-'+String(t.id).replace(/[^a-zA-Z0-9]/g,'')+'-'+(series[0]?.name==='上海仓'?'sh':series[0]?.name==='杭州仓'?'hz':'all'));
}
function trendsSection(c,tasks){
 const available=tasks.filter(t=>t.status==='success'&&currentVersion(t)?.data?.length),selected=available.find(t=>t.id===state.taskId)||available[0];
 if(!selected)return `<section class="card personal-module personal-trends" data-personal-module="trend"><div class="personal-module-head"><div><span class="personal-kicker">需求分析</span><h2>预测趋势</h2></div></div><div class="personal-empty">${icon('chart',26)}<div><strong>暂无可展示的预测结果</strong><p>当前范围的预测计算完成后，将展示每日需求或按周汇总的趋势。</p><button class="btn small" data-nav="new">新建预测</button></div></div></section>`;
 const t=selected,v=currentVersion(t),warehouses=c.warehouse==='all'?(t.warehouses||[]):[c.warehouse],panels=c.split&&warehouses.length>1?warehouses:['all'];
 if(c.warehouse!=='all')panels[0]=c.warehouse;
 return `<section class="card personal-module personal-trends" data-personal-module="trend"><div class="personal-module-head"><div><span class="personal-kicker">${c.split?'分仓需求视图':'需求总览'}</span><h2>${esc(t.name)}</h2><p>${esc(v.id)} · ${adoption(t,v)} · ${esc(t.period||'')} · ${c.grain==='week'?'按周合计':'每日需求'}</p></div><button class="text-button" data-personal-forecast="${esc(t.id)}" data-warehouse="${esc(c.warehouse)}" data-grain="${c.grain}">进入预测 ${icon('arrow',13)}</button></div><div class="personal-trend-grid ${panels.length>1?'is-split':''}">${panels.map(w=>{const data=dailyData(t,v,w),base=version(t,'V0'),series=[{name:w==='all'?'当前范围总需求':w,color:'#8b6cde',data:aggregate(data,c.grain)}];return `<div class="personal-trend-panel"><div class="personal-trend-summary"><div><span>${esc(w==='all'?warehouses.join('、'):w)}</span><strong>${fmt(sum(data))}<small> 件</small></strong></div><div><span>较系统初始预测</span><b>${base?`${sum(data)-sum(dailyData(t,base,w))>=0?'+':''}${fmt(sum(data)-sum(dailyData(t,base,w)))}`:'—'}<small> 件</small></b></div></div>${forecastChart(t,series,c)}<button class="text-button personal-chart-link" data-personal-forecast="${esc(t.id)}" data-warehouse="${esc(w)}" data-grain="${c.grain}">查看${esc(w==='all'?'预测':w)}明细 ${icon('arrow',12)}</button></div>`;}).join('')}</div><div class="personal-module-foot">${icon('info',13)} ${v.warehouseData?'分仓数据采用当前版本保存的明细。':'演示分仓：上海仓逐日取60%并四舍五入，杭州仓取剩余量。'}${c.grain==='week'?'每7天合计，末周按剩余天数计算。':'汇总与逐日数据保持一致。'}${available.length>1?`当前展示 ${esc(t.id)}，其余 ${available.length-1} 个预测可从任务列表查看。`:''}</div></section>`;
}

export function renderPersonalWorkbench(config={}){
 const c={...DEFAULTS,...config};if(!['tasks','analysis','automation'].includes(c.layout))c.layout='tasks';if(!['all','上海仓','杭州仓'].includes(c.warehouse))c.warehouse='all';if(!['day','week'].includes(c.grain))c.grain='week';
 const tasks=(state.tasks||[]).filter(t=>!t.archived&&inWarehouse(t,c)),modules={...renderWorkbenchCharts(c),...renderWorkbenchWidgets(c),tasks:c.showTasks?tasksSection(c,tasks):'',trend:c.showTrend?trendsSection(c,tasks):'',automation:c.showAutomation?automationsSection(c):''};
 const order=c.layout==='analysis'?['trend','tasks','automation']:c.layout==='automation'?['automation','tasks','trend']:['tasks','automation','trend'];
 const composed=c.layout==='analysis'?['brief','weekly','warehouseBars','adjustments',...order,'watchlist','notes']:c.layout==='automation'?['brief',...order,'weekly','warehouseBars','adjustments','watchlist','notes']:['brief',...order,'weekly','warehouseBars','adjustments','watchlist','notes'];
 const visible=composed.filter(key=>modules[key]);
 const title={tasks:'先处理重要事项',analysis:'从需求变化开始',automation:'查看持续任务的执行情况'}[c.layout];
 const header=`<div class="page-head"><div><div class="eyebrow">MY PERSONAL WORKBENCH</div><h1 class="page-title">李明的工作台</h1><p class="subtitle">${title} · ${esc(c.warehouse==='all'?'全部负责仓库':c.warehouse)} · ${c.grain==='week'?'周趋势':'日趋势'}</p></div><div class="head-actions"><button class="btn" data-customize-workbench>${icon('settings',15)}定制工作台</button><button class="btn primary" data-nav="new">${icon('plus',15)}新建预测</button></div></div>`;
 return `<div class="personal-workbench personal-layout-${c.layout}${c.compact?' is-compact':''}" data-personal-layout="${c.layout}">${header}<div class="personal-overview"><span>${icon('grid',14)} ${state.workbenchPersonalization?.draft?'新布局预览':'已保存的个性化视图'}</span><span>${tasks.length} 项预测</span><span>${tasks.filter(pending).length} 项待处理</span><span>数据范围：当前演示阶段</span></div>${visible.length?`<div class="personal-modules personal-module-count-${visible.length}">${visible.map(key=>modules[key]).join('')}</div>`:`<section class="card personal-module"><div class="personal-empty">${icon('grid',26)}<div><strong>选择你想关注的工作内容</strong><p>当前没有开启展示模块，可以添加预测趋势、待办或托管任务。</p><button class="btn" data-customize-workbench>添加工作台模块</button></div></div></section>`}</div>`;
}
