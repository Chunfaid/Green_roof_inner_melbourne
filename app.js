const CENTER=[-37.8136,144.9631];
const map=L.map('map',{preferCanvas:true}).setView(CENTER,12);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'}).addTo(map);
L.control.scale({position:'bottomleft',metric:true,imperial:false,maxWidth:120}).addTo(map);

const cfg={
  boundary:{file:'data/Project_boundaries.geojson',kind:'boundary',title:'Project Boundary'},
  population:{file:'data/Population_density.geojson',kind:'factor',fields:['pop_score','population_score','score'],title:'Population Density',subtitle:'Higher score = greater population exposure',palette:['#eff3ff','#bdd7e7','#6baed6','#3182bd','#08519c']},
  seifa:{file:'data/Socioeconomic_index.geojson',kind:'factor',fields:['vuln_score','Vulnerabil','vulnerability','SEIFA_score','SEIFA scor','seifa_score','score'],title:'Socioeconomic Disadvantage (SEIFA IRSD)',subtitle:'Higher score = greater socioeconomic vulnerability',palette:['#f2f0f7','#cbc9e2','#9e9ac8','#756bb1','#54278f']},
  ndvi:{file:'data/NDVI.geojson',kind:'factor',fields:['NDVI_score','ndvi_score','score'],title:'Vegetation Need (NDVI)',subtitle:'Higher score = lower greenness / greater greening need',palette:['#e5f5e0','#a1d99b','#74c476','#fdcc8a','#e34a33']},
  lst:{file:'data/land_surface_temperture.geojson',kind:'factor',fields:['LST_score','lst_score','score'],title:'Land Surface Temperature',subtitle:'Higher score = hotter surface conditions',palette:['#ffffcc','#fed976','#feb24c','#fd8d3c','#bd0026']},
  need:{file:'data/green_roof_neeed_score.geojson',kind:'need',fields:['need_score','score'],title:'Green Roof Intervention Need',subtitle:'Combined score from low to high intervention need',palette:['#ffffcc','#fed976','#fd8d3c','#f03b20','#bd0026']},
  heat:{file:'data/Temperture_Focus.geojson',kind:'weighted',fields:['w_heat','heat_focus','temperature_focus','Temperature_Focus','Temperture_Focus'],title:'Heat-focused priority',subtitle:'40% LST · 20% each other indicator'},
  equity:{file:'data/equality_Focus.geojson',kind:'weighted',fields:['w_equity','equity_focus','equality_Focus','Equity_Focus'],title:'Equity-focused priority',subtitle:'40% SEIFA vulnerability · 20% each other indicator'},
  green:{file:'data/Greeness_Focus.geojson',kind:'weighted',fields:['w_green','green_focus','Greeness_Focus','vegetation_focus'],title:'Vegetation-focused priority',subtitle:'40% NDVI need · 20% each other indicator'},
  pop:{file:'data/Population_foucs.geojson',kind:'weighted',fields:['w_pop','pop_focus','Population_focus','Population_foucs'],title:'Population-focused priority',subtitle:'40% population density · 20% each other indicator'},
  candidates:{file:'data/Greenroof_weight_v2.geojson',kind:'candidate',title:'Green Roof Candidates'},
  scenario1:{file:'data/Scenario_1_priority.geojson',kind:'scenario',title:'Scenario 1 — Priority',subtitle:'Very High priority roofs'},
  scenario2:{file:'data/Scenario_2_targeted.geojson',kind:'scenario',title:'Scenario 2 — Targeted',subtitle:'Very High + High priority roofs'},
  scenario3:{file:'data/Scenario_3_Board.geojson',kind:'scenario',title:'Scenario 3 — Broad',subtitle:'Very High + High + Moderate priority roofs'}
};

const scenarioFiles={
  balanced:['Scenario_1_priority.geojson','Scenario_2_targeted.geojson','Scenario_3_Board.geojson'],
  heat:['Heat_S1_cooling.geojson','Heat_S2_roofs_cooling.geojson','Heat_S3_roofs_cooling.geojson'],
  equity:['Equity_S1_roofs_cooling.geojson','Equity_S2_roofs_cooling.geojson','Equity_S3_roofs_cooling.geojson'],
  green:['Green_S1_roofs_cooling.geojson','Green_S2_roofs_cooling.geojson','Green_S3_roofs_cooling.geojson'],
  pop:['Population_S1_roofs_cooling.geojson','Population_S2_roofs_cooling.geojson','Population_S3_roofs_cooling.geojson']
};
const focusNames={balanced:'Balanced',heat:'Heat',equity:'Equity',green:'Vegetation',pop:'Population'};
for(const [focus,files] of Object.entries(scenarioFiles)){
  files.forEach((file,i)=>{
    const key='scenario_'+focus+'_'+(i+1);
    cfg[key]={file:'data/'+file,kind:'scenario',title:focusNames[focus]+' — Scenario '+(i+1),subtitle:'Modelled surface cooling'};
  });
}
function currentScenarioKey(){return 'scenario_'+currentFocus+'_'+currentScenario}
function clearScenarioMetrics(){
 ['scenarioCells','scenarioModelled','scenarioMean'].forEach(id=>document.getElementById(id).textContent='—');
}
const registry={};
let studyBounds=null;
let selectedRoofLayer=null;
let selectedProps=null;
let showingAll=false;

function first(p,names){
  for(const n of names){
    if(p&&p[n]!==undefined&&p[n]!==null&&p[n]!=='') return p[n];
  }
  return null;
}

function factorValue(props, config){
  let value=first(props,config.fields||[]);
  if(value!==null) return value;

  // Fallback: find a numeric field that looks like a 1–5 score.
  for(const [key,val] of Object.entries(props||{})){
    const numVal=Number(val);
    if(Number.isFinite(numVal) && numVal>=1 && numVal<=5){
      const k=key.toLowerCase();
      if(k.includes('score') || k.includes('seifa') || k.includes('vulner') || k.includes('irsd')){
        return numVal;
      }
    }
  }
  return null;
}
function n(v){const x=Number(v);return Number.isFinite(x)?x:null}
function esc(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
function scoreIndex(v){const x=n(v);if(x===null)return null;return Math.max(0,Math.min(4,Math.round(x)-1))}
function colorFromScore(v,palette){const x=v===null||v===undefined||v===''?null:Number(v);if(x===null||!Number.isFinite(x))return '#92999c';if(x===0)return '#abb5b0';const i=scoreIndex(x);return i===null?'#92999c':palette[i]}
function priorityClass(v){
  if(v===null || v===undefined || v==='') return 'Not assessed';

  const numericValue=Number(v);
  if(Number.isFinite(numericValue)){
    if(numericValue>=4.5) return 'Very High';
    if(numericValue>=4.0) return 'High';
    if(numericValue>=3.0) return 'Moderate';
    if(numericValue>=2.0) return 'Low';
    return 'Very Low';
  }

  const p=String(v).toLowerCase().trim();
  if(p.includes('very high')) return 'Very High';
  if(p.includes('high')) return 'High';
  if(p.includes('moderate')) return 'Moderate';
  if(p.includes('very low')) return 'Very Low';
  if(p.includes('low')) return 'Low';
  return 'Not assessed';
}

function priorityColor(v){
  const cls=priorityClass(v);
  if(cls==='Very High') return '#7f0000';
  if(cls==='High') return '#d7301f';
  if(cls==='Moderate') return '#fc8d59';
  if(cls==='Low') return '#fdbb84';
  if(cls==='Very Low') return '#fee8c8';
  return '#8e9793';
}
function coolingColor(v){if(v===null||v===undefined||v==='')return '#aab2b8';const x=Number(v);if(!Number.isFinite(x))return '#aab2b8';if(x<1)return '#d7e7fb';if(x<1.8)return '#a4c8f0';if(x<2.6)return '#6a9cdb';if(x<3.4)return '#2767b3';return '#103e86'}

const roofFocusFields={heat:['w_heat'],equity:['w_equity'],green:['w_green'],pop:['w_pop']};
function roofFocusValue(p){
 if(currentFocus==='balanced')return first(p,['need_score','need score']);
 return first(p,roofFocusFields[currentFocus]||[]);
}
function roofMapColor(p){
 if(currentFocus==='balanced')return priorityColor(first(p,['priority c','priority_c','priority','Priority']));
 return colorFromScore(roofFocusValue(p),cfg.need.palette);
}
function restyleRoofs(){
 if(!registry.candidates)return;
 registry.candidates.layer.eachLayer(l=>{if(l!==selectedRoofLayer&&l.feature)l.setStyle(style('candidate',l.feature.properties||{},cfg.candidates))});
 if(selectedProps)renderRoofPanel(selectedProps);
}
function style(kind,p,c){
  if(kind==='boundary')return{color:'#245b4a',weight:2.3,fillOpacity:0};
  if(kind==='factor'||kind==='need'){const value=kind==='need'?first(p,c.fields):factorValue(p,c);const valid=value!==null&&value!==''&&Number.isFinite(Number(value));return{color:'rgba(255,255,255,.65)',weight:.20,fillColor:colorFromScore(value,c.palette),fillOpacity:valid?.82:.94}}
  if(kind==='weighted'){
    const raw=first(p,c.fields);
    const val=raw===null?null:Number(raw);
    return {color:'rgba(255,255,255,.65)',weight:.25,fillColor:colorFromScore(val,cfg.need.palette),fillOpacity:val!==null&&Number.isFinite(val)?.82:.94};
  }
  if(kind==='candidate'){
    const pr=first(p,['priority c','priority_c','priority','Priority']);
    return{
      color:'#4a332c',
      weight:.45,
      fillColor:roofMapColor(p),
      fillOpacity:.90
    };
  }
  if(kind==='scenario'){const value=first(p,['cooling_C','Cooling_C','cooling_c']);return{color:'rgba(255,255,255,.55)',weight:.30,fillColor:coolingColor(value),fillOpacity:value===null?.34:.95}}
}

function fmt(v,d=2){
  if(v===null||v===undefined||v==='')return'Not available';
  const x=Number(v);
  if(Number.isFinite(x)) return x.toFixed(d).replace(/\.00$/,'');
  return String(v);
}

function friendlyName(key){
  const names={
    roof_uid:'Roof ID',roof_id:'Roof ID','unique uid':'Unique roof ID',unique_uid:'Unique roof ID',uid:'Unique roof ID',council:'Council',source:'Data source',height_m:'Height (m)',area_m2:'Roof area (m²)',
    area_score:'Area score',need_score:'Need score',priority_c:'Candidate priority','priority c':'Candidate priority',roof_conf:'Roof confidence',confidence:'Roof confidence',
    roof_prob:'Roof probability',NDVI_score:'NDVI score',population:'Population score',pop_score:'Population score','SEIFA scor':'SEIFA score',SEIFA_score:'SEIFA score',Vulnerabil:'SEIFA vulnerability score',
    LST_score:'LST score',fid:'Feature ID',id:'Grid ID',gr_area_sum:'Green-roof area sum',gr_area:'Green-roof area',
    gr_percentage:'Green-roof coverage (%)',cooling_C:'Cooling (°C)',Cooling_C:'Cooling (°C)'
  };
  return names[key]||key.replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase());
}

function showLoading(title,text='Preparing map layer'){
  document.getElementById('loadingTitle').textContent=title;
  document.getElementById('loadingText').textContent=text;
  document.getElementById('loading').classList.remove('hidden');
}
function hideLoading(){document.getElementById('loading').classList.add('hidden')}

async function ensure(key){
  if(registry[key])return registry[key];
  const c=cfg[key];
  showLoading(`Loading ${c.title}…`,key==='candidates'?'Large candidate layer — this can take a moment':'Preparing map layer');
  try{
    const r=await fetch(c.file);
    if(!r.ok)throw new Error(`${c.file}: ${r.status}`);
    const data=await r.json();
    const layer=L.geoJSON(data,{
      style:f=>style(c.kind,f.properties||{},c),
      onEachFeature:(feature,l)=>{
        if(c.kind==='candidate'){
          l.on('click',()=>selectRoof(l,feature.properties||{}));
          l.on('mouseover',()=>{if(l!==selectedRoofLayer)l.setStyle({weight:1.2,color:'#1d332b'})});
          l.on('mouseout',()=>{if(l!==selectedRoofLayer)l.setStyle(style('candidate',feature.properties||{},c))});
        }else if(c.kind!=='boundary'){
          l.bindPopup(simplePopup(c,feature.properties||{}),{maxWidth:270});
        }
      }
    });
    registry[key]={layer,c,featureData:c.kind==='scenario'?data:null,rawData:c.kind==='weighted'?data:null};
    if(key==='boundary'){const b=layer.getBounds();if(b.isValid())studyBounds=b}
    return registry[key];
  }finally{hideLoading()}
}

function simplePopup(c,p){
  if(c===cfg.seifa){
    const vuln=first(p,['vuln_score','Vulnerabil','vulnerability']);
    const irsd=first(p,['grid_irsd','IRSD','irsd']);
    return `<div style="font-weight:800;color:#123f34;margin-bottom:7px">${esc(c.title)}</div>
      ${irsd!==null?`<div style="font-size:12px;margin-bottom:3px"><b>IRSD:</b> ${esc(fmt(irsd))}</div>`:''}
      ${vuln!==null?`<div style="font-size:12px"><b>Vulnerability score:</b> ${esc(fmt(vuln))}</div>`:''}`;
  }
  const value=c.kind==='weighted'?first(p,c.fields):c.fields?factorValue(p,c):first(p,['cooling_C','Cooling_C','cooling_c','gr_percentage']);
  return `<div style="font-weight:800;color:#123f34;margin-bottom:7px">${esc(c.title)}</div>
    ${value!==null?`<div style="font-size:12px"><b>Value:</b> ${esc(fmt(value))}</div>`:''}`;
}

function selectRoof(layer,props){
  if(selectedRoofLayer && selectedRoofLayer!==layer){
    const oldProps=selectedProps||{};
    selectedRoofLayer.setStyle(style('candidate',oldProps,cfg.candidates));
  }
  selectedRoofLayer=layer;
  selectedProps=props;
  document.getElementById('roofGuide').classList.add('hidden');
  showingAll=false;
  layer.setStyle({weight:3,color:'#102f27',fillOpacity:.9});
  layer.bringToFront();
  renderRoofPanel(props);
}

function renderRoofPanel(props){
  const panel=document.getElementById('roofPanel');
  const summary=document.getElementById('roofSummary');
  const attrs=document.getElementById('roofAttributes');
  const priority=first(props,['priority c','priority_c','priority','Priority']);
  const council=first(props,['council','Council']);
  const area=first(props,['area_m2','area','roof_area']);
  const need=first(props,['need_score','need score']);
  const conf=first(props,['roof_conf','confidence']);
  const prob=first(props,['roof_prob','roof prob']);
  const focusScore=roofFocusValue(props);
  const focusLabel={balanced:'Original need',heat:'Heat-focused need',equity:'Equity-focused need',green:'Vegetation-focused need',pop:'Population-focused need'}[currentFocus];

  summary.innerHTML=`
    ${priority!==null?`<span class="priority-badge" style="background:${priorityColor(priority)}">${esc(priorityClass(priority))} priority</span>`:''}
    <div class="summary-grid">
      <div class="summary-card"><span>${esc(focusLabel)}</span><strong>${esc(fmt(focusScore))}</strong></div>
      <div class="summary-card"><span>Council</span><strong>${esc(council??'Not available')}</strong></div>
      <div class="summary-card"><span>Roof area</span><strong>${area!==null?esc(fmt(area,1))+' m²':'Not available'}</strong></div>
      <div class="summary-card"><span>Need score</span><strong>${esc(fmt(need))}</strong></div>
      <div class="summary-card"><span>Roof confidence</span><strong>${esc(conf??'Not available')}</strong></div>
      ${prob!==null?`<div class="summary-card"><span>Roof probability</span><strong>${esc(fmt(prob))}</strong></div>`:''}
      ${first(props,['unique uid','unique_uid','roof_uid','roof_id','uid'])!==null?`<div class="summary-card"><span>Roof ID</span><strong>${esc(first(props,['unique uid','unique_uid','roof_uid','roof_id','uid']))}</strong></div>`:''}
    </div>`;

  const priorityKeys=[
    'priority c','priority_c',
    'council',
    'area_m2','area_score',
    'need_score',
    'confidence','roof_conf',
    'roof_prob',
    'height_m',
    'population','pop_score',
    'SEIFA scor','SEIFA_score','Vulnerabil',
    'NDVI_score',
    'LST','LST_score',
    'source',
    'unique uid','unique_uid','roof_uid','uid'
  ];
  const allEntries=Object.entries(props);
  const ordered=[
    ...priorityKeys.filter(k=>Object.prototype.hasOwnProperty.call(props,k)).map(k=>[k,props[k]]),
    ...allEntries.filter(([k])=>!priorityKeys.includes(k))
  ];

  attrs.innerHTML=ordered.map(([k,v],i)=>`
    <div class="attribute-row ${i>=12?'extra hidden':''}">
      <div class="attribute-key">${esc(friendlyName(k))}</div>
      <div class="attribute-value">${esc(fmt(v))}</div>
    </div>`).join('');

  const btn=document.getElementById('toggleAllBtn');
  btn.style.display=ordered.length>12?'inline-block':'none';
  btn.textContent='Show all';
  panel.classList.remove('hidden');
}

function closeRoofPanel(){
  document.getElementById('roofPanel').classList.add('hidden');
  if(selectedRoofLayer){
    selectedRoofLayer.setStyle(style('candidate',selectedProps||{},cfg.candidates));
  }
  selectedRoofLayer=null;selectedProps=null;
  document.getElementById('roofGuide').classList.toggle('hidden',currentMode!=='roofs');
}


const modes=['need','roofs','scenarios'];
const keys=['population','seifa','ndvi','lst','need','heat','equity','green','pop','candidates',...Object.keys(scenarioFiles).flatMap(f=>[1,2,3].map(i=>'scenario_'+f+'_'+i))];
const focusKeys={balanced:'need',heat:'heat',equity:'equity',green:'green',pop:'pop'};
const scenarioInfo={
  scenario1:['Scenario 1 — Priority','Very High priority areas only.'],
  scenario2:['Scenario 2 — Targeted','Very High and High priority areas.'],
  scenario3:['Scenario 3 — Broad','Very High, High and Moderate priority areas.']
};
let currentMode='need',currentFactor='need',currentFocus='balanced',currentScenario=1,requestVersion=0;
function currentNeedKey(){return currentFactor==='need'?focusKeys[currentFocus]:currentFactor}
function updateFocusFeedback(data,key){
 const el=document.getElementById('focusFeedback');if(!el)return;
 if(key==='need'){el.textContent='Showing original balanced priority (existing need_score).';return}
 const features=Array.isArray(data?.features)?data.features:[];
 const keysToTry=cfg[key].fields;
 let count=0,missing=0,min=Infinity,max=-Infinity;
 for(const f of features){const v=first(f.properties||{},keysToTry);if(v===null||v===''||!Number.isFinite(Number(v))){missing++;continue}const score=Number(v);count++;min=Math.min(min,score);max=Math.max(max,score)}
 el.textContent=count?('Showing '+count.toLocaleString('en-AU')+' scored grid cells · score range '+min.toFixed(2)+'–'+max.toFixed(2)+(missing?' · '+missing+' unscored':'')+'.'):('No recognised focus score found. Expected: '+keysToTry[0]+'. Verify field names in your GeoJSON.');
}
function visible(k){return !!(registry[k]&&map.hasLayer(registry[k].layer))}
function remove(k){if(visible(k))map.removeLayer(registry[k].layer)}
function li(color,label){return `<div class="legend-item"><span class="swatch" style="background:${color}"></span><span>${label}</span></div>`}
function updateMapContext(){
 const el=document.getElementById('mapContext');if(!el)return;
 if(currentMode==='roofs')el.textContent=(currentFocus==='balanced'?'Original rooftop screening priority':cfg[focusKeys[currentFocus]].title)+' · candidate rooftops';
 else if(currentMode==='scenarios')el.textContent=focusNames[currentFocus]+' · Scenario '+currentScenario+' · modelled surface cooling';
 else el.textContent=(cfg[currentNeedKey()]?.title||'Cooling need')+' · 250 m grid';
}
function updateLegend(){
 const key=currentMode==='roofs'?'candidates':currentMode==='scenarios'?currentScenarioKey():currentNeedKey();
 const el=document.getElementById('legend');
 if(key==='candidates'){
    if(currentFocus==='balanced'){
      el.innerHTML='<div class="legend-title">Original rooftop screening priority</div><div class="legend-subtitle">Building-level assessment</div>'+
        li('#7f0000','Very High')+li('#d7301f','High')+li('#fc8d59','Moderate')+li('#fdbb84','Low')+li('#fee8c8','Very Low');
    }else{
      el.innerHTML='<div class="legend-title">'+esc(cfg[focusKeys[currentFocus]].title)+'</div><div class="legend-subtitle">Joined grid need on screened rooftops</div>'+
        cfg.need.palette.map((color,i)=>li(color,(i+1)+(i===0?' — Low':i===4?' — High':''))).join('')+
        li('#abb5b0','Not assessed')+li('#92999c','Incomplete data');
    }
 }else if(cfg[key]?.kind==='scenario'){
    el.innerHTML='<div class="legend-title">'+esc(cfg[key].title)+'</div><div class="legend-subtitle">Modelled cooling (°C)</div>'+
      li('#d7e7fb','&lt;1.0')+li('#a4c8f0','1.0–&lt;1.8')+li('#6a9cdb','1.8–&lt;2.6')+li('#2767b3','2.6–&lt;3.4')+li('#103e86','≥3.4')+li('#aab2b8','No modelled value');
 }else if(cfg[key].kind==='weighted'){
    const c=cfg[key];
    el.innerHTML='<div class="legend-title">'+esc(c.title)+'</div><div class="legend-subtitle">'+esc(c.subtitle)+'</div>'+
      cfg.need.palette.map((color,i)=>li(color,(i+1)+(i===0?' — Low':i===4?' — High':''))).join('')+
      li('#abb5b0','Not assessed')+li('#92999c','Incomplete data');
 }else{
    const c=cfg[key];
    el.innerHTML='<div class="legend-title">'+esc(c.title)+'</div><div class="legend-subtitle">'+esc(c.subtitle)+'</div>'+
       c.palette.map((color,i)=>li(color,(i+1)+(i===0?' — Low':i===4?' — High':''))).join('')+li('#abb5b0','Not assessed')+li('#92999c','Incomplete data');
 }
}
function updateScenarioMetrics(data){
  const items=Array.isArray(data?.features)?data.features:[];
  const coolValues=items.map(f=>first(f.properties||{},['cooling_C','Cooling_C','cooling_c']))
    .filter(v=>v!==null&&v!==undefined&&v!=='').map(Number).filter(v=>Number.isFinite(v)&&v>0);
  const changes=items.map(f=>{
    const p=f.properties||{};
    const before=first(p,['LST_mean']);
    const after=first(p,['scenario_LST']);
    if(before===null||after===null)return null;
    const b=Number(before),a=Number(after);
    return Number.isFinite(b)&&Number.isFinite(a)&&a<b?b-a:null;
  }).filter(v=>v!==null);
  const fmtN=new Intl.NumberFormat('en-AU');
  document.getElementById('scenarioCells').textContent=fmtN.format(items.length);
  document.getElementById('scenarioModelled').textContent=fmtN.format(coolValues.length);
  const affectedDrops=changes.length?changes:coolValues; // Legacy balanced files may only store cooling_C.
  document.getElementById('scenarioMean').textContent=affectedDrops.length?(affectedDrops.reduce((a,b)=>a+b,0)/affectedDrops.length).toFixed(2)+' °C':'Not available';
}
function setModeUi(){
 document.getElementById('scenarioResults').classList.toggle('hidden',currentMode!=='scenarios');
 document.getElementById('roofGuide').classList.toggle('hidden',currentMode!=='roofs'||!!selectedRoofLayer);
 updateMapContext();
 modes.forEach(mode=>{
  document.getElementById(mode==='need'?'needControls':mode==='roofs'?'roofControls':'scenarioControls').classList.toggle('hidden',mode!==currentMode);
 });
 document.querySelectorAll('[data-mode]').forEach(el=>{
   const selected=el.dataset.mode===currentMode;
   el.classList.toggle('active',selected);
   if(selected)el.setAttribute('aria-current','step');else el.removeAttribute('aria-current');
 });
 document.getElementById('focusSelector').classList.toggle('hidden',currentFactor!=='need');
 document.querySelectorAll('input[name=roofFocus], input[name=scenarioFocus]').forEach(el=>el.checked=el.value===currentFocus);
 const key='scenario'+currentScenario;
 document.getElementById('scenarioSlider').value=currentScenario;
 document.getElementById('scenarioTitle').textContent=focusNames[currentFocus]+' · '+scenarioInfo[key][0];
 document.getElementById('scenarioHelp').textContent=scenarioInfo[key][1];
}
async function renderMode(){
 const seq=++requestVersion;
 keys.forEach(remove);
 closeRoofPanel();
 const key=currentMode==='need'?currentNeedKey():currentMode==='roofs'?'candidates':currentScenarioKey();
 if(currentMode==='scenarios')clearScenarioMetrics();
 updateLegend();
 try{
   const target=await ensure(key);
   if(seq!==requestVersion)return;
   target.layer.addTo(map);
   if(currentMode==='scenarios'&&target.featureData)updateScenarioMetrics(target.featureData);
   if(currentMode==='need'&&currentFactor==='need')updateFocusFeedback(target.featureData||target.rawData,key);
   if(visible('boundary'))registry.boundary.layer.bringToFront();
   if(key==='candidates')target.layer.bringToFront();
   updateLegend();
 }catch(err){
   if(seq!==requestVersion)return;
   console.error(err);alert('Could not load the selected map layer. Check the data files and try again.');
 }
}
function changeMode(mode){
 if(!modes.includes(mode))return;
 currentMode=mode;setModeUi();renderMode();
}
async function init(){
 try{
  const boundary=await ensure('boundary');
  boundary.layer.addTo(map);
  if(studyBounds&&studyBounds.isValid())map.fitBounds(studyBounds,{padding:[24,24]});
  setModeUi();
  await renderMode();
 }catch(e){console.error(e);map.setView(CENTER,12)}
}
document.querySelectorAll('[data-mode]').forEach(el=>el.addEventListener('click',()=>changeMode(el.dataset.mode)));
document.querySelectorAll('[data-next-mode]').forEach(el=>el.addEventListener('click',()=>changeMode(el.dataset.nextMode)));
document.querySelectorAll('input[name=factor]').forEach(el=>el.addEventListener('change',()=>{
 if(!el.checked)return;currentFactor=el.value;changeMode('need');
}));
document.querySelectorAll('input[name=focus]').forEach(el=>el.addEventListener('change',()=>{
 if(!el.checked)return;currentFocus=el.value;currentFactor='need';
 document.querySelector('input[name=factor][value=need]').checked=true;
 changeMode('need');
}));
document.querySelectorAll('input[name=roofFocus]').forEach(el=>el.addEventListener('change',()=>{
 if(!el.checked)return;
 currentFocus=el.value;
 document.querySelectorAll('input[name=focus]').forEach(item=>item.checked=item.value===currentFocus);
 restyleRoofs();updateMapContext();updateLegend();
}));
document.querySelectorAll('input[name=scenarioFocus]').forEach(el=>el.addEventListener('change',()=>{
 if(!el.checked)return;
 currentFocus=el.value;
 document.querySelectorAll('input[name=focus],input[name=roofFocus]').forEach(item=>item.checked=item.value===currentFocus);
 setModeUi();renderMode();
}));
document.getElementById('scenarioSlider').addEventListener('input',e=>{
 currentScenario=Number(e.target.value);setModeUi();renderMode();
});
document.getElementById('backToNeed').addEventListener('click',()=>changeMode('need'));
document.getElementById('resetBtn').addEventListener('click',()=>studyBounds&&studyBounds.isValid()?map.fitBounds(studyBounds,{padding:[24,24]}):map.setView(CENTER,12));
document.getElementById('closeRoofPanel').addEventListener('click',closeRoofPanel);

document.getElementById('toggleAllBtn').addEventListener('click',()=>{
  showingAll=!showingAll;
  document.querySelectorAll('#roofAttributes .extra').forEach(el=>el.classList.toggle('hidden',!showingAll));
  document.getElementById('toggleAllBtn').textContent=showingAll?'Show less':'Show all';
});

const modal=document.getElementById('aboutModal');
document.getElementById('aboutBtn').addEventListener('click',()=>modal.classList.remove('hidden'));
document.getElementById('closeAbout').addEventListener('click',()=>modal.classList.add('hidden'));
modal.addEventListener('click',e=>{if(e.target===modal)modal.classList.add('hidden')});
const helpModal=document.getElementById('helpModal');
document.getElementById('helpBtn').addEventListener('click',()=>helpModal.classList.remove('hidden'));
document.getElementById('closeHelp').addEventListener('click',()=>helpModal.classList.add('hidden'));
document.getElementById('startExploring').addEventListener('click',()=>{helpModal.classList.add('hidden');changeMode('need')});
helpModal.addEventListener('click',e=>{if(e.target===helpModal)helpModal.classList.add('hidden')});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){modal.classList.add('hidden');helpModal.classList.add('hidden')}});


init();
