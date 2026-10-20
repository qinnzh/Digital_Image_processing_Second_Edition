/* 像素之间 / 可完全离线运行的课程交互逻辑。无CDN、无外部接口。 */
"use strict";
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));
const clamp = (v,lo,hi) => Math.min(hi,Math.max(lo,v));
const fmt = (v,d=2) => Number(v).toFixed(d).replace(/\.?0+$/,"");
const ns="http://www.w3.org/2000/svg";
function storeGet(k,def){try{return localStorage.getItem(k)??def}catch{return def}}
function storeSet(k,v){try{localStorage.setItem(k,String(v))}catch{}}

function setupNavigation(){
 const dark=storeGet("pixel-theme","light")==="dark";
 document.body.classList.toggle("dark",dark);
 const theme=$("#themeBtn");
 theme.textContent=dark?"☾":"☼";
 theme.onclick=()=>{const v=!document.body.classList.contains("dark");document.body.classList.toggle("dark",v);theme.textContent=v?"☾":"☼";storeSet("pixel-theme",v?"dark":"light")};
 const menu=$("#menuBtn"), side=$("#sidebar"),back=$("#mobileBackdrop");
 const close=()=>{side.classList.remove("open");back.classList.remove("active");menu.setAttribute("aria-expanded","false")};
 menu.onclick=()=>{const state=!side.classList.contains("open");side.classList.toggle("open",state);back.classList.toggle("active",state);menu.setAttribute("aria-expanded",String(state))};
 back.onclick=close; $$(".toc a").forEach(a=>a.onclick=close);
 const star=$("#starToggle");star.checked=storeGet("pixel-stars","1")==="1";
 const syncStars=()=>{document.body.classList.toggle("hide-stars",!star.checked);storeSet("pixel-stars",star.checked?"1":"0")};
 star.onchange=syncStars;syncStars();
 $("#printBtn").onclick=()=>window.print();
 const checks=$$("[data-done]");
 checks.forEach(ch=>{ch.checked=storeGet("pixel-done-"+ch.dataset.done,"0")==="1";
 ch.onchange=()=>{storeSet("pixel-done-"+ch.dataset.done,ch.checked?"1":"0");setDone()}});
 function setDone(){const done=checks.filter(i=>i.checked).length;$("#progressText").textContent=done+" / 7";$("#chapterBar").style.width=(100*done/checks.length)+"%"}
 setDone();
 const progress=()=>{const available=document.documentElement.scrollHeight-window.innerHeight;$("#scroll-progress").style.width=(available>0?Math.max(0,window.scrollY/available)*100:0)+"%"};
 window.addEventListener("scroll",progress,{passive:true});progress();
 const anchors=$$(".toc a").filter(a=>a.hash), targets=anchors.map(a=>$(a.hash)).filter(Boolean);
 if("IntersectionObserver" in window){
  const obs=new IntersectionObserver(entries=>{entries.forEach(e=>{if(!e.isIntersecting)return;let a=anchors.find(x=>x.hash==="#"+e.target.id);if(a){anchors.forEach(x=>x.classList.remove("active"));a.classList.add("active")}})},{rootMargin:"-110px 0px -68% 0px"});
  targets.forEach(t=>obs.observe(t))
 }
 const search=$("#search"),results=$("#searchResults");
 const headings=$$(".chapter h2,.chapter h3,.lab h3").map((el,i)=>{
  if(!el.id)el.id="heading-"+i;
  return {el,text:el.textContent.replace(/\s+/g," ").trim(),parent:el.closest(".chapter")?.querySelector("h2")?.textContent||""};
 });
 search.oninput=()=>{
  const q=search.value.trim().toLowerCase();
  if(!q){results.hidden=true;results.innerHTML="";return}
  const hits=headings.filter(h=>(h.text+" "+h.parent).toLowerCase().includes(q)).slice(0,9);
  results.innerHTML=hits.length?hits.map(h=>`<a href="#${h.el.id}">${escapeHtml(h.text)}</a>`).join(""):'<p>未找到章节标题；试试“直方图”“拉普拉斯”“噪声”</p>';
  results.hidden=false; results.querySelectorAll("a").forEach(a=>a.onclick=()=>{results.hidden=true;search.blur();close()})
 };
 document.addEventListener("keydown",e=>{if(e.key==="Escape"){close();results.hidden=true}});
}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}

function makeBarChart(id,values,color){
 const svg=$(id), max=Math.max(1,...values),w=390,h=220,left=42,bottom=181, top=16,plot=bottom-top;
 let html=`<line x1="${left}" y1="${top}" x2="${left}" y2="${bottom}" stroke="#92a39f"/><line x1="${left}" y1="${bottom}" x2="378" y2="${bottom}" stroke="#92a39f"/>`;
 for(let t=0;t<=4;t++){let v=max*t/4, y=bottom-v/max*plot;html+=`<line x1="${left}" y1="${y}" x2="378" y2="${y}" stroke="#c9d4cb" stroke-dasharray="3 4" opacity=".65"/><text x="${left-7}" y="${y+4}" text-anchor="end" font-size="11">${Math.round(v)}</text>`}
 values.forEach((n,i)=>{const bw=29,x=52+i*40,y=bottom-n/max*plot,barh=Math.max(0,n/max*plot);
 html+=`<rect x="${x}" y="${y}" width="${bw}" height="${barh}" rx="3" fill="${color}" opacity=".9"><title>Gray ${i}: ${n}</title></rect><text x="${x+bw/2}" y="198" text-anchor="middle" font-size="11">${i}</text>`});
 html+='<text x="210" y="216" text-anchor="middle" font-size="11">Gray Level</text><text x="13" y="110" transform="rotate(-90 13 110)" text-anchor="middle" font-size="11">Pixel Count</text>';
 svg.innerHTML=html;
}
const histDefault=[790,1023,850,656,329,245,122,81];
function updateHist(){
 const input=$("#histInput").value.split(/[,，\s]+/).filter(Boolean).map(Number);
 const err=$("#histError");
 if(input.length!==8||input.some(v=>!Number.isSafeInteger(v)||v<0)||input.reduce((a,b)=>a+b,0)<=0){
  err.textContent="请输入恰好8个非负整数，且至少一个频数大于0。";return}
 err.textContent="";
 const n=input.reduce((a,b)=>a+b,0); let cdf=0;const out=Array(8).fill(0);
 const rows=input.map((count,k)=>{const p=count/n;cdf+=p;
  const target=clamp(Math.round(7*cdf),0,7);out[target]+=count;return {k,count,p,cdf,target}});
 makeBarChart("#histBefore",input,"#bc8b5d");makeBarChart("#histAfter",out,"#178e7a");
 $("#histTable tbody").innerHTML=rows.map(r=>`<tr><td>${r.k}</td><td>${r.count}</td><td>${r.p.toFixed(4)}</td><td>${r.cdf.toFixed(4)}</td><td><b>${r.target}</b></td></tr>`).join("");
 $("#histSummary").textContent="总像素："+n+" ｜ 映射："+rows.map(r=>r.k+"→"+r.target).join("，")+" ｜ 输出频数："+out.join("、")+"。";
}
function setupHistogram(){
 $("#calcHist").onclick=updateHist;
 $("#histInput").onkeydown=e=>{if(e.key==="Enter")updateHist()};
 $("#resetHist").onclick=()=>{$("#histInput").value=histDefault.join(",");updateHist()};
 updateHist();
}
function setupGamma(){
 const slider=$("#gammaSlider"),path=$("#gammaCurve"),point=$("#gammaPoint");
 const xmap=r=>46+r*399,ymap=s=>231-s*211;
 const update=()=>{
 const gamma=Number(slider.value);
 $("#gammaValue").textContent=gamma.toFixed(1);
 const pts=Array.from({length:121},(_,i)=>{const r=i/120;return `${i?"L":"M"}${xmap(r).toFixed(2)} ${ymap(Math.pow(r,gamma)).toFixed(2)}`}).join(" ");
 path.setAttribute("d",pts);
 point.setAttribute("cx",xmap(.25));point.setAttribute("cy",ymap(Math.pow(.25,gamma)));
 $("#gammaResult").textContent=`输入r=0.25，γ=${gamma.toFixed(1)}时，输出s=0.25^${gamma.toFixed(1)}≈${Math.pow(.25,gamma).toFixed(4)}。在0～1的归一化情况下，${gamma<1?"γ<1通常提亮暗部":gamma>1?"γ>1通常压暗灰度":"γ=1保持原灰度"}`;
 };
 slider.oninput=update;update();
}
const patchPresets={
 ppt:[1,2,2,1,15,1,2,1,2],
 salt:[10,11,9,10,255,11,9,10,10],
 lap:[2,7,3,5,8,1,9,2,8],
 flat:[90,90,90,90,90,90,90,90,90]
};
function setupKernel(){
 const target=$("#kernelInputs");
 target.innerHTML=Array.from({length:9},(_,i)=>`<input aria-label="第${Math.floor(i/3)+1}行第${i%3+1}列灰度" inputmode="numeric" type="number" step="any" data-pixel="${i}">`).join("");
 const inputs=$$("#kernelInputs input");
 const update=()=>{
 const a=inputs.map(x=>Number(x.value));if(a.some(v=>!Number.isFinite(v))){$("#kernelSteps").textContent="请为所有9个像素输入数字。";return}
 const sum=a.reduce((x,y)=>x+y,0),mean=sum/9,median=[...a].sort((x,y)=>x-y)[4];
 const neighbors=a[1]+a[3]+a[5]+a[7], lap=4*a[4]-neighbors,sharp=a[4]+lap;
 $("#meanResult").textContent=fmt(mean,3);$("#medianResult").textContent=fmt(median,3);
 $("#lapResult").textContent=fmt(lap,3);$("#sharpResult").textContent=fmt(sharp,3);
 $("#kernelSteps").textContent=`均值=(${a.join("+")})/9=${fmt(mean,3)}；排序中位数=${fmt(median,3)}；中心+4拉普拉斯响应=4×${a[4]}−(${[a[1],a[3],a[5],a[7]].join("+")})=${fmt(lap,3)}；锐化=中心${a[4]}+响应${fmt(lap,3)}=${fmt(sharp,3)}。显示为8位灰度图时还需按题目指定方法截断/缩放。`;
 };
 const preset=$("#kernelPreset");
 preset.onchange=()=>{const a=patchPresets[preset.value];inputs.forEach((x,i)=>x.value=a[i]);update()};
 inputs.forEach(x=>x.oninput=update);preset.onchange();
}

function setupLowpass(){
 const cutoff=$("#cutoff");const ideal=$("#idealPath"),butter=$("#butterPath"),gauss=$("#gaussPath");
 const mapX=d=>43+d/100*383,mapY=h=>166-h*139;
 const plot=(fn)=>Array.from({length:201},(_,i)=>{const d=i/2;return `${i?"L":"M"}${mapX(d).toFixed(2)} ${mapY(fn(d)).toFixed(2)}`}).join(" ");
 function update(){
  const d0=Number(cutoff.value);$("#cutoffValue").textContent=String(d0);
  ideal.setAttribute("d",`M${mapX(0)} ${mapY(1)} L${mapX(d0)} ${mapY(1)} L${mapX(d0)} ${mapY(0)} L${mapX(100)} ${mapY(0)}`);
  butter.setAttribute("d",plot(d=>1/(1+Math.pow(d/d0,4))));
  gauss.setAttribute("d",plot(d=>Math.exp(-d*d/(2*d0*d0))));
 }
 cutoff.oninput=update;update();
}
function setupNotch(){
 const u=$("#notchU"),v=$("#notchV"),group=$("#notchMarkers");
 function update(){
  let du=Number(u.value),dv=Number(v.value),cx=140,cy=140;
  $("#notchUValue").textContent=du;$("#notchVValue").textContent=dv;
  const p1=[cx+du,cy-dv],p2=[cx-du,cy+dv];
  const mark=(p,n)=>`<circle cx="${p[0]}" cy="${p[1]}" r="13" stroke="#ed9369" stroke-width="1.7" stroke-dasharray="3 3" fill="none"/><circle cx="${p[0]}" cy="${p[1]}" r="5" fill="#ffb784"/><text x="${p[0]+14}" y="${p[1]-10}" font-size="12" fill="#ffffff">${n}</text>`;
  group.innerHTML=(du===0&&dv===0)?"":mark(p1,"A")+mark(p2,"B");
  $("#notchResult").textContent=(du===0&&dv===0)?"请避开直流中心：周期噪声一般在非零频率位置出现对称峰值。":`一侧频率偏移 (+${du}, ${dv})，对称位置 (−${du}, −${dv})。在两处同时设置陷波阻止滤波器；实际要尽量保留其他频率。`;
 }
 u.oninput=update;v.oninput=update;update();
}
const morphSize=7;
const morphPreset=()=>{
 let a=Array.from({length:morphSize},()=>Array(morphSize).fill(0));
 for(let i=2;i<=4;i++)for(let j=2;j<=4;j++)a[i][j]=1;
 a[1][3]=1;a[5][5]=1;return a;
};
function morphTransform(a,shape,op){
 const offsets=shape==="cross"?[[0,0],[-1,0],[1,0],[0,-1],[0,1]]:
  Array.from({length:9},(_,i)=>[Math.floor(i/3)-1,i%3-1]);
 const at=(y,x)=>y>=0&&x>=0&&y<morphSize&&x<morphSize?a[y][x]:0;
 const step=(src,type)=>{
  let r=Array.from({length:morphSize},()=>Array(morphSize).fill(0));
  for(let y=0;y<morphSize;y++)for(let x=0;x<morphSize;x++){
   const get=(dy,dx)=>y+dy>=0&&x+dx>=0&&y+dy<morphSize&&x+dx<morphSize?src[y+dy][x+dx]:0;
   r[y][x]=Number(type==="erode"?offsets.every(([dy,dx])=>get(dy,dx)===1):offsets.some(([dy,dx])=>get(dy,dx)===1));
  }
  return r;
 };
 if(op==="open")return step(step(a,"erode"),"dilate");
 if(op==="close")return step(step(a,"dilate"),"erode");
 return step(a,op);
}
function setupMorphology(){
 let image=morphPreset();
 const source=$("#morphInput"),output=$("#morphOutput");
 function draw(){
  const result=morphTransform(image,$("#morphShape").value,$("#morphOp").value);
  source.innerHTML=image.flatMap((row,i)=>row.map((value,j)=>`<button type="button" class="${value?"on":""}" data-row="${i}" data-col="${j}" aria-pressed="${!!value}" aria-label="第${i+1}行第${j+1}列，当前${value}，点击切换"></button>`)).join("");
  output.innerHTML=result.flatMap(row=>row.map(value=>`<span class="${value?"on":""}" aria-label="${value}"></span>`)).join("");
  source.querySelectorAll("button").forEach(b=>{b.onclick=()=>{const i=Number(b.dataset.row),j=Number(b.dataset.col);image[i][j]^=1;draw()}});
  const before=image.flat().reduce((a,b)=>a+b,0),after=result.flat().reduce((a,b)=>a+b,0);
  const names={dilate:"膨胀",erode:"腐蚀",open:"开操作",close:"闭操作"};
  $("#morphResult").textContent=`${names[$("#morphOp").value]}｜输入前景 ${before} 个像素 → 输出 ${after} 个像素。结构元素：${$("#morphShape").value==="square"?"3×3方形":"3×3十字"}；图像外按0处理。`;
 }
 $("#morphOp").onchange=draw;$("#morphShape").onchange=draw;
 $("#morphReset").onclick=()=>{image=morphPreset();draw()};draw();
}
const quizItems=[
 {q:"8位灰度图中，原灰度40反转后是多少？",options:["40","215","255","200"],a:1,why:"s=255−r=255−40=215。"},
 {q:"空间域灰度变换s=T(r)属于哪种操作？",options:["点处理","仅频率域处理","形态学膨胀","霍夫变换"],a:0,why:"s只依赖当前像素灰度r，是1×1点处理。"},
 {q:"一幅3bit图像，某灰度级的累计概率恰为0.5，均衡化后按通常四舍五入应映射为？",options:["1","2","3","7"],a:2,why:"s=round[(8−1)×0.5]=round(3.5)=4。注意：此题的选项需要包含4，见下方修订。"},
 {q:"图像里有随机孤立的纯白和纯黑像素，通常优先哪种滤波？",options:["理想高通","中值滤波","拉普拉斯","逆滤波"],a:1,why:"椒盐噪声是脉冲噪声，中值滤波更能排除极端值。"},
 {q:"中心20、上下左右均为10，用+4中心拉普拉斯锐化，最终中心像素是多少？",options:["20","40","60","80"],a:2,why:"响应=4×20−40=40；中心正，加回原图：20+40=60。"},
 {q:"中心化256×256频谱中，周期峰值(110,140)的对称点是？",options:["(140,110)","(146,116)","(128,128)","(110,116)"],a:1,why:"共轭对称关于(128,128)，故(256−110,256−140)=(146,116)。"},
 {q:"低通滤波器通常保留哪类频率？",options:["高频、用于锐化","低频、用于平滑","只保留周期噪声","只保留相位"],a:1,why:"低频代表变化缓慢的整体灰度，低通抑制高频后会平滑图像。"},
 {q:"对于3×3全1目标，使用3×3全1结构元腐蚀，剩余多少个1？",options:["0","1","5","9"],a:1,why:"只有中心能完整容纳3×3结构元，因此剩下1个中心像素。"},
 {q:"哪项运算是先腐蚀后膨胀？",options:["闭操作","开操作","梯度","边界提取"],a:1,why:"开操作先腐蚀，再膨胀；一般去除细小的前景结构。"},
 {q:"在r∈[0,1]且c=1时，γ=0.5的幂次变换一般会使暗部？",options:["变暗","灰度颠倒","变亮","不变"],a:2,why:"例如r=0.25时，r^0.5=0.5，变亮。"}
];
// 修正第3题选项：3.5的四舍五入结果为4。
quizItems[2].options=["1","2","3","4"];
quizItems[2].a=3;
quizItems[2].why="s=round[(8−1)×0.5]=round(3.5)=4；这里采用普通四舍五入（半数进位）规则。";
function setupQuiz(){
 const questions=$("#quizQuestions");
 questions.innerHTML=quizItems.map((item,i)=>`<article class="quiz-question" id="q${i}">
 <h3>${i+1}. ${escapeHtml(item.q)}</h3>
 ${item.options.map((op,j)=>`<label><input type="radio" name="question-${i}" value="${j}"> ${String.fromCharCode(65+j)}. ${escapeHtml(op)}</label>`).join("")}
 <div class="quiz-explain" id="exp${i}"></div></article>`).join("");
 const score=$("#quizScore");
 $("#quizSubmit").onclick=()=>{
  let answered=0,correct=0;quizItems.forEach((item,i)=>{
   const picked=$(`input[name="question-${i}"]:checked`),card=$("#q"+i),expl=$("#exp"+i);
   card.classList.remove("correct","incorrect");
   if(picked){answered++;if(Number(picked.value)===item.a){correct++;card.classList.add("correct")}else card.classList.add("incorrect")}
   else card.classList.add("incorrect");
   expl.style.display="block";
   expl.textContent=`正确答案：${String.fromCharCode(65+item.a)}。${item.why}${picked?"":"（本题未作答）"}`;
  });
  score.textContent=`得分 ${correct} / ${quizItems.length}；已作答 ${answered} 题。${correct===quizItems.length?" 全对，太棒了！": " 根据解析再复习易错点。"}`;
 };
 $("#quizReset").onclick=()=>{questions.querySelectorAll("input").forEach(x=>x.checked=false);
  $$(".quiz-question").forEach(c=>c.classList.remove("correct","incorrect"));$$(".quiz-explain").forEach(x=>x.style.display="none");score.textContent="";questions.scrollIntoView({behavior:"smooth",block:"start"})}
}
function setupNotes(){
 const notes=$("#notes");notes.value=storeGet("pixel-notes","");
 notes.oninput=()=>{storeSet("pixel-notes",notes.value);$("#notesStatus").textContent="已保存在本机浏览器（不上传）"};
}
document.addEventListener("DOMContentLoaded",()=>{
 setupNavigation();setupHistogram();setupGamma();setupKernel();setupLowpass();
 setupNotch();setupMorphology();setupQuiz();setupNotes();
});
