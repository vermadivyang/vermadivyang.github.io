const textElementSource=document.getElementById('liveTextSource');
const expandedTextEditor=document.getElementById('expandedTextEditor');
const paragraphWrapper=document.getElementById('paragraphWrapper');
const graphicStageElement=document.getElementById('visualGraphStage');
const expandedGraphStage=document.getElementById('expandedGraphStage');
const graphOverlay=document.getElementById('graphOverlay');
const textOverlay=document.getElementById('textOverlay');
const sentenceTableBody=document.getElementById('sentenceTableBody');
const expandGraphButton=document.getElementById('expandGraphButton');
const closeGraphButton=document.getElementById('closeGraphButton');
const expandTextButton=document.getElementById('expandTextButton');
const closeTextButton=document.getElementById('closeTextButton');
const resetTextButton=document.getElementById('resetTextButton');
const graphPanel = document.querySelector(".graph-panel");

const initialText = textElementSource.innerText;

let graphActivated = false;

textElementSource.addEventListener("focus", function() {
    textElementSource.classList.remove("unfocused");
    textElementSource.classList.add("focused");

    if (!graphActivated) {
        graphPanel.classList.add("active");
        paragraphWrapper.classList.add("active");
        graphActivated = true;
    }
});

textElementSource.addEventListener("blur", function() {
    textElementSource.classList.remove("focused");
    textElementSource.classList.add("unfocused");
});

resetTextButton.addEventListener("click", function() {
    textElementSource.innerText = initialText;

    graphPanel.classList.remove("active");
    paragraphWrapper.classList.remove("active");

    graphActivated = false;

    textElementSource.classList.remove("focused", "unfocused");

    textElementSource.blur();

    rebuildInterfaceMetrics();
});

window.addEventListener('scroll', () => {
    const navbar = document.querySelector('nav');
    
    if (window.scrollY > 0) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  });


const commonStarters=new Set(["this","that","the","they","them","how","when","but","i","yet","me","my","myself","a","an","then","as"]);

function rectanglesOverlap(a,b,padding=0){
return !(a.x+a.width+padding<=b.x||b.x+b.width+padding<=a.x||a.y+a.height+padding<=b.y||b.y+b.height+padding<=a.y);
}

function labelCoversPoint(label,point){
const closestX=Math.max(label.x,Math.min(point.x,label.x+label.width));
const closestY=Math.max(label.y,Math.min(point.y,label.y+label.height));
const dx=point.x-closestX;
const dy=point.y-closestY;
return(dx*dx+dy*dy)<64;
}

function resolveLabelOverlaps(labels,allPoints,width,height,topPadding,bottomPadding,rightPadding){
const orderedLabels=[...labels].sort((a,b)=>a.point.x-b.point.x);
orderedLabels.forEach(item=>{
let bestPosition=null,bestScore=Infinity;
const offsets=[];
for(let distance=0;distance<=180;distance+=5){
if(distance===0)offsets.push(0);
else{offsets.push(distance);offsets.push(-distance);}
}
for(const offset of offsets){
let candidateX=item.originalX;
let candidateY=item.originalY+offset;
candidateY=Math.max(topPadding,Math.min(candidateY,height-bottomPadding-item.height));
candidateX=Math.max(2,Math.min(candidateX,width-rightPadding-item.width));
const candidate={x:candidateX,y:candidateY,width:item.width,height:item.height};
let collision=false;
for(const point of allPoints){
if(labelCoversPoint(candidate,point)){collision=true;break;}
}
if(collision)continue;
for(const other of orderedLabels){
if(other===item||other.x===undefined||other.y===undefined)continue;
if(rectanglesOverlap(candidate,{x:other.x,y:other.y,width:other.width,height:other.height},5)){collision=true;break;}
}
if(collision)continue;
const score=Math.abs(offset);
if(score<bestScore){bestScore=score;bestPosition={x:candidateX,y:candidateY};}
}
if(bestPosition){item.x=bestPosition.x;item.y=bestPosition.y}
else{
item.x=item.originalX;
item.y=Math.max(topPadding,Math.min(item.originalY,height-bottomPadding-item.height));
}
item.background.setAttribute("x",item.x);
item.background.setAttribute("y",item.y);
item.label.setAttribute("x",item.x+item.width/2);
item.label.setAttribute("y",item.y+item.height/2+4.5);
});
}

function parseSentences(rawText){
const sentences=[];
let current="";
for(let i=0;i<rawText.length;i++){
const character=rawText[i];

if(character==="."&&rawText[i+1]==="."&&rawText[i+2]==="."){
current+="...";
i+=2;
while(rawText[i+1]==="."){current+=".";i++}
continue;
}

current+=character;

if(character==="."||character==="!"||character==="?"){
while(i+1<rawText.length&&(rawText[i+1]==="!"||rawText[i+1]==="?")){
current+=rawText[i+1];i++;
}

if(rawText[i+1]==='"'){current+='"';i++;}

if(i+1>=rawText.length||/\s/.test(rawText[i+1])){
if(current.trim().length>0)sentences.push(current.trim());
current="";
}
}
}
if(current.trim().length>0)sentences.push(current.trim());
return sentences;
}

function getFirstWord(sentence){
const tokens=sentence.split(/\s+/).filter(token=>token.length>0);
if(tokens.length===0)return"";
const originalToken=tokens[0];
let cleanedToken=originalToken.replace(/^"+/,"");
if(/\p{L}|\p{N}/u.test(cleanedToken)){
cleanedToken=cleanedToken.replace(/^[^\p{L}\p{N}]+/u,"");
cleanedToken=cleanedToken.replace(/[^\p{L}\p{N}]+$/u,"");
}
return cleanedToken.length===0?originalToken.replace(/^"+/,""):cleanedToken;
}

function getSentenceData(){
const rawContent=textElementSource.innerText||"";
const sentenceSegments=parseSentences(rawContent);
const wordCounts=[],firstWords=[];
sentenceSegments.forEach(segment=>{
const words=segment.trim().split(/\s+/).filter(token=>token.length>0);
if(words.length>0){wordCounts.push(words.length);firstWords.push(getFirstWord(segment));}
});
return{wordCounts,firstWords};
}

function calculateStatistics(wordCounts,firstWords){
if(wordCounts.length===0)return{commonStarterPercent:0,standardDeviation:0,averageSentenceLength:0,averageFirstWordLength:0};
const averageSentenceLength=wordCounts.reduce((sum,value)=>sum+value,0)/wordCounts.length;
const variance=wordCounts.reduce((sum,value)=>sum+Math.pow(value-averageSentenceLength,2),0)/wordCounts.length;
const standardDeviation=Math.sqrt(variance);
const commonStarterCount=firstWords.filter(word=>commonStarters.has(word.toLowerCase())).length;
const commonStarterPercent=commonStarterCount/firstWords.length*100;
const validFirstWordLengths=firstWords.filter(word=>word.length>0).map(word=>word.length);
const averageFirstWordLength=validFirstWordLengths.length?validFirstWordLengths.reduce((sum,value)=>sum+value,0)/validFirstWordLengths.length:0;
return{commonStarterPercent,standardDeviation,averageSentenceLength,averageFirstWordLength};
}

function updateStatistics(firstWords,wordCounts){
const stats=calculateStatistics(wordCounts,firstWords);
document.getElementById("commonStarterStat").textContent=`${stats.commonStarterPercent.toFixed(2)}%`;
document.getElementById("standardDeviationStat").textContent=`${stats.standardDeviation.toFixed(2)} words`;
document.getElementById("averageSentenceLengthStat").textContent=`${stats.averageSentenceLength.toFixed(2)} words`;
document.getElementById("averageFirstWordLengthStat").textContent=`${stats.averageFirstWordLength.toFixed(2)} letters`;
}

function updateSentenceTable(firstWords,wordCounts){
sentenceTableBody.innerHTML="";
firstWords.forEach((word,index)=>{
const row=document.createElement("tr");
const numberCell=document.createElement("td");
numberCell.textContent=index+1;
const wordCell=document.createElement("td");
wordCell.textContent=word;
const lengthCell=document.createElement("td");
lengthCell.textContent=wordCounts[index];
row.appendChild(numberCell);
row.appendChild(wordCell);
row.appendChild(lengthCell);
sentenceTableBody.appendChild(row);
});
}

function getXAxisInterval(sentenceCount){
if(sentenceCount<=12)return 1;
if(sentenceCount<=25)return 2;
if(sentenceCount<=50)return 5;
if(sentenceCount<=100)return 10;
if(sentenceCount<=250)return 25;
if(sentenceCount<=500)return 50;
return 100;
}

function createGraph(stage){
const{wordCounts,firstWords}=getSentenceData();
stage.innerHTML="";
if(wordCounts.length===0){
stage.innerHTML='<div style="width:100%;text-align:left;color:#b10202;margin-top:20px;font-size:.75rem;">     No words to graph. You could click to the left and type somthing. Or you could just refresh the page. Or you could look at my projects below. Or you could just close your computer and touch grass. Just a suggestion.</div>';
return;
}

const averageSentenceLength=wordCounts.reduce((sum,count)=>sum+count,0)/wordCounts.length;
const width=stage.clientWidth;
const height=stage.clientHeight;
const leftPadding=10,rightPadding=45,topPadding=15,bottomPadding=30;
const graphWidth=width-leftPadding-rightPadding;
const graphHeight=height-topPadding-bottomPadding;
const axisY=height-bottomPadding;
const maximum=Math.max(...wordCounts);
let yMax;
if(maximum<=10)yMax=10;
else if(maximum<=20)yMax=20;
else if(maximum<=50)yMax=Math.ceil(maximum/10)*10;
else yMax=Math.ceil(maximum/20)*20;

const svg=document.createElementNS("http://www.w3.org/2000/svg","svg");
svg.setAttribute("class","chart-svg");
svg.setAttribute("viewBox",`0 0 ${width} ${height}`);
svg.setAttribute("preserveAspectRatio","none");

const yAxis=document.createElementNS("http://www.w3.org/2000/svg","line");
yAxis.setAttribute("x1",leftPadding);yAxis.setAttribute("x2",leftPadding);yAxis.setAttribute("y1",topPadding);yAxis.setAttribute("y2",axisY);yAxis.setAttribute("stroke","#94a3b8");yAxis.setAttribute("stroke-width","2");svg.appendChild(yAxis);

const xAxis=document.createElementNS("http://www.w3.org/2000/svg","line");
xAxis.setAttribute("x1",leftPadding);xAxis.setAttribute("x2",width-rightPadding);xAxis.setAttribute("y1",axisY);xAxis.setAttribute("y2",axisY);xAxis.setAttribute("stroke","#94a3b8");xAxis.setAttribute("stroke-width","2");svg.appendChild(xAxis);

const yTickCount=5;
for(let i=0;i<=yTickCount;i++){
const value=Math.round(yMax*i/yTickCount);
const y=axisY-(value/yMax)*graphHeight;
const text=document.createElementNS("http://www.w3.org/2000/svg","text");
text.setAttribute("class","axis-number");
text.setAttribute("x",leftPadding-7);
text.setAttribute("y",y+4);
text.setAttribute("text-anchor","end");
text.textContent=value;
svg.appendChild(text);

if(i>0&&i<yTickCount){
const gridLine=document.createElementNS("http://www.w3.org/2000/svg","line");
gridLine.setAttribute("class","grid-line");
gridLine.setAttribute("x1",leftPadding);gridLine.setAttribute("x2",width-rightPadding);gridLine.setAttribute("y1",y);gridLine.setAttribute("y2",y);
svg.appendChild(gridLine);
}
}

const points=wordCounts.map((count,index)=>{
let x;
if(wordCounts.length===1)x=leftPadding+graphWidth/2;
else x=leftPadding+(index/(wordCounts.length-1))*graphWidth;
const y=axisY-(count/yMax)*graphHeight;
return{x,y,wordCount:count};
});

const xAxisInterval=getXAxisInterval(wordCounts.length);

points.forEach((point,index)=>{
const shouldShowNumber=index===0||index===wordCounts.length-1||((index+1)%xAxisInterval===0);
if(!shouldShowNumber)return;
const grid=document.createElementNS("http://www.w3.org/2000/svg","line");
grid.setAttribute("class","x-grid-line");
grid.setAttribute("x1",point.x);grid.setAttribute("x2",point.x);grid.setAttribute("y1",axisY);grid.setAttribute("y2",topPadding);
svg.appendChild(grid);
});

const averageY=axisY-(averageSentenceLength/yMax)*graphHeight;
const averageLine=document.createElementNS("http://www.w3.org/2000/svg","line");
averageLine.setAttribute("class","standard-line");
averageLine.setAttribute("x1",leftPadding);averageLine.setAttribute("x2",width-rightPadding);averageLine.setAttribute("y1",averageY);averageLine.setAttribute("y2",averageY);
svg.appendChild(averageLine);

points.forEach((point,index)=>{
const shouldShowNumber=index===0||index===wordCounts.length-1||((index+1)%xAxisInterval===0);
if(!shouldShowNumber)return;
const text=document.createElementNS("http://www.w3.org/2000/svg","text");
text.setAttribute("class","axis-number");
text.setAttribute("x",point.x);text.setAttribute("y",axisY+18);text.setAttribute("text-anchor","middle");text.textContent=index+1;svg.appendChild(text);
});

let pathData="";
points.forEach((point,index)=>{pathData+=index===0?`M ${point.x} ${point.y}`:` L ${point.x} ${point.y}`});
const line=document.createElementNS("http://www.w3.org/2000/svg","path");
line.setAttribute("class","chart-line");line.setAttribute("d",pathData);svg.appendChild(line);

const labelObjects=[];

points.forEach((point,index)=>{
const labelText=firstWords[index];
const labelWidth=Math.max(30,labelText.length*7.6+12);
const labelHeight=19;
let labelX=point.x+9;
if(labelX+labelWidth>width-rightPadding)labelX=point.x-labelWidth-9;
let labelY=point.y-15;
if(labelY<topPadding)labelY=point.y+9;

const background=document.createElementNS("http://www.w3.org/2000/svg","rect");
background.setAttribute("class","sentence-label-background");
background.setAttribute("x",labelX);background.setAttribute("y",labelY);background.setAttribute("width",labelWidth);background.setAttribute("height",labelHeight);svg.appendChild(background);

const label=document.createElementNS("http://www.w3.org/2000/svg","text");
label.setAttribute("class","sentence-label");
label.setAttribute("x",labelX+labelWidth/2);label.setAttribute("y",labelY+labelHeight/2+4.5);label.setAttribute("text-anchor","middle");label.textContent=labelText;svg.appendChild(label);

const circle=document.createElementNS("http://www.w3.org/2000/svg","circle");
circle.setAttribute("class","chart-point");circle.setAttribute("cx",point.x);circle.setAttribute("cy",point.y);circle.setAttribute("r","5");

const item={point,circle,label,background,width:labelWidth,height:labelHeight,originalX:labelX,originalY:labelY,x:labelX,y:labelY,hovered:false,selected:false};
labelObjects.push(item);

function updateLabels(){
const visibleLabels=labelObjects.filter(object=>object.hovered||object.selected);
labelObjects.forEach(object=>{
const visible=object.hovered||object.selected;
object.label.classList.toggle("visible",visible);
object.background.classList.toggle("visible",visible);
});
resolveLabelOverlaps(visibleLabels,points,width,height,topPadding,bottomPadding,rightPadding);
}

circle.addEventListener("mouseenter",()=>{item.hovered=true;updateLabels()});
circle.addEventListener("mouseleave",()=>{item.hovered=false;updateLabels()});
circle.addEventListener("click",event=>{event.stopPropagation();item.selected=!item.selected;circle.classList.toggle("selected",item.selected);updateLabels()});
svg.appendChild(circle);
});

stage.appendChild(svg);
}

function updateTextOverflowState(){
const isOverflowing=textElementSource.scrollHeight>textElementSource.clientHeight+2;
paragraphWrapper.classList.toggle("has-overflow",isOverflowing);
}

function rebuildInterfaceMetrics(){
const{firstWords,wordCounts}=getSentenceData();
updateSentenceTable(firstWords,wordCounts);
updateStatistics(firstWords,wordCounts);
updateTextOverflowState();
createGraph(graphicStageElement);
if(graphOverlay.classList.contains("open"))createGraph(expandedGraphStage);
}

function openExpandedGraph(){
graphOverlay.classList.add("open");
document.body.classList.add("graph-expanded");
requestAnimationFrame(()=>{
createGraph(expandedGraphStage);
const{firstWords,wordCounts}=getSentenceData();
updateSentenceTable(firstWords,wordCounts);
updateStatistics(firstWords,wordCounts);
});
}

function closeExpandedGraph(){
graphOverlay.classList.remove("open");
document.body.classList.remove("graph-expanded");
}

function openExpandedText(){
expandedTextEditor.innerText=textElementSource.innerText;
textOverlay.classList.add("open");
document.body.classList.add("text-expanded");
requestAnimationFrame(()=>expandedTextEditor.focus());
}

function closeExpandedText(){
textElementSource.innerText=expandedTextEditor.innerText;
textOverlay.classList.remove("open");
document.body.classList.remove("text-expanded");
rebuildInterfaceMetrics();
}

expandGraphButton.addEventListener("click",openExpandedGraph);
closeGraphButton.addEventListener("click",closeExpandedGraph);
expandTextButton.addEventListener("click",openExpandedText);
closeTextButton.addEventListener("click",closeExpandedText);

expandedTextEditor.addEventListener("input",()=>{
textElementSource.innerText=expandedTextEditor.innerText;
rebuildInterfaceMetrics();
});

graphOverlay.addEventListener("click",event=>{
if(event.target===graphOverlay)closeExpandedGraph();
});

textOverlay.addEventListener("click",event=>{
if(event.target===textOverlay)closeExpandedText();
});

document.addEventListener("keydown",event=>{
if(event.key==="Escape"&&graphOverlay.classList.contains("open"))closeExpandedGraph();
if(event.key==="Escape"&&textOverlay.classList.contains("open"))closeExpandedText();
});

textElementSource.addEventListener("input",rebuildInterfaceMetrics);
window.addEventListener("resize",rebuildInterfaceMetrics);
rebuildInterfaceMetrics();
