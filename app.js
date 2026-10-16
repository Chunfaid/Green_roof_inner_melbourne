const CENTER=[-37.8136,144.9631];
const map=L.map('map',{preferCanvas:true}).setView(CENTER,12);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'}).addTo(map);

const cfg={
  boundary:{file:'data/Project_boundaries.geojson',kind:'boundary',title:'Project Boundary'},
  population:{file:'data/Population_density.geojson',kind:'factor',fields:['pop_score','population_score','score'],title:'Population Density',subtitle:'Higher score = greater population exposure',palette:['#eff3ff','#bdd7e7','#6baed6','#3182bd','#08519c']},
  seifa:{file:'data/Socioeconomic_index.geojson',kind:'factor',fields:['vuln_score','Vulnerabil','vulnerability','SEIFA_score','SEIFA scor','seifa_score','score'],title:'Socioeconomic Disadvantage (SEIFA IRSD)',subtitle:'Higher score = greater socioeconomic vulnerability',palette:['#f2f0f7','#cbc9e2','#9e9ac8','#756bb1','#54278f']},
  ndvi:{file:'data/NDVI.geojson',kind:'factor',fields:['NDVI_score','ndvi_score','score'],title:'Vegetation Need (NDVI)',subtitle:'Higher score = lower greenness / greater greening need',palette:['#e5f5e0','#a1d99b','#74c476','#fdcc8a','#e34a33']},
  lst:{file:'data/land_surface_temperture.geojson',kind:'factor',fields:['LST_score','lst_score','score'],title:'Land Surface Temperature',subtitle:'Higher score = hotter surface conditions',palette:['#ffffcc','#fed976','#feb24c','#fd8d3c','#bd0026']},
  need:{file:'data/green_roof_neeed_score.geojson',kind:'need',fields:['need_score','score'],title:'Green Roof Intervention Need',subtitle:'Combined score from low to high intervention need',palette:['#ffffcc','#fed976','#fd8d3c','#f03b20','#bd0026']},
  candidates:{file:'data/greenroof_candidate.geojson',kind:'candidate',title:'Green Roof Candidates'},
  scenario1:{file:'data/Scenario_1_priority.geojson',kind:'scenario',title:'Scenario 1 — Priority',subtitle:'Very High priority roofs'},
  scenario2:{file:'data/Scenario_2_targeted.geojson',kind:'scenario',title:'Scenario 2 — Targeted',subtitle:'Very High + High priority roofs'},
  scenario3:{file:'data/Scenario_3_Board.geojson',kind:'scenario',title:'Scenario 3 — Broad',subtitle:'Very High + High + Moderate priority roofs'}
};

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
function colorFromScore(v,palette){const i=scoreIndex(v);return i===null?'#d9d9d9':palette[i]}
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
function coolingColor(v){const x=n(v);if(x===null)return'#d9d9d9';if(x<1)return'#eff3ff';if(x<1.8)return'#bdd7e7';if(x<2.6)return'#6baed6';if(x<3.4)return'#3182bd';return'#08519c'}

function style(kind,p,c){
  if(kind==='boundary')return{color:'#245b4a',weight:2.3,fillOpacity:0};
  if(kind==='factor'||kind==='need'){const value=factorValue(p,c);return{color:'rgba(255,255,255,.65)',weight:.20,fillColor:colorFromScore(value,c.palette),fillOpacity:kind==='need'?.82:.85}}
  if(kind==='candidate'){
    const pr=first(p,['priority c','priority_c','priority','Priority']);
    return{
      color:'#4a332c',
      weight:.45,
      fillColor:priorityColor(pr),
      fillOpacity:.90
    };
  }
  if(kind==='scenario'){const value=first(p,['cooling_C','Cooling_C','cooling_c']);return{color:'rgba(255,255,255,.65)',weight:.35,fillColor:coolingColor(value),fillOpacity:value===null?.08:.82}}
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
    registry[key]={layer,c,featureData:c.kind==='scenario'?data:null};
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
  const value=c.fields?factorValue(p,c):first(p,['cooling_C','Cooling_C','cooling_c','gr_percentage']);
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

  summary.innerHTML=`
    ${priority!==null?`<span class="priority-badge" style="background:${priorityColor(priority)}">${esc(priorityClass(priority))} priority</span>`:''}
    <div class="summary-grid">
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
}


const modes=['need','roofs','scenarios'];
const keys=['population','seifa','ndvi','lst','need','candidates','scenario1','scenario2','scenario3'];
const scenarioInfo={
  scenario1:['Scenario 1 — Priority','Very High priority areas only.'],
  scenario2:['Scenario 2 — Targeted','Very High and High priority areas.'],
  scenario3:['Scenario 3 — Broad','Very High, High and Moderate priority areas.']
};
let currentMode='need',currentFactor='need',currentScenario=1,requestVersion=0;
function visible(k){return !!(registry[k]&&map.hasLayer(registry[k].layer))}
function remove(k){if(visible(k))map.removeLayer(registry[k].layer)}
function li(color,label){return `<div class="legend-item"><span class="swatch" style="background:${color}"></span><span>${label}</span></div>`}
function updateLegend(){
 const key=currentMode==='roofs'?'candidates':currentMode==='scenarios'?'scenario'+currentScenario:currentFactor;
 const el=document.getElementById('legend');
 if(key==='candidates'){
    el.innerHTML='<div class="legend-title">Rooftop screening priority</div><div class="legend-subtitle">Building-level candidates</div>'+
      li('#7f0000','Very High')+li('#d7301f','High')+li('#fc8d59','Moderate')+li('#fdbb84','Low')+li('#fee8c8','Very Low');
 }else if(key.startsWith('scenario')){
    el.innerHTML='<div class="legend-title">'+esc(cfg[key].title)+'</div><div class="legend-subtitle">Modelled cooling (°C)</div>'+
      li('#eff3ff','&lt;1.0')+li('#bdd7e7','1.0–&lt;1.8')+li('#6baed6','1.8–&lt;2.6')+li('#3182bd','2.6–&lt;3.4')+li('#08519c','≥3.4')+li('#d9d9d9','No modelled value');
 }else{
    const c=cfg[key];
    el.innerHTML='<div class="legend-title">'+esc(c.title)+'</div><div class="legend-subtitle">'+esc(c.subtitle)+'</div>'+
       c.palette.map((color,i)=>li(color,(i+1)+(i===0?' — Low':i===4?' — High':''))).join('')+li('#d9d9d9','Not assessed');
 }
}
function updateScenarioMetrics(data){
  const items=Array.isArray(data?.features)?data.features:[];
  const vals=items.map(f=>first(f.properties||{},['cooling_C','Cooling_C','cooling_c']))
    .filter(v=>v!==null&&v!==undefined&&v!=='')
    .map(Number).filter(Number.isFinite);
  const fmtN=new Intl.NumberFormat('en-AU');
  document.getElementById('scenarioCells').textContent=fmtN.format(items.length);
  document.getElementById('scenarioModelled').textContent=fmtN.format(vals.length);
  document.getElementById('scenarioMean').textContent=vals.length?(vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(2)+' °C':'Not available';
}
function setModeUi(){
 modes.forEach(mode=>{
  document.getElementById(mode==='need'?'needControls':mode==='roofs'?'roofControls':'scenarioControls').classList.toggle('hidden',mode!==currentMode);
 });
 document.querySelectorAll('[data-mode]').forEach(el=>{
   const selected=el.dataset.mode===currentMode;
   el.classList.toggle('active',selected);
   if(selected)el.setAttribute('aria-current','step');else el.removeAttribute('aria-current');
 });
 const key='scenario'+currentScenario;
 document.getElementById('scenarioSlider').value=currentScenario;
 document.getElementById('scenarioTitle').textContent=scenarioInfo[key][0];
 document.getElementById('scenarioHelp').textContent=scenarioInfo[key][1];
}
async function renderMode(){
 const seq=++requestVersion;
 keys.forEach(remove);
 closeRoofPanel();
 const key=currentMode==='need'?currentFactor:currentMode==='roofs'?'candidates':'scenario'+currentScenario;
 updateLegend();
 try{
   const target=await ensure(key);
   if(seq!==requestVersion)return;
   target.layer.addTo(map);
   if(currentMode==='scenarios'&&target.featureData)updateScenarioMetrics(target.featureData);
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
document.querySelectorAll('input[name=factor]').forEach(el=>el.addEventListener('change',()=>{
 if(!el.checked)return;currentFactor=el.value;changeMode('need');
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

init();
