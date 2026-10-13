import {state,esc,icon,badge} from './core.js';

const HISTORICAL_SOURCE='P001:historical-review:V3:2026-10';
const WAREHOUSES={all:['上海仓','杭州仓'],shanghai:['上海仓'],hangzhou:['杭州仓']};
const scopeTokens=value=>String(value||'').normalize('NFKC').split(/[\s·•/\\、,，;；:：|｜()（）\[\]【】]+/u).filter(Boolean);
const sourceParts=e=>{
 const match=String(e.sourceKey||'').match(/(?:^|:)historical-review:([^:]+):(\d{4}-\d{2})(?::|$)/);
 return match?{version:match[1],month:match[2]}:null;
};
function matchExperience(e,t){
 if(!e||!t||e.status==='archived'||e.archived||e.stage&&e.stage!==state.stage)return null;
 const tokens=scopeTokens(e.scope),product=String(t.product||'').normalize('NFKC'),region=String(t.region||'').normalize('NFKC');
 if(!product||!region||!tokens.includes(product)||!tokens.includes(region))return null;
 if(String(e.sourceKey||'').startsWith(HISTORICAL_SOURCE)&&(state.stage!=='review'||product!=='A商品'||region!=='华东'))return null;
 // Explicit warehouse names in the editable scope take precedence over old metadata.
 const named=tokens.flatMap(token=>token.split(/[和与及&+]+/u)).filter(token=>token.endsWith('仓'));
 const warehouses=named.length?named:(WAREHOUSES[e.warehouse]||[]);
 const matched=[...new Set((t.warehouses||[]).filter(w=>warehouses.includes(w)))];
 return matched.length?{product,region,warehouses:matched}:null;
}

// Read only from the active stage's in-memory collection; never load other snapshots.
export function relatedExperiences(t){
 return (state.experiences||[]).filter(e=>matchExperience(e,t)).slice().sort((a,b)=>Number(!!a.demo)-Number(!!b.demo)||String(b.updated||b.created||'').localeCompare(String(a.updated||a.created||'')));
}
function periodLabel(e,t){
 if(e.demo)return {text:'模拟案例 · 仅演示参考方法',tone:'gray'};
 const source=sourceParts(e),start=String(t.form?.start||t.period||'').match(/\d{4}-\d{2}/)?.[0];
 const end=String(t.form?.end||t.period||'').match(/\d{4}-\d{2}/g)?.at(-1)||start;
 if(!source?.month)return {text:'来源周期待核实 · 仅供参考',tone:'gray'};
 if(start&&source.month>=start&&source.month<=end)return {text:'同周期复盘 · 仅供回看',tone:'amber'};
 if(start&&source.month>start)return {text:'晚于预测周期 · 仅供回看',tone:'amber'};
 return {text:'历史复盘参考 · 适用性待核实',tone:'gray'};
}

export function renderRelatedExperiences(t){
 const matches=relatedExperiences(t);
 const heading=`<div class="between"><span class="eyebrow">已沉淀的相关经验</span>${badge(matches.length,'purple')}</div>`;
 if(!matches.length)return `<section class="card forecast-related-experiences"><div class="card-body">${heading}<h3>暂无相关经验</h3><p class="tiny muted experience-summary">复盘完成后点击「沉淀参考经验」，下次遇到相同商品、区域和仓库时，可在这里参考。</p></div></section>`;
 return `<section class="card forecast-related-experiences"><div class="card-body">${heading}<p class="tiny muted experience-match-hint">按当前商品、区域和仓库匹配</p>${matches.slice(0,2).map(item=>{
  const matched=matchExperience(item,t),source=sourceParts(item),period=periodLabel(item,t);
  const sourceLabel=item.demo?(item.sourceLabel||'模拟案例 · 非真实复盘'):(item.sourceLabel||(source?`${source.month}复盘 · ${source.version}`:'历史沉淀记录'));
  return `<div class="experience-preview"><h3 class="experience-title" title="${esc(item.title)}">${esc(item.title||'未命名参考经验')}</h3><p class="tiny muted experience-summary experience-source" title="${esc(sourceLabel)}">来源：${esc(sourceLabel)}</p><p class="tiny muted experience-summary"><strong>本次观察：</strong>${esc(item.observation||'查看详情了解本次复盘结果。')}</p><p class="tiny muted experience-summary"><strong>下次参考：</strong>${esc(item.conditions||'核实业务条件相近后，参考本次复盘的处理方法。')}</p><p class="tiny muted experience-source" title="${esc([matched.product,matched.region,...matched.warehouses].join(' · '))}">${esc(period.text)}</p><button class="text-button" data-diagnosis-experience="${esc(item.id)}">查看详情 ${icon('arrow',13)}</button></div>`;
 }).join('')}<div class="experience-actions"><button class="text-button" data-diagnosis-experience-list>查看全部 ${icon('arrow',13)}</button></div></div></section>`;
}
