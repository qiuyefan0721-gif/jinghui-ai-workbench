import {state,task,version,automation,automationRules,fmt} from './core.js';

const suggestion=(text,prompt,icon='sparkles')=>({text,prompt,icon});
const activeTasks=()=>state.tasks.filter(t=>!t.archived);
const scopeLabel=t=>[t?.region,t?.product,t?.warehouses?.join('、')].filter(Boolean).join(' · ');
const selectedTask=()=>task(state.taskId);
const forecastLabel=()=>({result:'预测结果',diagnosis:'预测诊断',versions:'版本记录'}[state.tab]||'预测结果');
const reviewLabel=()=>state.reviewUI?.tab==='experience'?'参考经验':state.reviewUI?.view==='detail'?'复盘详情':'预测复盘';
const selectedAutomation=()=>automation(state.automationId)||state.automations?.[0];
function taskGroups(){
  const all=activeTasks();
  const open=all.filter(t=>t.candidate&&t.diagnosis?.version===t.candidate&&t.diagnosis.status==='open');
  const waiting=all.filter(t=>t.candidate&&t.diagnosis?.version===t.candidate&&['waiting','snoozed'].includes(t.diagnosis.status));
  const ready=all.filter(t=>t.status==='success'&&t.candidate&&(!t.diagnosis||t.diagnosis.version!==t.candidate||!['open','waiting','snoozed'].includes(t.diagnosis.status)));
  return {all,open,waiting,ready,running:all.filter(t=>t.status==='running'),failed:all.filter(t=>t.status==='failed')};
}
function taskBrief(){
  const g=taskGroups();
  return `当前有${g.open.length}项诊断需要核对、${g.ready.length}项候选等待确认、${g.waiting.length}项等待补充信息。${g.running.length?`另有${g.running.length}项预测正在计算。`:''}${g.failed.length?`${g.failed.length}项计算失败，可查看原因后重试。`:''}`;
}
export function assistantContext(){
  const route=state.route||'home',t=selectedTask(),a=selectedAutomation(),stage=state.stage||'plan';
  let key=[stage,route],title='',intro='',placeholder='告诉我你想了解当前页面的什么',suggestions=[];
  if(route==='home'){
    title='我的工作台';intro=state.settings?.configured?`我会围绕你的待办和工作范围提供帮助。${taskBrief()}`:'先配置负责的商品、仓库和工作偏好，也可以直接发起一次预测。';
    placeholder='例如：今天哪些事项需要我处理？';
    suggestions=[suggestion('梳理今日待办','今天哪些事项需要我处理？','checkCircle'),suggestion('发起一次预测','我要新建一次预测','plus'),suggestion('调整工作设置','调整我的工作设置','settings')];
  }else if(route==='tasks'){
    title='预测任务';intro=`可以帮你梳理处理顺序和任务状态。${taskBrief()}`;placeholder='例如：任务列表里应该先处理什么？';
    suggestions=[suggestion('确定处理顺序','任务列表里应该先处理什么？','layers'),suggestion('说明任务状态','解释预测任务的不同状态','info'),suggestion('新建预测','我要新建一次预测','plus')];
  }else if(route==='new'){
    title='新建预测';intro='先明确商品、仓库和预测日期。我可以说明当前演示支持的范围，并提供可填写的业务描述。';placeholder='例如：当前能计算哪些范围？';
    suggestions=[suggestion('查看可计算范围','当前能计算哪些预测范围？','box'),suggestion('给我填写示例','给我一个新建预测的填写示例','edit'),suggestion('草稿与计算的区别','保存预测草稿和开始计算有什么区别？','info')];
  }else if(route==='forecast'){
    key.push(state.taskId||'',state.tab||'result',t?.viewed||'');title=t?`${t.name} · ${forecastLabel()}`:forecastLabel();
    if(state.tab==='diagnosis'){
      intro=t?.diagnosis?`当前诊断绑定${t.diagnosis.version}。我可以帮你核对已补充的信息、仍缺少的依据，以及下一步的检查顺序。`:'可以说明预测诊断检查什么；计算完成后再查看该预测的诊断。';
      placeholder='例如：当前诊断还缺哪些依据？';suggestions=[suggestion('检查缺少的依据','当前诊断还缺哪些依据？','file'),suggestion('诊断后怎么处理','当前预测诊断下一步怎么处理？','checkCircle'),suggestion('比较调整方案','比较8%和10%两个方案','layers')];
    }else if(state.tab==='versions'){
      intro=`这里保留当前预测的版本记录。${t?`当前查看${t.viewed||'暂无'}，已确认${t.confirmed||'暂无'}，待确认${t.candidate||'暂无'}。`:''}可以帮你检查确认前需要核实的内容。`;
      placeholder='例如：确认版本前需要检查什么？';suggestions=[suggestion('确认前检查','确认版本前需要检查什么？','shield'),suggestion('区分版本状态','查看版本、生成草稿和确认版本有什么区别？','layers'),suggestion('解释当前差异','解释当前预测的变化','chart')];
    }else{
      const v=t&&version(t);intro=v?`当前查看${v.id}，全期预测${fmt(v.total)}件。可以解释与基线的差异，或配置并运行促销情景。`:'当前预测尚无可查看的计算结果。可以先了解计算状态与后续处理。';
      placeholder='例如：解释当前预测的变化';suggestions=[suggestion('解释预测变化','解释当前预测的变化','chart'),suggestion('比较8%与10%','比较8%和10%两个方案','layers'),suggestion('确认前检查','确认版本前需要检查什么？','shield')];
    }
  }else if(route==='scenarios'){
    key.push(state.taskId||'');title=t?`${t.name} · 情景模拟`:'情景模拟';intro='你可以用业务语言指定一至两个促销增幅，我会配置左侧方案并运行模拟。计算结果用于比较，生成草稿和确认版本仍需分别操作。';
    placeholder='例如：比较8%和10%两个方案并运行';suggestions=[suggestion('比较8%与10%','比较8%和10%两个方案并运行','layers'),suggestion('比较7%与9%','比较7%和9%两个方案并运行','chart'),suggestion('查看后续步骤','情景计算完成后怎么生成草稿和确认？','checkCircle')];
  }else if(route==='review'){
    key.push(state.reviewUI?.tab||'history',state.reviewUI?.view||'list',state.reviewUI?.warehouse||'all');title=`复盘与经验 · ${reviewLabel()}`;
    intro=state.stage==='review'?'我会围绕当前历史快照、销量回流范围和已保存经验提供查看指引。复盘观察需要结合适用条件理解。':'当前计划演示的预测周期尚未结束，可通过页面按钮切换到独立的历史复盘演示。';
    placeholder='例如：当前复盘应该怎么看？';suggestions=state.reviewUI?.tab==='experience'?[suggestion('查看已保存经验','当前有哪些已保存的参考经验？','file'),suggestion('经验如何使用','参考经验会自动影响下一次预测吗？','info'),suggestion('回看复盘步骤','当前复盘应该怎么看？','chart')]:[suggestion('了解复盘步骤','当前复盘应该怎么看？','chart'),suggestion('检查销量覆盖','复盘销量回流完整吗？','shield'),suggestion('查看参考经验','当前有哪些已保存的参考经验？','file')];
  }else if(route==='automation'){
    key.push(state.opsUI?.automationTab||'tasks',a?.id||'');title=state.opsUI?.automationTab==='rules'?'我的托管 · 业务规则':a?`我的托管 · ${a.name}`:'我的托管';
    intro=state.opsUI?.automationTab==='rules'?'规则用于定义提醒条件。可以说明草稿、试运行与启用的区别，以及规则如何关联持续任务。':a?`当前选择「${a.name}」，范围为${scopeLabel(a)}。可以查看配置、运行状态，或新建另一项持续任务。`:'还没有持续任务。可以新建任务，并独立设置范围、执行时间和所用规则。';
    placeholder=state.opsUI?.automationTab==='rules'?'例如：业务规则怎样关联持续任务？':'例如：当前托管任务检查什么？';
    suggestions=state.opsUI?.automationTab==='rules'?[suggestion('了解规则生效流程','业务规则怎样关联持续任务？','shield'),suggestion('规则草稿与启用','规则草稿、试运行和启用有什么区别？','file'),suggestion('新增持续任务','我要新增一个持续任务','plus')]:[suggestion('解释当前任务','当前托管任务检查什么？','info'),suggestion('修改当前配置','修改当前持续任务配置','settings'),suggestion('新增持续任务','我要新增一个持续任务','plus')];
  }else{
    title='当前工作空间';intro='我可以帮助你梳理预测待办、工作设置和持续任务。';suggestions=[suggestion('查看工作待办','今天哪些事项需要我处理？','checkCircle')];
  }
  return {key:key.join(':'),title,intro,placeholder,suggestions,autoOpen:true};
}

function diagnosisAnswer(t){
  if(!t)return {text:'请先从任务列表选择一项预测，再检查该任务的诊断。'};
  if(t.status!=='success')return {text:`该预测${({running:'正在计算',failed:'计算失败',draft:'尚未开始计算',cancelled:'已取消计算'})[t.status]||'暂不可用'}。${t.error||'计算完成后，再检查预测结果与诊断依据。'}`};
  const d=t.diagnosis;
  if(!d)return {text:'当前没有可读取的诊断记录，请返回预测结果检查计算状态。'};
  const missing=[!d.evidence?'活动说明或数据核对信息':null,!d.source?'信息来源':null,!d.reason?'采用说明或风险接受理由':null].filter(Boolean);
  return {text:`当前诊断绑定${d.version}，状态为${({open:'需要核对',waiting:'等待补充证据',snoozed:'等待提醒',resolved:'已核对',accepted:'已记录风险接受',replaced:'已被新版替代'})[d.status]||d.status}。${missing.length?`记录中尚缺：${missing.join('、')}。`:'说明、来源和处理理由均已记录，可以结合实际业务核验。'}${['resolved','accepted','replaced'].includes(d.status)?'已有处理记录会保留；补充信息不会自动改动已确认版本。':'可在左侧“补充活动信息”中填写说明与来源，再重新核对；暂时无法补齐时，可设置等待提醒。'}最终确认采用版本仍需由你操作。`};
}
function confirmationAnswer(t){
  if(!t)return {text:'请先选择一项预测，再检查它的版本记录。'};
  const candidate=version(t,t.candidate);
  if(!candidate)return {text:`当前没有待确认候选，已确认版本为${t.confirmed||'暂无'}。可以查看历史记录；需要新的假设时，先完成情景计算并生成预测草稿。`};
  return {text:`本任务待确认${candidate.id}，全期${fmt(candidate.total)}件；已确认版本为${t.confirmed||'暂无'}。先核对商品、仓库、日期和逐日差异，再填写活动说明、信息来源与确认理由。${Number(candidate.rate||0)>9?'该候选促销增幅超过9%的演示参考上限，需要明确接受剩余风险。':'数值未超参考上限，也需要核对活动依据。'}点击左侧“对比并确认”完成核验后再确认，当前助手回复不会替你采用版本。`};
}
export function contextualAnswer(text){
  const q=String(text||'').trim(),route=state.route,t=selectedTask(),a=selectedAutomation();
  if(!q)return null;
  if(/新建一次预测|发起一次预测/.test(q))return {text:'可以在右侧助手的小卡片填写任务名称、商品、仓库和日期。左侧保持当前页面，检查后保存草稿或开始计算。',action:'new',label:'新建预测'};
  if(/调整我的工作设置/.test(q))return {text:'工作设置可以调整职责范围、页面偏好和默认计划。持续任务各自保存独立配置；要修改某项托管，请进入对应任务的编辑配置。',action:'settings',label:'打开工作设置'};
  if(/今天.*(事项|处理)|今日待办/.test(q)){
    const g=taskGroups(),examples=[...g.open,...g.ready].slice(0,3).map(x=>`${x.name}（${x.candidate}）`);
    return {text:`${taskBrief()}${examples.length?`可先查看：${examples.join('；')}。`:'当前没有需要立即核对或确认的候选。'}等待中的事项可在“等待中”查看提醒时间，完成核对后再决定采用版本。`};
  }
  if(route==='tasks'&&/先处理|处理顺序|优先/.test(q))return {text:`${taskBrief()}建议先查看计算失败原因，再核对已生成候选的诊断依据；证据齐全后确认版本。正在计算的任务等待结果，等待证据的任务按提醒跟进。这个顺序用于人工检查，不会自动调整任务或确认版本。`};
  if(route==='tasks'&&/不同状态|任务状态/.test(q))return {text:'创建草稿：条件已保存，尚未计算；计算中：正在生成结果；待调整：诊断仍需核对或等待依据；待确认：候选已准备好，需要业务确认；已确认：已有采用版本。计算失败可查看原因后重试，已归档任务保留历史。'};
  if(route==='new'&&/范围|填写示例|输入示例|草稿|开始计算/.test(q)){
    if(/区别/.test(q))return {text:'保存草稿只保留填写条件，不生成预测结果。开始计算会先校验当前演示是否有对应数据，再生成独立V0基线与预测诊断；结果生成后仍需业务核对确认。'};
    return {text:'当前演示可计算范围为：华东、A商品、上海仓和杭州仓、2026年10月1日至10月30日。填写示例：“为A商品生成华东上海仓和杭州仓2026年10月1日至10月30日的需求预测，任务名称为10月需求预测”。请在右侧新建预测卡片核对填写的条件后再开始计算；其他范围可以保存草稿。'};
  }
  if(route==='forecast'&&state.tab==='diagnosis'&&/依据|缺|诊断|下一步/.test(q))return diagnosisAnswer(t);
  if(route==='forecast'&&/确认版本前|确认前.*检查/.test(q))return confirmationAnswer(t);
  if(route==='forecast'&&/查看版本.*生成草稿|版本.*区别/.test(q))return {text:'查看版本只切换展示对象；生成草稿创建新的候选与诊断，保留历史版本；确认版本需要核验说明、来源和理由，之后才更新该任务的业务采用版本。三项操作独立进行。'};
  if(route==='forecast'&&!version(t)&&/解释.*预测|预测.*变化/.test(q))return diagnosisAnswer(t);
  if(route==='scenarios'&&/完成后|生成草稿和确认/.test(q))return {text:'先等待指定方案显示计算完成，再查看总量与趋势差异。选定方案后点击“生成预测草稿”，填写说明；之后进入版本记录对比，补充活动依据并确认。已生成的历史草稿会保留，修改参数需要重新计算。'};
  if(route==='review'&&/复盘|销量回流|参考经验|下一次预测/.test(q)){
    const u=state.reviewUI||{};
    if(state.stage!=='review')return {text:'当前计划演示日期为2026年9月30日，10月预测周期尚未结束。左侧可切换到独立的2026年11月2日历史复盘演示，查看只读历史快照；它不是当前计划操作的真实未来结果。'};
    if(/自动影响|下一次预测/.test(q))return {text:'保存参考经验只记录观察、来源和适用条件，不会自动训练模型或改变下一次预测。需要长期提醒时，可另建业务规则草稿，经试运行并明确启用后，再关联持续任务。',action:'rules',label:'查看业务规则'};
    if(/已保存|参考经验/.test(q)){
      const es=(state.experiences||[]).filter(e=>e.status!=='archived');
      return {text:es.length?`当前有${es.length}条未归档参考经验：${es.slice(0,3).map(e=>`${e.title}（R${e.revision||1}）`).join('；')}。可在“参考经验”页签查看来源、适用范围和限制；保存记录不会自动调整预测。`:'当前没有未归档的参考经验。完成历史复盘后，可以点击“整理参考经验”，补充观察、适用条件和限制后保存。'};
    }
    if(/完整|回流|覆盖/.test(q))return {text:`当前复盘设置为${u.days??30}/30日销量回流，仓库范围为${({shanghai:'上海仓',hangzhou:'杭州仓'})[u.warehouse]||'上海仓、杭州仓'}。${(u.days??30)<30?'只比较已回流的共同日期，缺失日期不补成0。':'完整周期为10月1日至10月30日。'}可在复盘详情点击数据覆盖按钮检查范围。观测销量可能受缺货等因素影响，不能直接当作潜在需求。`};
    return {text:`当前历史分析状态为${({idle:'待复盘',running:'分析中',done:'已复盘',failed:'分析失败'})[u.status||'idle']||'待复盘'}。${u.status==='done'?'打开复盘详情，先检查销量覆盖范围，再对比总量偏差与逐日偏差；图表可按仓库查看。':u.status==='running'?'请等待本次分析完成，再查看结果。':u.status==='failed'?'可点击重试分析，完成后查看历史结果。':'点击左侧“开始复盘”，完成分析后查看详情。'}总量接近不代表逐日预测同样准确，关联调整记录也不能直接证明因果贡献。`};
  }
  if(route==='automation'&&/新增.*(?:持续|托管)任务|新建.*(?:托管|持续)|配置.*多个/.test(q))return {text:'可以新增独立持续任务，分别填写名称、业务范围、执行计划和所用规则。保存后它会作为新的任务卡片出现，现有任务的配置与历史记录会保留。',action:'automation-config',label:'新增持续任务'};
  if(route==='automation'&&/修改.*(配置|任务)|编辑.*配置/.test(q))return a?{text:`将编辑「${a.name}」的配置。新范围、频率与规则应用于后续运行，已保存运行记录保留当时的快照。`,action:'automation-edit',label:'编辑当前任务'}:{text:'当前尚无持续任务，先创建任务再设置检查范围。',action:'automation-config',label:'新增持续任务'};
  if(route==='automation'&&/规则|关联/.test(q))return {text:`业务规则先保存为草稿，试运行用于核对条件，明确启用后才可参与检查。持续任务需要选择对应的已启用规则；暂停的规则不会参与后续运行。${a?`当前「${a.name}」选中了${a.ruleIds?.length||0}条规则，其中${automationRules(a).length}条已启用。`:''}规则没有独立定时器，原型中的计划与运行使用本地演示状态。`,action:'rules',label:'查看业务规则'};
  if(route==='automation'&&/当前.*任务|检查什么|托管.*(做|状态)|运行状态/.test(q)){
    if(!a)return {text:'当前尚无持续任务，可以新增任务并选择检查范围与规则。',action:'automation-config',label:'新增持续任务'};
    const latest=a.runs?.[0],freq=a.frequency==='manual'?'仅手动运行':`${a.frequency==='weekly'?'每周一':'每日'} ${a.time||'08:30'}`;
    return {text:`「${a.name}」检查${scopeLabel(a)}范围内的已有成功预测，采用${automationRules(a).length}条已启用且已选中的规则。计划为${freq}，任务${a.enabled?'已启用':'已暂停'}。${a.running?'本次检查正在运行。':latest?`最近记录：${latest.summary||latest.status}。`:'尚无运行记录。'}它用于检查并关联诊断提醒，不会自动确认预测或生成订单。计划与执行当前为本地原型演示。`};
  }
  return null;
}
