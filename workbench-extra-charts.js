import {state,version,esc,fmt,sum,icon} from './core.js';

const TITLES={warehousePie:'仓库需求占比饼图',weeklyArea:'每周需求堆叠面积图',taskStatus:'预测任务状态环形图'};
const COLORS=['#9170da','#48ad9c','#e8b367','#d9899b','#8eacc9','#b8aec8','#9da5ac'];
const current=t=>version(t,t.candidate)||version(t,t.confirmed)||version(t,t.viewed)||t.versions?.[0];
const valid=v=>Array.isArray(v?.data)&&v.data.length>0&&v.data.every(n=>Number.isFinite(Number(n))&&Number(n)>=0);
const scoped=(t,c)=>!t.archived&&(c.warehouse==='all'||t.warehouses?.includes(c.warehouse));
const adoption=(t,v)=>v.id===t.candidate?'待确认草稿':v.id===t.confirmed?(v.autoAdopted?'系统自动采用':'当前采用'):'当前查看';
const attrs=(t,w,from,to)=>`data-wb-chart-task="${esc(t.id)}" data-warehouse="${esc(w)}" data-from="${from}" data-to="${to}"`;
function shell(key,c,subtitle,body,note=''){
 return `<section class="card personal-module wb-extra-module${c.compact?' is-compact':''}" data-personal-module="${key}"><div class="personal-module-head"><div><span class="personal-kicker">${key==='taskStatus'?'工作进展':'需求分析'}</span><h2>${TITLES[key]}</h2>${subtitle?`<p>${esc(subtitle)}</p>`:''}</div><button class="text-button wb-extra-hide" data-workbench-command="隐藏${TITLES[key]}" aria-label="隐藏${TITLES[key]}">${icon('x',13)} 隐藏</button></div><div class="wb-extra-body">${body}</div>${note?`<div class="personal-module-foot wb-extra-note">${icon('info',13)}<span>${esc(note)}</span></div>`:''}</section>`;
}
function empty(key,c,title,message){return shell(key,c,'',`<div class="wb-extra-empty">${icon('chart',24)}<div><strong>${esc(title)}</strong><p>${esc(message)}</p></div></div>`);}
function seriesFor(t,v,c){
 const names=c.warehouse==='all'?(t.warehouses||[]).filter(w=>['上海仓','杭州仓'].includes(w)):[c.warehouse];
 return [...new Set(names)].map((name,i)=>({name,color:COLORS[i],values:v.data.map((n,j)=>Number(v.warehouseData?.[j]?.[name==='上海仓'?'sh':'hz']??(name==='上海仓'?Math.round(Number(n)*.6):Number(n)-Math.round(Number(n)*.6))))}));
}
function sourceNote(t,v,series){
 const complete=series.every(s=>v.data.every((_,i)=>v.warehouseData?.[i]?.[s.name==='上海仓'?'sh':'hz']!=null));
 return `${complete?'分仓采用当前版本保存的明细。':'缺少分仓明细时采用演示拆分：上海仓逐日取60%并四舍五入，杭州仓取剩余量。'}${series.length===1?'当前仅展示所选仓库，占比以此范围为100%。':''}`;
}
function percentages(values){
 const total=sum(values);if(!total)return values.map(()=>0);
 const raw=values.map(v=>v/total*100),out=raw.map(Math.floor),order=raw.map((v,i)=>({i,f:v-out[i]})).sort((a,b)=>b.f-a.f);
 for(let n=100-sum(out),i=0;i<n;i++)out[order[i%order.length].i]++;
 return out;
}
function donut(items,total,unit,interactive){
 const radius=74,circumference=2*Math.PI*radius;let offset=0;
 return `<svg class="wb-extra-donut" viewBox="0 0 220 220" ${interactive?'role="group"':'role="img"'} aria-label="${esc(items.map(s=>`${s.name} ${fmt(s.value)}${unit}`).join('，'))}"><circle cx="110" cy="110" r="${radius}" fill="none" stroke="#f0ecf6" stroke-width="25"/>${items.filter(s=>s.value>0).map(s=>{const length=s.value/total*circumference,dashOffset=-offset;offset+=length;return `<circle class="wb-extra-segment" cx="110" cy="110" r="${radius}" fill="none" stroke="${s.color}" stroke-width="25" stroke-dasharray="${length} ${circumference-length}" stroke-dashoffset="${dashOffset}" transform="rotate(-90 110 110)"${interactive?` role="button" tabindex="0" ${s.attrs} aria-label="${esc(s.name)} ${fmt(s.value)}${unit}，查看预测明细"`:''}><title>${esc(s.name)}：${fmt(s.value)}${unit}</title></circle>`;}).join('')}<text class="wb-extra-donut-total" x="110" y="108" text-anchor="middle">${fmt(total)}</text><text class="wb-extra-donut-unit" x="110" y="132" text-anchor="middle">当前范围 · ${unit}</text></svg>`;
}
function pie(items,total){
 const radius=87,cx=110,cy=110;let angle=-Math.PI/2;
 const point=a=>`${cx+radius*Math.cos(a)},${cy+radius*Math.sin(a)}`;
 return `<svg class="wb-extra-donut wb-extra-pie" viewBox="0 0 220 220" role="group" aria-label="仓库需求占比饼图，${esc(items.map(s=>`${s.name} ${fmt(s.value)}件`).join('，'))}">${items.filter(s=>s.value>0).map(s=>{
  const start=angle,sweep=s.value/total*Math.PI*2;angle+=sweep;
  const shape=s.value===total?`circle cx="${cx}" cy="${cy}" r="${radius}"`:`path d="M ${cx},${cy} L ${point(start)} A ${radius},${radius} 0 ${sweep>Math.PI?1:0},1 ${point(angle)} Z"`;
  const tag=s.value===total?'circle':'path';
  return `<${shape} class="wb-extra-pie-slice" fill="${s.color}" stroke="white" stroke-width="2" role="button" tabindex="0" ${s.attrs} aria-label="${esc(s.name)} ${fmt(s.value)}件，占比${s.percent}%，查看预测明细"><title>${esc(s.name)}：${fmt(s.value)}件 · ${s.percent}%</title></${tag}>`;
 }).join('')}</svg>`;
}
function warehousePie(c,t,v,series){
 const total=sum(series.flatMap(s=>s.values));
 if(!total)return empty('warehousePie',c,'当前范围需求为 0','需求总量为零，暂不计算仓库占比。');
 const shares=percentages(series.map(s=>sum(s.values))),items=series.map((s,i)=>({...s,value:sum(s.values),percent:shares[i],attrs:attrs(t,s.name,1,v.data.length)}));
 const body=`<div class="wb-extra-donut-layout">${pie(items,total)}<div class="wb-extra-legend"><div class="wb-extra-pie-total"><span>当前范围 · 全期需求</span><strong>${fmt(total)}<small> 件</small></strong></div>${items.map(s=>`<button class="wb-extra-legend-row" ${s.attrs}><i style="background:${s.color}"></i><span>${esc(s.name)}<small>${fmt(s.value)} 件</small></span><strong>${s.percent}%</strong></button>`).join('')}<p>点击扇区或仓库查看全期预测明细</p></div></div>`;
 return shell('warehousePie',c,`${t.name} · ${v.id} · ${adoption(t,v)}`,body,sourceNote(t,v,series));
}
function groupsFor(t,length){
 const start=t.form?.start||String(t.period||'').match(/\d{4}-\d{2}-\d{2}/)?.[0];
 const date=i=>{if(!start)return `第${i+1}天`;const d=new Date(start+'T00:00:00Z');if(!Number.isFinite(d.getTime()))return `第${i+1}天`;d.setUTCDate(d.getUTCDate()+i);return `${d.getUTCMonth()+1}/${d.getUTCDate()}`;};
 return Array.from({length:Math.ceil(length/7)},(_,i)=>{const from=i*7+1,to=Math.min(length,from+6);return {from,to,label:from===to?date(from-1):`${date(from-1)}—${date(to-1)}`};});
}
function weeklyArea(c,t,v,series){
 const groups=groupsFor(t,v.data.length),data=series.map(s=>({...s,weekly:groups.map(g=>sum(s.values.slice(g.from-1,g.to)))})),totals=groups.map((_,i)=>sum(data.map(s=>s.weekly[i]))),total=sum(totals);
 if(!total)return empty('weeklyArea',c,'当前范围需求为 0','当前预测各周需求均为零，暂无可展示的面积变化。');
 const W=720,H=245,L=54,R=22,T=22,B=40,plotH=H-T-B,plotW=W-L-R,raw=Math.max(...totals),power=10**Math.floor(Math.log10(raw)),max=Math.ceil(raw/power)*power;
 const x=i=>groups.length===1?L+plotW/2:L+i*plotW/(groups.length-1),y=n=>T+plotH-n/max*plotH;let running=totals.map(()=>0);
 const shapes=data.map(s=>{const low=[...running],high=low.map((n,i)=>n+s.weekly[i]);running=high;let points;
  if(groups.length===1)points=`${L},${y(low[0])} ${L},${y(high[0])} ${W-R},${y(high[0])} ${W-R},${y(low[0])}`;
  else points=high.map((n,i)=>`${x(i)},${y(n)}`).concat(low.map((n,i)=>`${x(i)},${y(n)}`).reverse()).join(' ');
  return `<polygon points="${points}" fill="${s.color}" fill-opacity=".3"/><polyline points="${high.map((n,i)=>`${x(i)},${y(n)}`).join(' ')}" fill="none" stroke="${s.color}" stroke-width="2.5"/>${groups.map((g,i)=>`<circle class="wb-extra-area-point" cx="${x(i)}" cy="${y(high[i])}" r="5" fill="${s.color}" stroke="white" stroke-width="2" role="button" tabindex="0" ${attrs(t,s.name,g.from,g.to)} aria-label="${esc(g.label)} ${esc(s.name)} ${fmt(s.weekly[i])}件，查看明细"><title>${esc(g.label)} · ${esc(s.name)}：${fmt(s.weekly[i])}件</title></circle>`).join('')}`;
 }).join('');
 const svg=`<svg class="wb-extra-area" viewBox="0 0 ${W} ${H}" role="group" aria-label="各仓每周预测需求堆积面积图，单位件"><text class="wb-extra-axis" x="${L}" y="12">单位：件</text>${[0,.25,.5,.75,1].map(n=>`<line class="wb-extra-grid" x1="${L}" x2="${W-R}" y1="${y(max*n)}" y2="${y(max*n)}"/><text class="wb-extra-axis" x="${L-9}" y="${y(max*n)+4}" text-anchor="end">${fmt(max*n)}</text>`).join('')}${shapes}${groups.map((g,i)=>i===0||i===groups.length-1||i%Math.max(1,Math.ceil(groups.length/6))===0?`<text class="wb-extra-axis" x="${x(i)}" y="${H-14}" text-anchor="middle">${esc(g.label)}</text>`:'').join('')}</svg>`;
 const body=`<div class="wb-extra-area-total"><span>当前范围 · 全期需求</span><strong>${fmt(total)}<small> 件</small></strong></div>${svg}<div class="wb-extra-area-legend">${data.map(s=>`<button class="text-button" ${attrs(t,s.name,1,v.data.length)}><i style="background:${s.color}"></i>${esc(s.name)}</button>`).join('')}<span>点击圆点查看对应周的预测明细</span></div>`;
 return shell('weeklyArea',c,`${t.name} · ${v.id} · ${adoption(t,v)}`,body,`每7天合计，末周 ${groups.at(-1).to-groups.at(-1).from+1} 天；面积为分仓需求堆积。${sourceNote(t,v,series)}`);
}
function taskStatus(c){
 const tasks=(state.tasks||[]).filter(t=>scoped(t,c));
 if(!tasks.length)return empty('taskStatus',c,'当前范围暂无预测任务','创建预测后，将按任务状态展示数量分布。');
 const classify=t=>t.status==='success'?(t.candidate?'待确认版本':'计算完成'):({running:'正在计算',failed:'计算未完成',draft:'预测草稿',cancelled:'已取消'})[t.status]||'其他状态';
 const names=['待确认版本','计算完成','正在计算','计算未完成','预测草稿','已取消','其他状态'],items=names.map((name,i)=>({name,color:COLORS[i],value:tasks.filter(t=>classify(t)===name).length})).filter(s=>s.value),shares=percentages(items.map(s=>s.value));
 const body=`<div class="wb-extra-donut-layout"><button class="wb-extra-donut-link" data-nav="tasks" aria-label="查看全部预测任务">${donut(items,tasks.length,'项',false)}</button><div class="wb-extra-legend">${items.map((s,i)=>`<button class="wb-extra-legend-row" data-nav="tasks" aria-label="${esc(s.name)} ${s.value}项，打开全部预测任务"><i style="background:${s.color}"></i><span>${esc(s.name)}<small>${s.value} 项</small></span><strong>${shares[i]}%</strong></button>`).join('')}<p>点击图表或状态打开全部预测任务</p></div></div>`;
 return shell('taskStatus',c,`${c.warehouse==='all'?'全部负责仓库':c.warehouse} · ${tasks.length} 项未归档预测`,body,'按当前任务状态统计，每项任务仅计入一个状态；完成且有候选版本的任务列为待确认版本。');
}
export function renderExtraCharts(config={}){
 const c={warehouse:'all',compact:true,...config};if(!['all','上海仓','杭州仓'].includes(c.warehouse))c.warehouse='all';
 const result={warehousePie:'',weeklyArea:'',taskStatus:''};
 if(c.showTaskStatus)result.taskStatus=taskStatus(c);
 if(c.showWarehousePie||c.showWeeklyArea){
  const tasks=(state.tasks||[]).filter(t=>scoped(t,c)&&t.status==='success'&&valid(current(t))),t=tasks.find(t=>t.id===state.taskId)||tasks[0];
  for(const [key,flag,render] of [['warehousePie','showWarehousePie',warehousePie],['weeklyArea','showWeeklyArea',weeklyArea]]){
   if(!c[flag])continue;
   if(!t){result[key]=empty(key,c,'当前范围暂无可用预测','预测计算完成后，可以在这里查看需求分布。');continue;}
   const v=current(t),series=seriesFor(t,v,c);
   if(!series.length||series.some(s=>s.values.some(n=>!Number.isFinite(n)||n<0))){result[key]=empty(key,c,'暂无有效的分仓需求明细','请在预测结果中核查仓库范围与需求数据。');continue;}
   result[key]=render(c,t,v,series);
  }
 }
 return result;
}
