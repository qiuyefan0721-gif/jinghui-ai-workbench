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
 return (state.experiences||[]).filter(e=>matchExperience(e,t)).slice().sort((a,b)=>String(b.updated||b.created||'').localeCompare(String(a.updated||a.created||'')));
}
function periodLabel(e,t){
 const source=sourceParts(e),start=String(t.form?.start||t.period||'').match(/\d{4}-\d{2}/)?.[0];
 const end=String(t.form?.end||t.period||'').match(/\d{4}-\d{2}/g)?.at(-1)||start;
 if(!source?.month)return {text:'来源周期待核实 · 仅供参考',tone:'gray'};
 if(start&&source.month>=start&&source.month<=end)return {text:'同周期复盘 · 仅供回看',tone:'amber'};
 if(start&&source.month>start)return {text:'晚于预测周期 · 仅供回看',tone:'amber'};
 return {text:'历史复盘参考 · 适用性待核实',tone:'gray'};
}

export function renderRelatedExperiences(t){
 const matches=relatedExperiences(t),e=matches[0],canBrowse=state.stage==='review';
 const heading=`<div class="between"><span class="eyebrow">相关参考经验</span>${badge(matches.length,'purple')}</div>`;
 const browse=canBrowse?`<button class="text-button" data-diagnosis-experience-list>${e?'查看全部':'前往整理'} ${icon('arrow',13)}</button>`:'';
 if(!e)return `<section class="card forecast-related-experiences"><div class="card-body">${heading}<h3>暂无匹配的参考经验</h3><p class="tiny muted experience-summary">保存与当前商品、区域和仓库匹配的经验后，将在这里展示。</p><div class="experience-actions">${browse||'<span class="tiny muted">可在历史复盘演示中整理</span>'}</div></div></section>`;
 const period=periodLabel(e,t);
 return `<section class="card forecast-related-experiences"><div class="card-body">${heading}<h3 class="experience-title" title="${esc(e.title)}">${esc(e.title||'未命名参考经验')}</h3><p class="tiny muted experience-summary">${esc(period.text)} · R${esc(e.revision??1)}。${esc(e.observation||'查看经验详情了解适用条件。')}</p><div class="experience-actions"><button class="text-button" data-diagnosis-experience="${esc(e.id)}">查看详情 ${icon('arrow',13)}</button>${browse}</div></div></section>`;
}
