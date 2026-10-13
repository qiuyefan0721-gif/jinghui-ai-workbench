import {state,task,save,esc,icon,nav,forecastScopeError} from './core.js';
import {newForecastDefaults,submitForecastDraft} from './operations.js';
export const creation=()=>state.assistantCreation;
export function openForecastCard(taskId){
 const old=creation();if(old?.open&&old.status==='editing'&&(!taskId||old.form.id===taskId)){window.dispatchEvent(new Event('app:show-assistant'));return;}
 const t=taskId?task(taskId):null;
 if(t&&!['draft','failed','cancelled'].includes(t.status))return;
 if(!old||old.status==='submitted'||taskId){state.assistantCreation={open:true,status:'editing',form:{...newForecastDefaults(),...(t?.form||{}),...(t?{id:t.status==='draft'?t.id:undefined,name:t.name}:{}),mode:'form',recognized:true},error:'',review:false};}
 else old.open=true;
 save();window.dispatchEvent(new Event('app:show-assistant'));
}
export function renderForecastCard(){
 const c=creation();if(!c?.open)return '';
 if(c.status==='submitted'){
  const t=task(c.taskId),labels={draft:'草稿已保存',running:'正在计算',success:t?.confirmed==='V0'&&!t?.candidate?'计算完成，V0已自动采用':'计算完成，预测诊断已生成',failed:'计算失败',cancelled:'计算已取消'};
  return `<section class="assistant-forecast-card" id="assistant-forecast-card"><div class="assistant-forecast-head"><strong>新建预测</strong>${icon('checkCircle',15)}</div><div class="assistant-forecast-status" role="status">${esc(labels[t?.status]||'任务已提交')}</div><p>${esc(t?.name)} · ${esc(c.taskId)}</p><p class="tiny muted">${esc(t?.period)}<br>${esc(t?.warehouses?.join('、'))}</p><div class="assistant-forecast-actions"><button class="btn small" data-create-view>${t?.status==='draft'?'继续编辑':'查看预测'}</button><button class="btn small primary" data-create-another>再建一个</button><button class="btn small" data-create-hide>收起</button></div></section>`;
 }
 const d=c.form;
 return `<form class="assistant-forecast-card" id="assistant-forecast-card" novalidate><div class="assistant-forecast-head"><strong>${d.id?'编辑预测条件':'新建预测'}</strong><span class="tiny muted">单次预测</span></div><p class="tiny muted">填写后可保存草稿，或检查条件后计算。</p><div class="assistant-forecast-fields"><label class="field">预测名称 *<input class="input" name="name" maxlength="100" value="${esc(d.name)}" placeholder="填写预测名称"></label><div class="assistant-forecast-grid"><label class="field">商品<select class="select" name="product"><option>A商品</option></select></label><label class="field">区域<select class="select" name="region"><option>华东</option></select></label></div><div class="field"><span>仓库 *</span><div class="row"><label><input type="checkbox" name="sh" ${d.warehouses.includes('上海仓')?'checked':''}> 上海仓</label><label><input type="checkbox" name="hz" ${d.warehouses.includes('杭州仓')?'checked':''}> 杭州仓</label></div></div><label class="field">开始日期 *<input class="input" type="date" name="start" value="${esc(d.start)}"></label><label class="field">结束日期 *<input class="input" type="date" name="end" value="${esc(d.end)}"></label><label class="field">业务补充说明<input class="input" name="note" value="${esc(d.note)}" placeholder="选填，仅本次使用"></label></div><p class="tiny muted">示例可计算：华东A商品、两仓、2026-10-01至10-30（日粒度）。其他范围可保存草稿。</p><div class="assistant-forecast-error" role="alert">${esc(c.error||'')}</div>${c.review?`<div class="assistant-forecast-review"><strong>确认本次计算</strong><p>${esc(d.name)}<br>${esc(d.warehouses.join('、'))}<br>${esc(d.start)} — ${esc(d.end)}</p><p>首次计算完成后自动采用V0基线，无需再次确认。后续调整生成的候选版本仍需手动确认替换；发现异常时可查看预测诊断。</p><div class="assistant-forecast-actions"><button type="button" class="btn small" data-create-back>继续编辑</button><button type="button" class="btn small primary" data-create-confirm>确认并计算</button></div></div>`:`<div class="assistant-forecast-actions"><button type="button" class="btn small" data-create-hide>暂存收起</button><button type="button" class="btn small" data-create-save>保存草稿</button><button type="submit" class="btn small primary" data-create-start>开始计算</button></div>`}</form>`;
}
function storeInput(root){const c=creation();if(!c||c.status==='submitted')return;for(const key of ['name','product','region','start','end','note'])c.form[key]=root.elements[key].value;c.form.warehouses=[root.elements.sh.checked?'上海仓':null,root.elements.hz.checked?'杭州仓':null].filter(Boolean);c.review=false;c.error='';// Persist without re-rendering, so typing keeps focus.
 try{localStorage.setItem('jinghui-workbench-v1',JSON.stringify(state))}catch{}
}
function basicError(d){return !d.name.trim()?'请填写预测名称。':!d.warehouses.length?'请至少选择一个仓库。':!d.start||!d.end?'请选择完整日期。':d.end<d.start?'结束日期不能早于开始日期。':'';}
export function bindForecastCard(){
 const root=document.querySelector('#assistant-forecast-card'),c=creation();if(!root||!c)return;
 root.querySelector('[data-create-hide]')?.addEventListener('click',()=>{c.open=false;save()});
 root.querySelector('[data-create-another]')?.addEventListener('click',()=>{delete state.assistantCreation;openForecastCard()});
 root.querySelector('[data-create-view]')?.addEventListener('click',()=>{const t=task(c.taskId);if(t?.status==='draft')openForecastCard(t.id);else if(t)nav('forecast',{taskId:t.id,tab:'result'})});
 if(c.status==='submitted')return;
 root.addEventListener('input',()=>{const reviewing=c.review;storeInput(root);if(reviewing)save()});root.addEventListener('change',()=>{storeInput(root);if(root.querySelector('[data-create-confirm]'))save()});
 const submit=start=>{
  if(c.submitting)return;c.submitting=true;
  const result=submitForecastDraft(c.form,{start});
  if(result.error){c.submitting=false;c.review=false;c.error=result.error;save();return;}
  c.status='submitted';c.taskId=result.taskId;c.submitting=false;c.review=false;save();window.dispatchEvent(new Event('app:show-assistant'));
 };
 root.querySelector('[data-create-save]')?.addEventListener('click',()=>submit(false));
 root.onsubmit=e=>{e.preventDefault();c.error=basicError(c.form)||forecastScopeError(c.form);c.review=!c.error;save();requestAnimationFrame(()=>document.querySelector('.assistant-forecast-review,.assistant-forecast-error')?.scrollIntoView({block:'nearest'}));};
 root.querySelector('[data-create-back]')?.addEventListener('click',()=>{c.review=false;save()});
 root.querySelector('[data-create-confirm]')?.addEventListener('click',()=>{if(c.review)submit(true)});
}
