import {state,version,esc,fmt,sum,icon,badge} from './core.js';

const NAMES={weekly:'每周需求柱状图',warehouseBars:'分仓需求柱状图',adjustments:'预测调整差异图'};
const COLORS=['#9170da','#48ad9c'];
const current=t=>version(t,t.candidate)||version(t,t.confirmed)||version(t,t.viewed)||t.versions?.[0];
const valid=v=>Array.isArray(v?.data)&&v.data.length>0&&v.data.every(n=>Number.isFinite(Number(n)));
function sourceTask(c){
 const tasks=(state.tasks||[]).filter(t=>!t.archived&&t.status==='success'&&valid(current(t))&&(c.warehouse==='all'||t.warehouses?.includes(c.warehouse)));
 return tasks.find(t=>t.id===state.taskId)||tasks[0]||null;
}
function daily(t,v,warehouse){
 return v.data.map((n,i)=>warehouse==='all'?Number(n):Number(v.warehouseData?.[i]?.[warehouse==='上海仓'?'sh':'hz']??(warehouse==='上海仓'?Math.round(Number(n)*.6):Number(n)-Math.round(Number(n)*.6))));
}
function dates(t,length,weekly){
 const start=t.form?.start||String(t.period||'').match(/\d{4}-\d{2}-\d{2}/)?.[0]||'2026-10-01';
 const label=i=>{const d=new Date(start+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+i);return `${d.getUTCMonth()+1}/${d.getUTCDate()}`;};
 return Array.from({length:weekly?Math.ceil(length/7):length},(_,i)=>{const from=weekly?i*7+1:i+1,to=weekly?Math.min(length,from+6):from;return {from,to,label:from===to?label(from-1):`${label(from-1)}—${label(to-1)}`};});
}
const aggregate=(data,groups)=>groups.map(g=>sum(data.slice(g.from-1,g.to)));
const viewState=(t,v)=>v.id===t.candidate?'待确认草稿':v.id===t.confirmed?(v.autoAdopted?'系统自动采用':'当前采用'):'当前查看';
const attrs=(t,warehouse,group,compare=false)=>`data-wb-chart-task="${esc(t.id)}" data-warehouse="${esc(warehouse)}" data-from="${group.from}" data-to="${group.to}"${compare?' data-compare="true"':''}`;
function hideButton(key){return `<button class="text-button wb-bars-hide" data-workbench-command="隐藏${NAMES[key]}" aria-label="隐藏${NAMES[key]}">${icon('x',13)} 隐藏</button>`;}
function emptyModule(key,title,text){return `<section class="card personal-module wb-bars-module" data-personal-module="${key}"><div class="personal-module-head"><div><span class="personal-kicker">${key==='adjustments'?'调整核对':'需求分析'}</span><h2>${NAMES[key]}</h2></div>${hideButton(key)}</div><div class="wb-bars-empty">${icon(key==='adjustments'?'layers':'chart',24)}<div><strong>${title}</strong><p>${text}</p></div></div></section>`;}
function numericTable(t,groups,series,compare){
 return `<div class="table-wrap wb-bars-table"><table><thead><tr><th>${compare?'日期':'周区间'}</th>${series.map(s=>`<th class="num">${esc(s.name)}${compare?' · 变化':''}（件）</th>`).join('')}</tr></thead><tbody>${groups.map((g,i)=>`<tr><td>${esc(g.label)}</td>${series.map(s=>`<td class="num"><button class="text-button" ${attrs(t,s.warehouse,g,compare)} aria-label="查看${esc(s.name)} ${esc(g.label)}明细">${compare&&s.values[i]>0?'+':''}${fmt(s.values[i])}</button></td>`).join('')}</tr>`).join('')}</tbody><tfoot><tr><th>合计</th>${series.map(s=>`<th class="num">${compare&&sum(s.values)>0?'+':''}${fmt(sum(s.values))}</th>`).join('')}</tr></tfoot></table></div>`;
}
function barChart(t,groups,series,compare,compact){
 const W=800,H=compact?220:270,L=53,R=18,T=18,B=39,inner=W-L-R,plot=H-T-B;
 const values=series.flatMap(s=>s.values),raw=Math.max(1,...values.map(Math.abs)),maximum=Math.ceil(raw/Math.pow(10,Math.floor(Math.log10(raw))))*Math.pow(10,Math.floor(Math.log10(raw)));
 const zero=compare?T+plot/2:T+plot,scale=plot/(compare?2:1)/maximum,groupWidth=inner/groups.length,barWidth=Math.min(44,groupWidth*.72/series.length);
 const ticks=compare?[-maximum,-maximum/2,0,maximum/2,maximum]:[0,maximum/4,maximum/2,maximum*.75,maximum];
 return `<div class="wb-bars-chart${compare?' is-difference':''}"><svg viewBox="0 0 ${W} ${H}" role="group" aria-label="${compare?'候选版本相对当前采用版本的逐日变化':'需求预测柱状图'}，单位件"><text x="${L}" y="11" class="wb-bars-axis">单位：件</text>${ticks.map(v=>{const y=zero-v*scale;return `<line x1="${L}" x2="${W-R}" y1="${y}" y2="${y}" class="${v===0?'wb-bars-zero':'wb-bars-grid'}"/><text x="${L-9}" y="${y+4}" text-anchor="end" class="wb-bars-axis">${fmt(v)}</text>`;}).join('')}${groups.map((g,i)=>series.map((s,j)=>{const value=s.values[i],height=Math.max(2,Math.abs(value)*scale),x=L+groupWidth*(i+.5)-barWidth*series.length/2+j*barWidth,y=value>=0?zero-height:zero,fill=compare?(value<0?'#48ad9c':value>0?'#9170da':'#bbb4ca'):s.color;
 return `<rect class="wb-bars-bar" x="${x}" y="${y}" width="${Math.max(2,barWidth-3)}" height="${height}" rx="2" fill="${fill}" role="button" tabindex="0" ${attrs(t,s.warehouse,g,compare)} aria-label="${esc(g.label)} ${esc(s.name)} ${compare&&value>0?'+':''}${fmt(value)}件，查看明细"><title>${esc(g.label)} · ${esc(s.name)}：${compare&&value>0?'+':''}${fmt(value)}件</title></rect>`;}).join('')).join('')}${groups.filter((g,i)=>!compare||i===0||i===groups.length-1||i%5===4).map(g=>{const i=groups.indexOf(g);return `<text x="${L+groupWidth*(i+.5)}" y="${H-15}" text-anchor="middle" class="wb-bars-axis">${esc(g.label)}</text>`;}).join('')}</svg><div class="wb-bars-legend">${compare?'<span><i style="background:#9170da"></i>上调</span><span><i style="background:#48ad9c"></i>下调</span>':series.map(s=>`<span><i style="background:${s.color}"></i>${esc(s.name)}</span>`).join('')}<span>点击柱形或聚焦后按 Enter 查看明细</span></div></div>`;
}
function moduleHTML(key,t,c,groups,series,description,compare=false){
 const totals=series.map(s=>`<div><span>${esc(s.name)}${compare?' · 净变化':' · 全期'}</span><strong>${compare&&sum(s.values)>0?'+':''}${fmt(sum(s.values))}<small> 件</small></strong></div>`).join('');
 const span=groups.length?`${groups[0].label.split('—')[0]}—${groups.at(-1).label.split('—').at(-1)}`:'';
 return `<section class="card personal-module wb-bars-module${c.compact?' is-compact':''}" data-personal-module="${key}"><div class="personal-module-head"><div><span class="personal-kicker">${compare?'版本变化核对':c.barMode==='table'?'需求数值表':'需求分布'}</span><h2>${NAMES[key]}</h2><p>${esc(t.name)} · ${esc(t.id)} · ${esc(description)}</p></div>${hideButton(key)}</div><div class="wb-bars-body"><div class="wb-bars-totals">${totals}<span class="wb-bars-period">${esc(span)} · ${compare?'逐日差值':'每7天合计'}</span></div>${c.barMode==='table'?numericTable(t,groups,series,compare):barChart(t,groups,series,compare,c.compact)}<div class="wb-bars-note">${icon('info',13)}<span>${compare?'正值表示候选版本上调，负值表示下调；确认候选之前，当前采用版本保持不变。':`按实际天数汇总，末周 ${groups.at(-1).to-groups.at(-1).from+1} 天。${current(t).warehouseData?'分仓采用当前版本保存的明细。':'演示分仓为上海仓逐日取60%并四舍五入，杭州仓取剩余量。'}`}</span></div></div></section>`;
}

export function renderWorkbenchCharts(config={}){
 const c={warehouse:'all',barMode:'chart',compact:true,...config};
 if(!['all','上海仓','杭州仓'].includes(c.warehouse))c.warehouse='all';
 const result={weekly:'',warehouseBars:'',adjustments:''},t=sourceTask(c);
 for(const [key,flag] of [['weekly','showWeekly'],['warehouseBars','showWarehouseBars'],['adjustments','showAdjustments']]){
  if(!c[flag])continue;
  if(!t){result[key]=emptyModule(key,'当前范围暂无可用预测','预测计算完成后，可以查看此范围的需求数据。');continue;}
  const v=current(t),groups=dates(t,v.data.length,key!=='adjustments');
  if(key==='weekly'){
   const data=daily(t,v,c.warehouse),series=[{name:c.warehouse==='all'?'当前范围总需求':c.warehouse,warehouse:c.warehouse,color:COLORS[0],values:aggregate(data,groups)}];
   result[key]=moduleHTML(key,t,c,groups,series,`${v.id} · ${viewState(t,v)} · ${c.warehouse==='all'?t.warehouses.join('、'):c.warehouse}`);
  }else if(key==='warehouseBars'){
   const warehouses=c.warehouse==='all'?(t.warehouses||[]).filter(w=>['上海仓','杭州仓'].includes(w)):[c.warehouse];
   if(!warehouses.length){result[key]=emptyModule(key,'没有可展示的分仓明细','当前预测不包含支持的仓库范围。');continue;}
   const series=warehouses.map((w,i)=>({name:w,warehouse:w,color:COLORS[i%COLORS.length],values:aggregate(daily(t,v,w),groups)}));
   result[key]=moduleHTML(key,t,c,groups,series,`${v.id} · ${viewState(t,v)} · 同周分仓对比`);
  }else{
   const candidate=version(t,t.candidate),adopted=version(t,t.confirmed);
   if(!candidate||candidate.id===adopted?.id){result[key]=emptyModule(key,'没有待比较草稿','当前没有新的待确认候选版本。调整预测生成草稿后，再与当前采用版本比较。');continue;}
   if(!valid(adopted)){result[key]=emptyModule(key,'暂无当前采用版本可比较','需要同一预测内有效的当前采用版本，才能计算候选版本的调整差异。');continue;}
   if(!valid(candidate)||candidate.data.length!==adopted.data.length){result[key]=emptyModule(key,'候选与采用版本日期不一致','当前版本明细无法逐日对应，请打开预测工作区核查数据范围。');continue;}
   const data=daily(t,candidate,c.warehouse),previous=daily(t,adopted,c.warehouse),series=[{name:`${candidate.id} − ${adopted.id}`,warehouse:c.warehouse,color:COLORS[0],values:data.map((n,i)=>n-previous[i])}];
   result[key]=moduleHTML(key,t,c,dates(t,data.length,false),series,`候选 ${candidate.id} − 当前采用 ${adopted.id} · ${c.warehouse==='all'?t.warehouses.join('、'):c.warehouse}`,true);
  }
 }
 return result;
}
