import {state,task,version,fmt,sum} from './core.js';
import {configureAndRunScenarios} from './forecast.js';

// Map the prototype's supported business language to the same scenario actions as the canvas.
export function scenarioIntent(text){
 const normalized=text.normalize('NFKC');
 const comparison=/比较|对比|对照|改成|换成|调整为|分别/.test(normalized);
 const adjustment=/上调|增加|下调|降低/.test(normalized);
 if(!comparison&&!adjustment)return null;
 if(/不(?:要|用|需|再).*?(?:计算|运行|执行|修改|改动|调整)|不改|只(?:解释|分析|看看|填入)|先别/.test(normalized))return {error:'你要求暂不运行，因此还没有修改左侧方案。需要执行时可输入“比较8%和10%两个方案并运行”。'};
 let rates=[...normalized.matchAll(/(-?\d+(?:\.\d+)?)\s*%/g)].map(m=>Number(m[1]));
 const pair=normalized.match(/(?:比较|对比|对照|改成|换成|调整为|分别)\s*(-?\d+(?:\.\d+)?)\s*%?\s*(?:和|与|及|、|,|\/|vs\.?|跟)\s*(-?\d+(?:\.\d+)?)\s*%?/i);
 if(pair&&rates.length<2)rates=[Number(pair[1]),Number(pair[2])];
 if(/下调|降低/.test(normalized)||rates.some(r=>!Number.isFinite(r)||r<0||r>30))return {error:'当前情景支持促销周0%—30%的上调。请提供此范围内的比例，例如“比较8%和10%两个方案”。左侧配置尚未修改。'};
 if(rates.some(r=>!Number.isInteger(r)))return {error:'模拟增幅仅支持0%—30%的整数，例如4%、8%。请修改比例后再运行，左侧配置尚未修改。'};
 if(comparison&&(rates.length!==2||rates[0]===rates[1]))return {error:'请指定两个不同的促销周增幅，例如“比较8%和10%两个方案”。左侧配置尚未修改。'};
 if(!comparison&&(!/促销|10月1.*7|1[—至到-]7/.test(normalized)||rates.length!==1))return {error:'请说明促销周的上调比例，例如“促销周上调10%”。当前只调整V0的10月1—7日，其余日期保持不变。'};
 if(/全月|全期|所有日期|其他商品|下个月/.test(normalized))return {error:'当前模拟仅支持本预测V0的促销周，不能按这个范围执行。左侧配置尚未修改。'};
 return {rates,taskIds:[...normalized.matchAll(/\bP\d+\b/gi)].map(m=>m[0].toUpperCase()),warehouses:['上海仓','杭州仓'].filter(w=>normalized.includes(w))};
}

export function executeScenarioIntent(intent,answer){
 if(intent.error){answer.text=intent.error;return;}
 if(state.route==='new'){answer.text='请先保存或退出左侧的新预测表单，再打开要模拟的预测。我还没有修改当前页面。';return;}
 const t=['forecast','scenarios'].includes(state.route)?task():state.tasks.filter(t=>t.status==='success'&&!t.archived).length===1?state.tasks.find(t=>t.status==='success'&&!t.archived):null;
 if(!t||t.archived||t.status!=='success'||!version(t,'V0')?.data?.length){answer.text='请先在左侧打开一个已计算完成的预测，再输入方案指令；我会对该预测执行模拟。';return;}
 if(intent.taskIds?.some(id=>id!==t.id)){answer.text=`当前打开的是${t.id}。请先打开你指定的预测，再发送方案指令，本次没有修改方案。`;return;}
 if(intent.warehouses?.length&&(intent.warehouses.length!==t.warehouses.length||intent.warehouses.some(w=>!t.warehouses.includes(w)))){answer.text=`当前情景基于${t.warehouses.join('、')}的整体V0，暂不支持单独调整指定仓库。本次没有修改方案。`;return;}
 const pending=(state.assistant||[]).find(m=>m.execution?.status==='running'&&m.execution.taskId===t.id&&JSON.stringify(m.execution.rates)===JSON.stringify(intent.rates));
 if(pending){answer.text='这组方案正在计算，左侧已展示进度，请稍候查看结果。';answer.taskId=t.id;answer.action='scenarios';answer.label='查看运行进度';state.route='scenarios';state.taskId=t.id;return;}
 const result=configureAndRunScenarios(intent.rates,t.id);
 if(!result||result.error){answer.text=result?.error||'当前预测无法运行情景，请检查预测状态后重试。';return;}
 state.route='scenarios';state.taskId=t.id;
 answer.taskId=t.id;answer.context=t.name+' · V0情景模拟';
 answer.execution={taskId:t.id,rates:[...intent.rates],scenarios:result.scenarios,status:'running'};
 answer.text=`已将左侧${intent.rates.length===2?'两个方案分别':'方案'}设为${intent.rates.map(r=>r+'%').join('和')}，正在运行预测。\n基于${t.name}的V0，仅调整促销周，其余日期保持不变。`;
 answer.action='scenarios';answer.label='查看左侧运行进度';
}

// Keep responses bound to the exact task and revisions that were requested.
export function syncScenarioReplies(){
 let changed=false;
 for(const m of state.assistant||[]){
  const e=m.execution;if(!e)continue;
  const t=task(e.taskId),ss=e.scenarios.map(ref=>t?.scenarios?.find(s=>s.id===ref.id));
  if(e.status!=='running'){
   if(!m.resultNote&&ss.some((s,i)=>!s||s.revision!==e.scenarios[i].revision||s.token!==e.scenarios[i].token)){m.resultNote='这是一条历史运行记录，左侧参数已更新；以上数值不代表当前方案。';m.label='查看当前方案（参数已更新）';changed=true;}
   continue;
  }
  if(!t||t.archived||ss.some((s,i)=>!s||s.revision!==e.scenarios[i].revision||s.token!==e.scenarios[i].token||s.status==='idle'||s.status==='stale')){
   e.status='cancelled';m.text='本次方案计算已取消，或参数已被新的操作修改。旧结果不会覆盖左侧当前方案，请按当前参数重新运行。';m.label='查看当前方案';changed=true;continue;
  }
  if(ss.some(s=>s.status==='running'))continue;
  if(ss.some(s=>s.status==='failed')){
   e.status='failed';m.text=ss.map(s=>s.status==='success'?`${s.rate}%方案已完成：${fmt(s.total)}件。`:`${s.rate}%方案计算失败，请点击左侧“运行模拟”重试。`).join('\n')+'\n本次尚未得到完整对比结果。';m.label='查看方案与重试';changed=true;continue;
  }
  if(!ss.every(s=>s.status==='success'))continue;
  e.status='success';e.results=ss.map(s=>({id:s.id,rate:s.rate,total:s.total,revision:s.resultRevision}));
  const difference=ss.length===2?`\n两方案全期相差${fmt(Math.abs(ss[1].total-ss[0].total))}件。`:'';
  const high=ss.filter(s=>s.rate>9).map(s=>s.rate+'%').join('、');
  m.text=`已完成${ss.length===2?'两个方案的预测计算':'预测计算'}，左侧卡片和趋势图已更新。\n${ss.map(s=>`${s.rate}%方案：全期${fmt(s.total)}件，促销周${fmt(sum(s.data.slice(0,7)))}件。`).join('\n')}${difference}\n${high?high+'超出7%—9%的历史参考范围，采用前需补充活动依据。':'增幅在参考上限以内，采用前仍需核对活动依据。'}\n结果为情景模拟，尚未生成或确认业务版本。`;
  m.label='查看左侧预测结果';changed=true;
 }
 return changed;
}
