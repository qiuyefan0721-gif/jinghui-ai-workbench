// Explicit prototype examples, independent of the historical-review snapshot.
// Existing edits and archived records always take precedence over seed content.
export function seedDemoExperiences(state){
 if(!state||typeof state!=='object')return false;
 state.experiences??=[];
 const examples=[
  {
   id:'DEMO-E001',
   title:'促销增幅与活动依据核对',
   scope:'华东 · A商品 · 上海仓、杭州仓',
   event:'2026年8月促销计划核对（模拟案例）',
   judgment:'对促销增幅先核对活动渠道、覆盖与力度，再决定是否调整预测。',
   observation:'模拟案例中，计划员对比7%—9%的演示参考区间与本次促销假设，并记录活动信息的差异。该区间只是用于演示核对过程，不代表最佳增幅或本次预测结论。',
   conditions:'商品、区域与仓库一致，且活动渠道、覆盖、力度和持续时间具有可比性时，可参考此核对方法。',
   limits:'全部内容为模拟案例，没有真实业务效果验证。7%—9%不是推荐增幅、最优区间或预测准确性的保证；不可直接套用为当前方案。',
   evidence:'产品交互演示编写的模拟材料；不对应真实活动记录或外部证据。',
   sourceKey:'demo-experience:promotion-check:2026-08',
   sourceLabel:'模拟案例来源 · 2026年8月促销计划核对 · 非真实复盘',
   warehouse:'all',days:30,created:'2026-08-31 09:00',updated:'2026-08-31 09:00'
  },
  {
   id:'DEMO-E002',
   title:'上海与杭州的分仓需求核查',
   scope:'华东 · A商品 · 上海仓、杭州仓',
   event:'2026年9月分仓需求核查（模拟案例）',
   judgment:'两仓汇总趋势相近时，仍分别检查上海仓与杭州仓的渠道、订单和活动覆盖。',
   observation:'模拟案例用于展示分仓核查步骤：分别查看上海仓与杭州仓的逐日需求，再核对是否存在订单集中、活动覆盖或履约节奏差异。汇总结果不能替代每个仓库的检查。',
   conditions:'具有可追溯的仓库明细与统一时间口径，并能核实各仓的渠道、活动和订单信息时，参考本案例安排检查。',
   limits:'全部内容为模拟案例，不证明当前上海仓或杭州仓已经出现异常。示例拆分比例不代表真实仓库结构；缺少分仓数据时不能据此计算调拨或调整需求。',
   evidence:'产品交互演示编写的模拟材料；仓库名称仅用于说明检查范围。',
   sourceKey:'demo-experience:warehouse-check:2026-09',
   sourceLabel:'模拟案例来源 · 2026年9月分仓需求核查 · 非真实复盘',
   warehouse:'all',days:30,created:'2026-09-29 09:00',updated:'2026-09-29 09:00'
  }
 ];
 let changed=false;
 for(const example of examples){
  if(state.experiences.some(e=>e.id===example.id))continue;
  state.experiences.push({...example,revision:1,status:'active',history:[],stage:state.stage,demo:true});
  changed=true;
 }
 return changed;
}
