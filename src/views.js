import {stages,sources,offers,escape,money,today,shift,dayLabel,total,within,receiptMap,summarize,initials,slug} from "./domain.js";
const areas={
  dashboard:["Visão geral","overview","Acompanhe os leads, as vendas e os retornos."],
  leads:["Leads","leads","Veja a origem e avance o atendimento."],
  follow:["Follow-up","follow","Veja os retornos pendentes e registre o próximo passo."],
  finance:["Financeiro","finance","Comissões, recebimentos e investimento."]
};
const modeLabels={
  dashboard:{painel:"Painel",rotina:"Rotina",desempenho:"Desempenho"},
  leads:{tabela:"Tabela",cartoes:"Cartões",kanban:"Kanban"},
  follow:{lista:"Lista",cartoes:"Cartões",agenda:"Agenda"},
  finance:{tabela:"Tabela",cartoes:"Cartões",resumo:"Resumo"}
};
const modes=key=>Object.keys(modeLabels[key]);
const e=escape;
const icon=(name)=>`<img src="/assets/${name}.svg" alt="" width="16" height="16">`;
const brand=()=>`<img class="brand" src="/assets/brand.svg" alt="Motolab" width="184" height="32">`;
function a(label,action,id="",kind="primary"){
  return `<button type="button" class="button ${kind}" data-action="${e(action)}"${id?` data-id="${e(id)}"`:""}>${e(label)}</button>`;
}
function links(group,items,current){
  return `<div class="segments" role="group" aria-label="${e(({mode:"Visualização",stage:"Etapa",follow:"Prazo",finance:"Área financeira"})[group]??group)}">${Object.entries(items).map(([k,v])=>`<button type="button" data-action="${e(group)}" data-id="${e(k)}" aria-pressed="${k===current}">${e(v)}</button>`).join("")}</div>`;
}
const modeControl=s=>links("mode",modeLabels[s.page],s.modes[s.page]);
const filters=(s,k,v)=>links(k,v,s.filters[k]);
const tag=(label,style="neutral")=>`<span class="tag ${style}"><span aria-hidden="true">●</span>${e(label)}</span>`;
const stageTag=status=>tag(stages[status]??status,({ganho:"green",perdido:"red",acompanhamento:"plum",proposta:"blue",novo:"blue"})[status]??"neutral");
const empty=msg=>`<div class="empty">${e(msg)}</div>`;
const face=name=>`<span class="avatar" aria-hidden="true">${e(initials(name))}</span>`;
const person=(l,link=true)=>`<span class="person">${face(l.name)}<span>${link?a(l.name,"detail",l.id,"link"):`<strong>${e(l.name)}</strong>`}<small>${e(l.motorcycle??"Moto a definir")}</small></span></span>`;
const table=(columns,rows)=>rows.length?`<div class="table-wrap"><table><thead><tr>${columns.map(x=>`<th scope="col">${e(x)}</th>`).join("")}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`:empty("Nenhum registro nesta visualização.");
const panel=(title,inner,extra="",style="")=>`<section class="panel ${style}"><header><h2>${e(title)}</h2>${extra}</header>${inner}</section>`;
const stat=(label,value,context,tone="",ico="")=>`<article class="stat ${tone}">${ico?`<span class="stat-icon">${icon(ico)}</span>`:""}<span>${e(label)}</span><strong>${e(value)}</strong><small>${e(context)}</small></article>`;
const stats=items=>`<div class="stats" style="--count:${items.length}">${items.map(args=>stat(...args)).join("")}</div>`;
const percent=n=>n==null?"—":new Intl.NumberFormat("pt-BR",{style:"percent",maximumFractionDigits:1}).format(n);
function header(s,action="",withRange=false,extra=""){
  const [title,ico,about]=areas[s.page];
  return `<header class="headline"><div class="intro"><span class="identity">${icon(ico)}</span><div><h1>${title}</h1><p>${about}</p></div></div><div class="tools">${extra}${withRange?`<span class="range"><input type="date" aria-label="Início do período" data-range="from" value="${e(s.period.from)}"><input type="date" aria-label="Fim do período" data-range="to" value="${e(s.period.to)}"></span>`:""}${action}</div></header>`;
}
function shell(s,inside){
  const nav=Object.entries(areas).map(([key,[label,ico]])=>`<button class="nav-item nav-${key}" data-action="page" data-id="${key}" ${s.page===key?'aria-current="page"':""}><span>${icon(ico)}</span>${label}</button>`).join("");
  const workspace=s.workspaces.length>1?`<select aria-label="Espaço de trabalho" data-workspace>${s.workspaces.map(w=>`<option value="${e(w.id)}" ${s.workspace.id===w.id?"selected":""}>${e(w.name)}</option>`).join("")}</select>`:`<strong>${e(s.workspace.name)}</strong>`;
  return `<div class="layout"><aside><div class="brand-area">${brand()}</div><div class="team">${face(s.workspace.name)}<span>${workspace}<small>Equipe comercial</small></span></div><nav aria-label="Menu principal">${nav}</nav><div class="account">${a("Sair","signout","","quiet")}</div></aside><div class="shell"><div class="topbar"><span>Motolab / <strong>${areas[s.page][0]}</strong></span><span>${s.demo?"Demonstração":dayLabel(today(),true)}<button class="mobile-exit" data-action="signout" type="button">Sair</button></span></div><main data-theme="${s.page}">${inside}</main></div></div>`;
}
function login(error="",mode="login"){
  return `<div class="login"><section class="login-art">${brand()}<h1>Controle comercial</h1><p>Leads, retornos e comissões da sua operação.</p><div class="login-preview">${brand()}<div class="preview-grid">${stat("Comissão recebida","R$ 4.850","R$ 2.160 a receber","feature")}${stat("Leads","68","42 qualificados","blue-solid","leads")}</div><div class="mini-bars" aria-hidden="true">${[32,56,68,90].map((h,i)=>`<i style="--h:${h}%"></i><b style="--h:${16+i*5}%"></b>`).join("")}</div><div class="mini-return">${icon("follow")} <b>Retornos de hoje</b><span>5 agendados</span></div></div></section><section class="login-main"><div class="panel login-card">${brand()}<h2>${mode==="setup"?"Configurar Motolab":"Entrar no Motolab"}</h2>${mode==="setup"?`<p>Configure a URL e a chave pública do Supabase no ambiente do projeto.</p><p>Para experimentar com dados fictícios, use <code>VITE_DEMO=true</code> no arquivo de configuração local.</p>`:`<p>Use a conta autorizada da sua equipe.</p><form data-submit="login"><label>E-mail<input name="email" type="email" autocomplete="email" required></label><label>Senha<input name="password" type="password" autocomplete="current-password" required></label><p class="form-error" role="alert">${e(error)}</p><button class="button primary" type="submit">Entrar</button></form>`}</div></section></div>`;
}
const names=(s,id)=>s.data.leads.find(l=>l.id===id);
const campaignName=(s,id)=>s.data.campaigns.find(x=>x.id===id)?.name??"—";
const nextFollow=(s,id)=>s.data.followups.find(x=>x.lead_id===id&&x.state==="pendente");
const statusDate=r=>r.due_on===today()?"Hoje":dayLabel(r.due_on);
const due=(r)=>`${statusDate(r)}${r.due_time?` · ${r.due_time.slice(0,5)}`:""}`;
function agendaItems(s,rows,limit=Infinity){
  return rows.length?`<ol class="agenda-list">${rows.slice(0,limit).map(r=>{const l=names(s,r.lead_id);return l?`<li><div class="time"><small>${statusDate(r)}</small><strong>${e(r.due_time?.slice(0,5)??"—")}</strong></div>${person(l)}<span class="agenda-action">${a("Agendar","schedule",l.id,"quiet")}</span></li>`:"";}).join("")}</ol>`:empty("Nenhum retorno agendado.");
}
const sortDue=(x,y)=>(x.due_on+(x.due_time??"23:59")).localeCompare(y.due_on+(y.due_time??"23:59"));
function currentFollowups(s){
  const d=today(),f=s.filters.follow;
  return s.data.followups.filter(r=>f==="concluidos"?r.state==="concluido":r.state==="pendente"&&(f==="futuros"?r.due_on>d:r.due_on<=d)).sort(sortDue);
}
function colsChart(s,m){
  const len=Math.floor((new Date(s.period.to)-new Date(s.period.from))/86400000)+1;
  const step=Math.max(1,Math.ceil(len/8));
  const buckets=[];
  for(let i=0;i<len;i+=step){
    const sub={from:shift(s.period.from,i),to:shift(s.period.from,Math.min(i+step-1,len-1))};
    buckets.push([sub.from,total(m.receipts.filter(x=>within(x.received_on,sub)),"cents"),total(m.spend.filter(x=>within(x.spent_on,sub)),"media_cents")]);
  }
  const max=Math.max(1,...buckets.flatMap(b=>b.slice(1)));
  return panel("Comissões × investimento",`<div class="legend"><span><i class="green-dot"></i>Comissões</span><span><i class="blue-dot"></i>Tráfego pago</span></div><div class="plot">${buckets.map(([d,p,c])=>`<div class="bar-group"><div class="bars"><i title="${e(money(p))}" aria-label="Comissões em ${dayLabel(d)} ${e(money(p))}" style="--h:${p/max*100}%"></i><b title="${e(money(c))}" aria-label="Mídia em ${dayLabel(d)} ${e(money(c))}" style="--h:${c/max*100}%"></b></div><small>${dayLabel(d)}</small></div>`).join("")}</div>`,"","finance-panel");
}
function origins(m){
  const palette=["#4056ec","#8763dc","#24ad9c","#e57977","#f0a048"];
  const rows=Object.entries(sources).map(([k,label],i)=>({label,color:palette[i],count:m.leads.filter(l=>l.source===k).length})).filter(x=>x.count);
  let at=0;
  const stops=rows.map(x=>{const start=at;at+=x.count/m.leads.length*100;return `${x.color} ${start}% ${at}%`;});
  return panel("Origem dos leads",rows.length?`<p>Canal de entrada no período.</p><div class="donut-layout"><div class="donut" style="--donut:conic-gradient(${stops.join(",")})"><span><strong>${m.leads.length}</strong><small>leads</small></span></div><ul>${rows.map(x=>`<li><i style="background:${x.color}"></i>${x.label}<strong>${x.count}</strong></li>`).join("")}</ul></div>`:empty("A origem aparece quando você cadastra leads."),"","leads-panel");
}
function funnel(m){
  const bars=[["Leads recebidos",m.leads.length],["Qualificados",m.qualified],["Em proposta",m.proposals],["Vendas no período",m.sales.length]];
  const max=Math.max(1,...bars.map(x=>x[1]));
  return panel("Funil comercial",bars.map(([k,n])=>`<div class="meter"><span>${k}</span><b>${n}</b><progress max="${max}" value="${n}" aria-label="${k}"></progress></div>`).join(""));
}
const acquisitionStats=m=>stats([["Investimento",money(m.cost),"Mídia e custos diretos","finance-soft"],["CAC",money(m.cac),`${m.attributed.length} vendas atribuídas`],["Custo por qualificado",money(m.cpl),"Leads atribuídos a anúncios"],["ROI",percent(m.roi),money(m.revenue)+" em comissão atribuída","finance-soft"]]);
function dashboard(s,m){
  const mode=s.modes.dashboard;
  const base=stats([["Comissão recebida",money(m.paid),money(m.pending)+" a receber","feature"],["Leads",String(m.leads.length),`${m.qualified} qualificados`,"blue-solid","leads"],["Vendas",String(m.sales.length),`${m.sales.filter(x=>x.kind==="financiamento").length} financiamentos · ${m.sales.filter(x=>x.kind==="consorcio").length} cotas`,"finance-soft","finance"],["Retornos hoje",String(m.todayCount),`${m.lateCount} atrasados`,"follow-soft","follow"]]);
  const dueRows=s.data.followups.filter(r=>r.state==="pendente").sort(sortDue);
  const rec=[...m.leads].sort((x,y)=>`${y.acquired_on}${y.created_at}`.localeCompare(`${x.acquired_on}${x.created_at}`)).slice(0,3);
  const leads=panel("Leads recentes",table(["Lead","Etapa"],rec.map(l=>[person(l),stageTag(l.stage)])),a("Ver todos","page","leads","quiet"),"leads-recent");
  const returns=panel("Próximos retornos",agendaItems(s,dueRows,mode==="rotina"?8:3),a("Ver fila","page","follow","quiet"),"dashboard-agenda");
  const charts=`<div class="split">${colsChart(s,m)}${origins(m)}</div>`;
  return header(s,a("Novo lead","lead"),true,modeControl(s))+
    (mode==="desempenho"?acquisitionStats(m)+charts+funnel(m):mode==="rotina"?base+returns+leads:base+charts+`<div class="split">${leads}${returns}</div>`+funnel(m));
}
function leadsView(s){
  const q=slug(s.filters.search);
  const filter=s.filters.stage;
  const list=[...s.data.leads].filter(l=>(filter==="todos"||l.stage===filter)&&slug([l.name,l.phone,l.motorcycle,l.instagram,l.region].join(" ")).includes(q)).sort((x,y)=>y.acquired_on.localeCompare(x.acquired_on)||x.name.localeCompare(y.name));
  const card=l=>`<article class="record"><header>${person(l)}${stageTag(l.stage)}</header><small>${e(sources[l.source])}${l.campaign_id?` · ${e(campaignName(s,l.campaign_id))}`:""}</small><footer><span>${l.region?e(l.region):"Região a definir"}</span>${nextFollow(s,l.id)?`<b>${due(nextFollow(s,l.id))}</b>`:""}</footer></article>`;
  const mode=s.modes.leads;
  const body=mode==="tabela"?panel("Leads",table(["Nome","Origem","Etapa","Próximo retorno"],list.map(l=>[person(l),`${e(sources[l.source])}${l.campaign_id?` · ${e(campaignName(s,l.campaign_id))}`:""}`,stageTag(l.stage),nextFollow(s,l.id)?due(nextFollow(s,l.id)):"—"]))):
    mode==="cartoes"?(list.length?`<div class="cards">${list.map(card).join("")}</div>`:empty("Nenhum lead encontrado.")):
    `<div class="kanban">${[["Novos",["novo"]],["Em andamento",["atendimento","acompanhamento"]],["Proposta",["proposta"]],["Encerrados",["ganho","perdido"]]].map(([label,st])=>{const rows=list.filter(l=>st.includes(l.stage));return `<section><header><h2>${label}</h2><span>${rows.length}</span></header>${rows.map(card).join("")}${st[0]==="novo"?a("+ Novo lead","lead","","weak"):""}</section>`;}).join("")}</div>`;
  const search=`<form class="filters" data-submit="search"><input type="search" name="q" aria-label="Buscar lead" placeholder="Buscar nome, telefone ou moto" value="${e(s.filters.search)}"><button class="button secondary" type="submit">Buscar</button>${s.filters.search?a("Limpar","clearSearch","","quiet"):""}</form>`;
  return header(s,a("Novo lead","lead"))+search+
    `<div class="list-tools">${filters(s,"stage",{todos:"Todos",...stages})}${modeControl(s)}</div><div id="lead-results">${body}</div>`;
}
function followView(s,m){
  const mode=s.modes.follow;
  const rows=currentFollowups(s);
  const ref=s.filters.agendaDay;
  const showing=mode==="agenda"?rows.filter(r=>r.due_on===ref):rows;
  const rowcards=r=>{const l=names(s,r.lead_id);return `<article class="record"><header>${person(l)}${tag(statusDate(r),r.due_on<today()?"red":"plum")}</header><p>${e(r.note??"Retomar contato.")}</p><footer><span>${due(r)}</span>${r.state==="pendente"?a("Agendar","schedule",r.lead_id,"weak")+a("Concluir","complete",r.id,"quiet"):""}</footer></article>`;};
  const list=()=>panel("Fila de retornos",table(["Lead","Próximo passo","Prazo","Ações"],showing.map(r=>[person(names(s,r.lead_id)),e(r.note??"Retomar contato."),tag(due(r),r.due_on<today()?"red":"plum"),r.state==="pendente"?a("Agendar","schedule",r.lead_id,"weak")+a("Concluir","complete",r.id,"quiet"):"Concluído"])));
  const week=Array.from({length:7},(_,i)=>shift(ref,i-3));
  const calendar=()=>`<div class="agenda-grid">${panel("Calendário",`<div class="week">${week.map(d=>a(dayLabel(d),"agendaDay",d,ref===d?"weak":"quiet")).join("")}</div><input type="date" data-agenda aria-label="Dia da agenda" value="${e(ref)}">`)}${panel("Agenda · "+dayLabel(ref,true),agendaItems(s,showing))}</div>`;
  return header(s)+stats([["Atrasados",String(m.lateCount),"Prioridade do dia","danger-soft"],["Para hoje",String(m.todayCount),"Retornos agendados","follow-soft"],["Próximos",String(s.data.followups.filter(r=>r.state==="pendente"&&r.due_on>today()).length),"A partir de amanhã"]])+
    `<div class="list-tools">${filters(s,"follow",{hoje:"Hoje e atrasados",futuros:"Agendados",concluidos:"Concluídos"})}${modeControl(s)}</div>`+
    (mode==="lista"?list():mode==="agenda"?calendar():showing.length?`<div class="cards">${showing.map(rowcards).join("")}</div>`:empty("Nenhum retorno para este filtro."));
}
function finance(s,m){
  const mode=s.modes.finance,paid=receiptMap(s.data.receipts);
  const receipts=s.filters.finance==="comissoes";
  const panels=receipts?stats([["Comissão recebida",money(m.paid),"Todos os canais","finance-soft"],["A receber",money(m.pending),"Vendas do período"],["Investimento em mídia",money(m.adCost),"Tráfego pago"],["Resultado do período",money(m.paid-m.cost),"Recebimentos menos custos","finance-soft"]]):acquisitionStats(m);
  const rs=[...m.sales].sort((a,b)=>b.sold_on.localeCompare(a.sold_on));
  const ps=[...m.spend].sort((a,b)=>b.spent_on.localeCompare(a.spent_on));
  const incomeRow=r=>{const applied=paid.get(r.id)??0;return {applied,state:applied>=r.expected_cents?"Recebida":applied?"Parcial":"Prevista",tone:applied>=r.expected_cents?"green":applied?"plum":"neutral"};};
  const cashCell=r=>{const x=incomeRow(r);return x.tone==="green"?tag(x.state,x.tone):a(x.state,"receipt",r.id,"weak");};
  const rows=receipts?rs.map(r=>[person(names(s,r.lead_id)),e(offers[r.kind]),dayLabel(r.sold_on),money(r.expected_cents),money(paid.get(r.id)??0),cashCell(r)]):ps.map(r=>[e(campaignName(s,r.campaign_id)),dayLabel(r.spent_on),money(r.media_cents),money(r.direct_cents),String(r.conversations),a("Editar","spend",r.id,"quiet")]);
  const columns=receipts?["Lead","Modalidade","Venda","Prevista","Recebida","Situação"]:["Anúncio","Data","Mídia","Outros custos","Conversas","Ações"];
  const cashcards=()=>rs.map(r=>{const x=incomeRow(r);return `<article class="record"><header>${person(names(s,r.lead_id))}${tag(x.state,x.tone)}</header><p>${e(offers[r.kind])} · ${dayLabel(r.sold_on)}</p><footer><span>Prevista ${money(r.expected_cents)}</span><strong>Recebida ${money(x.applied)}</strong></footer>${x.applied<r.expected_cents?a("Registrar recebimento","receipt",r.id,"weak"):""}</article>`;});
  const mediaCards=()=>ps.map(r=>`<article class="record"><header><strong>${e(campaignName(s,r.campaign_id))}</strong>${tag(dayLabel(r.spent_on),"neutral")}</header><footer><span>Mídia ${money(r.media_cents)}</span><span>Outros ${money(r.direct_cents)}</span></footer>${a("Editar lançamento","spend",r.id,"quiet")}</article>`);
  const sumRows=receipts?Object.entries(offers).filter(([k])=>k!=="mista").map(([k,v])=>{const set=rs.filter(x=>x.kind===k);return [v,String(set.length),money(total(set,"expected_cents")),money(set.reduce((n,r)=>n+(paid.get(r.id)??0),0))];}):
    s.data.campaigns.map(c=>{const set=ps.filter(r=>r.campaign_id===c.id);const leads=m.paidLeads.filter(l=>l.campaign_id===c.id);const sold=m.attributed.filter(r=>leads.some(l=>l.id===r.lead_id));return [e(c.name),money(total(set,"media_cents")+total(set,"direct_cents")),String(leads.length),String(sold.length)];});
  const summary=panel(receipts?"Resumo por modalidade":"Resumo por anúncio",table(receipts?["Modalidade","Vendas","Prevista","Recebida acumulada"]:["Anúncio","Investimento","Leads","Vendas atribuídas"],sumRows));
  const action=receipts?a("Registrar recebimento","receipt"):a("Novo anúncio","campaign","","secondary")+a("Lançar gasto","spend");
  return header(s,action,true)+`<div class="list-tools">${filters(s,"finance",{comissoes:"Comissões",trafego:"Tráfego pago"})}${modeControl(s)}</div>`+panels+
    (mode==="resumo"?summary:mode==="cartoes"?(rows.length?`<div class="cards">${(receipts?cashcards():mediaCards()).join("")}</div>`:empty("Nenhum lançamento neste período.")):panel(receipts?"Comissões recentes":"Resultados por anúncio",table(columns,rows)))+
    (!receipts?colsChart(s,m):"");
}
function render(s){
  const m=summarize(s.data,s.period);
  const page={dashboard,leads:leadsView,follow:followView,finance}[s.page];
  return shell(s,page(s,m));
}

export {render,login,modes,a,e,stageTag,person};
