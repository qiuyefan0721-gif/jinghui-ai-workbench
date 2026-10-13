// Keep variable-height workbench cards packed without stretching their content.
let observer,frame=0;
export function arrangeWorkbench(){
 observer?.disconnect();cancelAnimationFrame(frame);
 const grid=document.querySelector('.personal-modules');if(!grid)return;
 const cards=[...grid.children];
 function place(){
  if(!grid.isConnected)return;
  const styles=getComputedStyle(grid),columns=styles.gridTemplateColumns.split(' ').map(parseFloat).filter(Number.isFinite),gap=parseFloat(styles.columnGap)||18;
  if(!columns.length||!grid.clientWidth)return;
  const heights=columns.map(()=>0),lefts=columns.map((_,i)=>columns.slice(0,i).reduce((s,w)=>s+w+gap,0));
  for(const card of cards){
   const full=columns.length===1||getComputedStyle(card).gridColumnEnd==='-1';
   const col=full?0:heights.indexOf(Math.min(...heights)),top=full?Math.max(...heights):heights[col];
   const width=full?grid.clientWidth:columns[col];
   card.style.width=width+'px';card.style.left=lefts[col]+'px';card.style.top=top+'px';
   const bottom=top+card.offsetHeight+gap;
   if(full)heights.fill(bottom);else heights[col]=bottom;
  }
  grid.style.height=Math.max(0,...heights.map(h=>h-gap))+'px';
 }
 grid.classList.add('wb-packed');place();
 observer=new ResizeObserver(()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(place);});
 observer.observe(grid);cards.forEach(c=>observer.observe(c));
}
