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
 const matches=relatedExperiences(t),canBrowse=state.stage==='review';
 const head=`<div class="card-header"><div><h3 class="section-title">相关参考经验 ${badge(matches.length,'purple')}</h3><p class="tiny muted">按商品、区域及仓库匹配，适用性仍需核实；仅供参考，不改变当前预测。</p></div>${canBrowse?`<button class="text-button" data-diagnosis-experience-list>查看全部 ${icon('arrow',13)}</button>`:''}</div>`;
 if(!matches.length)return `<section class="card section-gap forecast-related-experiences">${head}<div class="card-body"><div class="forecast-experience-empty"><span class="icon-box">${icon('layers',20)}</span><div><strong>暂无匹配的参考经验</strong><p class="tiny muted">在“复盘与经验”保存匹配当前商品、区域与仓库的经验后，这里会展示。本演示阶段的经验独立保存。</p>${canBrowse?`<button class="btn small" data-diagnosis-experience-list>前往复盘与经验 ${icon('arrow',13)}</button>`:'<span class="tiny muted">进入独立历史复盘演示，可查看和整理参考经验。</span>'}</div></div></div></section>`;
 return `<section class="card section-gap forecast-related-experiences">${head}<div class="card-body forecast-experience-list">${matches.slice(0,3).map(e=>{
  const match=matchExperience(e,t),source=sourceParts(e),period=periodLabel(e,t);
  const sourceLabel=source?`${source.month} · 历史${source.version}`:'来源年月与版本待核实';
  return `<article class="forecast-experience-item"><div class="forecast-experience-head"><div><h4>${esc(e.title||'未命名参考经验')}</h4><span class="tiny muted">来源：${esc(sourceLabel)} · 修订 R${esc(e.revision??1)}</span></div>${badge(period.text,period.tone)}</div><p class="forecast-experience-match">${icon('layers',13)} 匹配：${esc(match.product)} · ${esc(match.region)} · ${esc(match.warehouses.join('、'))}</p><dl><div><dt>本次观察</dt><dd>${esc(e.observation||'尚未填写')}</dd></div><div><dt>适用条件</dt><dd>${esc(e.conditions||'尚未填写，使用前需核实')}</dd></div><div><dt>限制</dt><dd>${esc(e.limits||'未记录限制，使用前需补充核实')}</dd></div></dl><div class="forecast-experience-footer"><span class="tiny muted">复盘记录不代表本次预测已获验证</span><button class="btn small" data-diagnosis-experience="${esc(e.id)}">查看经验详情 ${icon('arrow',13)}</button></div></article>`;
 }).join('')}${matches.length>3?`<p class="tiny muted forecast-experience-more">已展示最近 ${Math.min(3,matches.length)} 条，共 ${matches.length} 条匹配经验；可前往查看全部。</p>`:''}</div></section>`;
}
