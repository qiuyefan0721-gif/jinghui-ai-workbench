import {state,esc,icon} from './core.js';
const defaults={layout:'tasks',split:true,warehouse:'all',grain:'day',compact:true,exceptionsOnly:true,showTrend:true,showTasks:true,showAutomation:true};
const names={tasks:'待办优先',analysis:'趋势优先',automation:'托管优先'};
const model=()=>state.workbenchPersonalization??={saved:null,draft:null,invited:false};
export const personalConfig=()=>state.workbenchPersonalization?.draft||state.workbenchPersonalization?.saved||null;
export function workbenchIntent(text){
 if(state.route!=='home')return null;
 const s=state.workbenchPersonalization,editing=!!(s?.draft||s?.invited||s?.saved);
 const explicit=/工作台|首页|布局|卡片|分仓|两仓.*(?:并排|分开)|(?:上海|杭州)仓.*(?:放|展示)|先看.*(?:预测|待办|需求)|任务.*(?:只显示|只看|收起|展开)/.test(text);
 const follow=editing&&/^(?:就用这个[。！]?|就用这版[。！]?|保存[。！]?|使用这个工作台|换个布局|恢复原样|撤销上一步)$|趋势.*(?:上面|前面|按周|按天)|(?:紧凑|宽松|并排|分开|汇总|日趋势|周趋势|按周|按天|按日)|(?:只看|只显示|重点看).*?(?:上海仓|杭州仓)|待确认.*(?:前面|最上|顶部)|(?:显示|隐藏|保留|加上|不要|不用显示)(?:趋势|待办|AI任务)|(?:成功|失败).*?(?:收起|展开|显示)|(?:全部|所有)任务/.test(text);
 if(!explicit&&!follow)return null;
 if(/(?:修改|设置|调整).*规则|工作设置|参考上限/.test(text))return null;
 const m=model();
 if(/^(?:就用这个[。！]?|就用这版[。！]?|保存[。！]?|使用这个工作台)$/.test(text)){
  if(!m.draft)return '当前没有待采用的新布局。描述你的工作习惯，我会先在左侧生成预览。';
  m.saved=structuredClone(m.draft);m.draft=null;m.invited=false;m.previous=null;return '已保存为你的工作台。下次打开会继续使用这份布局；以后想调整，直接告诉我。';
 }
 if(/^(?:恢复原样|撤销上一步)$/.test(text)){if(text==='撤销上一步'&&m.previous){m.draft=m.previous;m.previous=null;return '已撤销上一步，左侧恢复上一版预览。';}m.draft=null;m.previous=null;m.invited=false;return m.saved?'已恢复到你上次保存的工作台。':'已恢复默认工作台。';}
 if(/库存|缺货|补货|其他商品|华南|北京/.test(text))return '当前演示支持已有预测、待办、两仓趋势和托管状态的工作台组合。你提到的数据尚未接入，左侧保持原样。';
 if(/(?:每天|每日).*\d.*(?:跑|运行|执行)|(?:启用|暂停|删除).*任务/.test(text))return '运行时间和任务启停请在“我的托管”中配置。这里可以调整任务状态在首页的展示方式。';
 const intentOnly=/^(?:帮我)?(?:定制|生成|调整|搭建)(?:一下)?(?:我的|自己(?:的)?)?工作台[。！]?$/;
 if(intentOnly.test(text)){m.invited=true;return '告诉我每天先看什么、重点关注哪个仓库，以及任务情况怎么展示。你也可以点击下面的示例，直接生成一版。';}
 const next={...defaults,...(m.draft||m.saved||{})};let changed=false;
 if(text==='换个布局'){next.layout=['tasks','analysis','automation'][(['tasks','analysis','automation'].indexOf(next.layout)+1)%3];changed=true;}
 if(/先看[^，。！？,；;]*(?:待确认|待办)|待办优先|待确认.*(?:最上|前面|顶部)/.test(text)){next.layout='tasks';next.showTasks=true;changed=true;}
 if(/趋势.*(?:上面|最上|前面|顶部)|先看[^，。！？,；;]*(?:趋势|需求变化)|分析优先/.test(text)){next.layout='analysis';next.showTrend=true;changed=true;}
 if(/(?:主要|先看)[^，。！？,；;]*AI[^，。！？,；;]*任务|托管优先|任务.*(?:最上|顶部)/i.test(text)){next.layout='automation';next.showAutomation=true;changed=true;}
 if(/并排|分仓|两.*仓.*(?:分开|趋势)|上海仓和杭州仓|上海.*杭州/.test(text)){next.split=true;next.warehouse='all';next.showTrend=true;changed=true;}
 if(/(?:只看|只显示|重点看).*上海仓/.test(text)){next.warehouse='上海仓';next.split=false;changed=true;}
 if(/(?:只看|只显示|重点看).*杭州仓/.test(text)){next.warehouse='杭州仓';next.split=false;changed=true;}
 if(/汇总|合并.*(?:仓|趋势)/.test(text)){next.split=false;next.warehouse='all';changed=true;}
 if(/按周|周趋势/.test(text)){next.grain='week';changed=true;}
 if(/按天|按日|日趋势/.test(text)){next.grain='day';changed=true;}
 if(/紧凑|小一点|一屏/.test(text)){next.compact=true;changed=true;}
 if(/宽松|大一点/.test(text)){next.compact=false;changed=true;}
 if(/(?:只.*(?:异常|失败)|成功.*收起|失败.*展开)/.test(text)){next.exceptionsOnly=true;changed=true;}
 if(/全部任务|所有任务|成功.*(?:也|展开|显示)/.test(text)){next.exceptionsOnly=false;next.showAutomation=true;changed=true;}
 for(const [word,key] of [['趋势','showTrend'],['待办','showTasks'],['AI任务','showAutomation']]){if(new RegExp('(?:隐藏|不要|不用显示)'+word).test(text)){next[key]=false;changed=true;}if(new RegExp('(?:显示|加上|保留)'+word).test(text)&&!new RegExp('(?:不显示|不用显示)'+word).test(text)){next[key]=true;changed=true;}}
 if(!changed)return '可以告诉我“待办放最上面”“两仓并排、按周展示”“成功任务收起”或“整体紧凑一点”。这次没有改变布局。';
 if(!next.showTrend&&!next.showTasks&&!next.showAutomation)return '至少保留一个工作模块。当前布局保持原样，你可以保留待办、趋势或任务情况。';
 m.previous=m.draft?structuredClone(m.draft):null;m.draft=next;m.invited=true;
 return `已生成${names[next.layout]}的工作台预览。${next.showTrend?`趋势按${next.grain==='week'?'周':'日'}展示，${next.split?'上海仓和杭州仓并排':next.warehouse==='all'?'两仓汇总':next.warehouse+'单独展示'}。`:''}${next.showAutomation?(next.exceptionsOnly?'AI任务仅展开异常，正常情况收成摘要。':'AI任务展示全部运行情况。'):''}你可以继续调整，或点击“使用这个工作台”。`;
}
export function renderWorkbenchControls(){
 if(state.route!=='home')return '';
 const m=state.workbenchPersonalization;
 if(m?.draft)return `<div class="wb-chat-controls"><span class="tiny muted">新布局已在左侧预览</span><button class="btn primary" data-workbench-command="使用这个工作台">${icon('check',14)} 使用这个工作台</button><div class="row"><button class="btn small" data-workbench-command="换个布局">换个布局</button><button class="btn small" data-workbench-command="恢复原样">恢复原样</button></div><div class="wb-chat-suggestions"><button data-workbench-command="趋势放在最上面">趋势放上面</button><button data-workbench-command="两仓并排，按周展示">两仓按周展示</button><button data-workbench-command="显示全部任务">显示全部任务</button></div></div>`;
 if(m?.invited)return `<div class="wb-chat-controls"><span class="tiny muted">试着这样描述你的工作习惯</span><button class="wb-example" data-workbench-command="我每天先看待确认预测，再看上海仓和杭州仓的需求变化。AI任务只显示执行异常的，整体紧凑一点。">我每天先看待确认预测，再看两仓需求变化。AI任务只显示异常，整体紧凑一点。 ${icon('arrow',14)}</button></div>`;
 return '';
}
export function workbenchPreviewBar(){return state.workbenchPersonalization?.draft?'<div class="wb-preview-bar"><span><strong>新布局预览</strong> · 在右侧继续聊，满意后直接采用</span><button class="text-button" data-workbench-command="恢复原样">恢复原样</button></div>':'';}
