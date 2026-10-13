import {chart,esc} from './core.js';
const colors=['#7955d9','#159b88','#dc8a22','#3488c9','#cf567d','#657c34','#976244','#5564bd'];
export function scenarioTrend(base,scenarios,allScenarios=scenarios){
 const series=[{name:'V0 基线',color:'#788397',data:base.data},...scenarios.filter(s=>s.status==='success').map(s=>({name:s.name+(s.name.includes('+'+s.rate+'%')?'':' · +'+s.rate+'%'),color:colors[Math.max(0,allScenarios.indexOf(s))%colors.length],data:s.data}))];
 const groups=new Map();series.forEach((s,i)=>{const key=JSON.stringify(s.data);groups.set(key,[...(groups.get(key)||[]),i]);});
 const identical=[...groups.values()].filter(g=>g.length>1);
 let idx=0;let html=chart(series,{height:280}).replace(/<path\b[^>]*fill="url\(#area-fill\)"\/>/g,'').replace(/<polyline\b[^>]*\/>/g,tag=>{
  const i=idx++,group=[...groups.values()].find(g=>g.includes(i)),rank=group.indexOf(i);
  const dash=group.length>1?`stroke-dasharray="7 ${7*(group.length-1)}" stroke-dashoffset="${-rank*7}"`:i===0?'stroke-dasharray="5 5"':'';
  return tag.replace(/stroke-dasharray="[^"]*"/g,'').replace('stroke-width="2.5"','stroke-width="3"').replace('/>',`data-scenario-line="${i}" ${dash} />`);
 });
 // The dedicated legend can isolate coincident lines without shifting data values.
 html=html.slice(0,html.indexOf('<div class="chart-legend">'))+'</div>';
 return `<div class="scenario-trend">${html}<div class="scenario-trend-legend"><button type="button" class="active" data-scenario-focus="all" aria-pressed="true">显示全部 ${series.length} 条</button>${series.map((s,i)=>`<button type="button" data-scenario-focus="${i}" aria-pressed="false"><i style="background:${s.color}"></i>${esc(s.name)}</button>`).join('')}</div><p class="scenario-trend-caption" aria-live="polite">已展示 V0 和 ${series.length-1} 个计算完成的方案。点击图例单独查看，再点“显示全部”恢复。</p>${identical.length?`<div class="scenario-trend-overlap">${identical.map(g=>`${g.map(i=>esc(series[i].name)).join('、')}：逐日数值完全一致，曲线重合，已用不同颜色的交错虚线展示。`).join('<br>')}</div>`:''}<p class="scenario-trend-note">数值相同的日期会重合，不代表遗漏；各方案仅调整促销周，其他日期与 V0 相同。单位：件。</p></div>`;
}
export function bindScenarioTrend(root){
 root.querySelectorAll('.scenario-trend').forEach(host=>host.querySelectorAll('[data-scenario-focus]').forEach(button=>button.onclick=()=>{
  const selected=button.dataset.scenarioFocus;
  host.querySelectorAll('[data-scenario-focus]').forEach(b=>{const active=b===button;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});
  host.querySelectorAll('[data-scenario-line]').forEach(line=>{const active=selected==='all'||line.dataset.scenarioLine===selected;line.style.display=active?'':'none';if(selected!=='all'){line.style.strokeDasharray='none';}else line.style.strokeDasharray='';});
  const circles=[...host.querySelectorAll('circle[data-chart-day]')];let series=-1;circles.forEach(c=>{if(c.dataset.chartDay==='0')series++;c.style.display=selected==='all'||String(series)===selected?'':'none';});
  host.querySelector('.scenario-trend-caption').textContent=selected==='all'?'已显示全部曲线；点击图例可单独查看一个方案。':`正在单独查看：${button.textContent.trim()}。点击“显示全部”恢复对比。`;
 }));
}
