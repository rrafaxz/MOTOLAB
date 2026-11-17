import "@fontsource-variable/inter";
import "./styles.css";
import {createClient} from "@supabase/supabase-js";
import {stages,sources,offers,today,shift,dayLabel,phone,cents,money,isOpen,receiptMap} from "./domain.js";
import {render,login,modes,a,e,stageTag} from "./views.js";
import {remote,demo,result} from "./api.js";
const app=document.querySelector("#app");
const dialog=document.querySelector("#dialog");
const message=document.querySelector("#notice");
const env=import.meta.env;
const configured=!!(env.VITE_SUPABASE_URL&&env.VITE_SUPABASE_PUBLISHABLE_KEY);
const demoMode=!env.VITE_SUPABASE_URL&&!env.VITE_SUPABASE_PUBLISHABLE_KEY&&env.VITE_DEMO==="true";
const db=configured?createClient(env.VITE_SUPABASE_URL,env.VITE_SUPABASE_PUBLISHABLE_KEY):null;
const date=today();
const defaults={dashboard:"painel",leads:"tabela",follow:"lista",finance:"tabela"};
let remembered={};
try{remembered=JSON.parse(localStorage.getItem("motolab-views")??"{}");}catch{}
const s={page:"dashboard",modes:Object.fromEntries(Object.keys(defaults).map(k=>[k,modes(k).includes(remembered[k])?remembered[k]:defaults[k]])),
  period:{from:date.slice(0,7)+"-01",to:date},filters:{stage:"todos",search:"",follow:"hoje",agendaDay:date,finance:"comissoes"},
  demo:demoMode,workspace:null,workspaces:[],data:null};
let repo, refreshToken=0, notification, modalToken=0;
const fromLead=id=>s.data?.leads.find(l=>l.id===id);
const campaignChoices=()=>Object.fromEntries((s.data?.campaigns??[]).map(r=>[r.id,`${r.name} · ${offers[r.offer]}`]));
const text=val=>String(val??"").trim();
const clean=val=>text(val)||null;
const commandError=err=>err instanceof Error?err.message:String(err);
function notify(value,style="success"){
  clearTimeout(notification);message.textContent=value;message.dataset.style=style;
  notification=setTimeout(()=>{message.textContent="";},5000);
}
function refreshView(){if(s.workspace&&s.data)app.innerHTML=render(s);}
async function refresh(){
  const n=++refreshToken, captured=repo;
  const data=await captured.load();
  if(n===refreshToken&&captured===repo){s.data=data;refreshView();}
}
function reset(){
  ++refreshToken;
  s.workspace=null;s.data=null;repo=null;
  if(dialog.open)dialog.close();
  app.innerHTML=login();
}
async function start(user){
  if(!user&&!demoMode){reset();return;}
  s.workspaces=demoMode?[{id:"demo",name:"Gabriel Honda"}]:
    await result(db.from("ml_workspaces").select("id,name").order("name"));
  if(!s.workspaces.length){app.innerHTML=login("A conta está ativa. Falta vincular seu usuário ao espaço Motolab.");return;}
  const prior=localStorage.getItem("motolab-workspace");
  await chooseWorkspace(s.workspaces.find(w=>w.id===prior)??s.workspaces[0]);
}
async function chooseWorkspace(workspace){
  s.workspace=workspace;localStorage.setItem("motolab-workspace",workspace.id);
  repo=demoMode?demo():remote(db,workspace.id);s.data=null;
  app.innerHTML='<div class="loading" role="status">Carregando registros…</div>';
  await refresh();
}
function select(name,label,options,value="",required=false,placeholder="Selecione"){
  return `<label>${e(label)}<select name="${name}" ${required?"required":""}><option value="">${e(placeholder)}</option>${Object.entries(options).map(([k,v])=>`<option value="${e(k)}" ${String(k)===String(value)?"selected":""}>${e(v)}</option>`).join("")}</select></label>`;
}
function input(name,label,value="",type="text",extras=""){
  return `<label>${e(label)}<input name="${name}" type="${type}" value="${e(value??"")}" ${extras}></label>`;
}
function note(name,label,value="",max=1000){
  return `<label>${e(label)}<textarea name="${name}" rows="3" maxlength="${max}">${e(value??"")}</textarea></label>`;
}
function modal(title,sub,content,options={}){
  modalToken++;
  const action=options.action??null;
  const inner=action?`<form data-submit="${action}" data-id="${e(options.id??"")}">${content}<p class="form-error" role="alert"></p><footer class="dialog-foot">${options.extra??""}<div>${a("Cancelar","close","","secondary")} <button class="button primary" type="submit">${e(options.label??"Salvar")}</button></div></footer></form>`:content;
  dialog.innerHTML=`<article><header><div><h2 id="dialog-title">${e(title)}</h2>${sub?`<p>${e(sub)}</p>`:""}</div><button type="button" class="icon-button" data-action="close" aria-label="Fechar">×</button></header>${inner}</article>`;
  if(!dialog.open)dialog.showModal();
  return modalToken;
}
function editLead(id){
  const l=fromLead(id)??{};
  const locked=l.stage==="ganho";
  const stageList=locked?{ganho:"Ganho"}:Object.fromEntries(Object.entries(stages).filter(([key])=>key!=="ganho"));
  const contact=input("name","Nome",l.name,"text","required maxlength=120")+input("phone","Telefone ou WhatsApp",l.phone?`+${l.phone}`:"","tel","maxlength=30")+
    input("instagram","Instagram",l.instagram,"text","maxlength=31")+input("motorcycle","Moto de interesse",l.motorcycle,"text","maxlength=120");
  const extra=`<div class="form-grid">${input("region","Região",l.region,"text","maxlength=120")}${select("stage","Etapa",stageList,l.stage??"novo",true)}
    ${input("reason","Motivo de perda ou pendência",l.outcome_reason,"text","maxlength=300")}<label class="check"><input type="checkbox" name="qualified" ${l.qualified?"checked":""}> Lead qualificado</label></div>${note("notes","Observações",l.notes,4000)}`;
  const source=`<div class="form-grid">${select("source","Origem",sources,l.source??"outro",true)}${select("campaign","Anúncio de origem",campaignChoices(),l.campaign_id??"",false,"Sem anúncio identificado")}</div>`;
  modal(id?"Editar lead":"Novo lead","Digite pelo menos um telefone ou Instagram.",
    `<div class="form-grid">${contact}</div>${locked?"":source}<details ${id?"open":""}><summary>Etapa, região e observações</summary>${extra}</details>`,
    {action:"lead",id,label:id?"Salvar alterações":"Criar lead"});
  if(!locked)syncCampaign(dialog.querySelector("form"));
}
function syncCampaign(form){
  const enabled=form.elements.source.value==="meta";
  if(!enabled)form.elements.campaign.value="";
  form.elements.campaign.disabled=!enabled;
}
function schedule(id){
  const l=fromLead(id);
  if(!l||!isOpen(l))throw Error("Selecione um lead em aberto.");
  const r=s.data.followups.find(x=>x.lead_id===id&&x.state==="pendente");
  const presets=`<div class="segments presets" aria-label="Prazo de retorno">${[[7,"1 semana"],[14,"2 semanas"],[1,"1 mês"],[2,"2 meses"],[3,"3 meses"],[4,"4 meses"]].map(([n,label],i)=>a(label,"preset",`${i<2?"days":"months"}:${n}`,"quiet")).join("")}</div>`;
  modal("Agendar retorno",`${l.name} · ${l.motorcycle??"Moto a definir"}`,presets+
    `<div class="form-grid">${input("due_on","Data de retorno",r?.due_on??shift(today(),7),"date","required")}${input("due_time","Horário (opcional)",r?.due_time?.slice(0,5)??"","time")}</div>${note("note","Próximo passo (opcional)",r?.note)}`,
    {action:"schedule",id,label:"Agendar retorno"});
}
function sale(id){
  const l=fromLead(id);
  if(!l||!isOpen(l))throw Error("Selecione um lead em aberto.");
  modal("Registrar venda",l.name,`<div class="form-grid">${select("kind","Modalidade",{financiamento:offers.financiamento,consorcio:offers.consorcio,avista:offers.avista},"",true)}
    ${input("sold_on","Data da venda",today(),"date","required")}${input("expected","Comissão prevista","0,00","text","inputmode=decimal required")}${input("reason","O que ajudou a fechar?","","text","required maxlength=300")}</div>`,
    {action:"sale",id,label:"Registrar venda"});
}
function receipt(id){
  const map=receiptMap(s.data.receipts);
  const available=s.data.sales.filter(x=>(map.get(x.id)??0)<x.expected_cents);
  if(!available.length){modal("Registrar recebimento","",'<p class="empty">Nenhuma venda com comissão em aberto.</p>');return;}
  const options=Object.fromEntries(available.map(x=>[x.id,`${fromLead(x.lead_id)?.name??"Venda"} · ${money(x.expected_cents-(map.get(x.id)??0))} pendentes`]));
  modal("Registrar recebimento","Vincule o pagamento à comissão da venda.",
    `<div class="form-grid">${select("sale_id","Venda",options,options[id]?id:"",true)}${input("received_on","Data do recebimento",today(),"date","required")}${input("value","Valor recebido","","text","inputmode=decimal required")}${input("note","Observação (opcional)","","text","maxlength=500")}</div>`,
    {action:"receipt",label:"Salvar recebimento"});
}
function spend(id){
  const c=s.data.spend.find(x=>x.id===id),choices=campaignChoices();
  if(!Object.keys(choices).length){campaign();return;}
  const f=(n,label,value)=>input(n,label,value==null?"":(value/100).toFixed(2).replace(".",","),"text","inputmode=decimal");
  modal(c?"Editar gasto":"Lançar gasto",c?"Atualize os valores do dia.":"Registre a mídia e os custos diretos do anúncio.",
    `<div class="form-grid">${c?`<div><strong>${e(choices[c.campaign_id])}</strong><p>${dayLabel(c.spent_on,true)}</p></div>`:select("campaign_id","Anúncio",choices,"",true)+input("spent_on","Data do gasto",today(),"date","required")}
    ${f("media","Mídia",c?.media_cents)}${f("direct","Outros custos diretos",c?.direct_cents)}${input("conversations","Conversas da Meta",c?.conversations??0,"number","min=0 max=1000000 step=1")}</div>`,
    {action:"spend",id,label:"Salvar gasto",extra:c?"":a("Novo anúncio","campaign","","quiet")});
}
function campaign(){
  modal("Novo anúncio","Crie uma referência para ligar leads, gastos e vendas.",
    `<div class="form-grid">${input("name","Nome do anúncio","","text","required minlength=2 maxlength=160")}${select("offer","Oferta",{financiamento:offers.financiamento,consorcio:offers.consorcio,mista:offers.mista},"",true)}</div>`,
    {action:"campaign",label:"Criar anúncio"});
}
async function detail(id){
  const l=fromLead(id);if(!l)throw Error("Lead não encontrado.");
  const link=l.phone?`<a href="https://wa.me/${e(l.phone)}" class="button whatsapp" target="_blank" rel="noopener noreferrer">Abrir WhatsApp</a>`:"";
  const ig=l.instagram?`<a href="https://www.instagram.com/${e(l.instagram)}/" target="_blank" rel="noopener noreferrer">@${e(l.instagram)}</a>`:"—";
  const list=s.data.followups.filter(r=>r.lead_id===id).sort((a,b)=>b.due_on.localeCompare(a.due_on));
  const closed=s.data.sales.find(x=>x.lead_id===id);
  const show=modal(l.name,`${l.motorcycle??"Moto a definir"} · ${l.region??"Região a definir"}`,
    `<div class="detail"><div>${stageTag(l.stage)} ${l.qualified?"· Qualificado":""}</div><dl><dt>Telefone</dt><dd>${l.phone?`<a href="https://wa.me/${e(l.phone)}" target="_blank" rel="noopener noreferrer">+${e(l.phone)}</a>`:"—"}</dd><dt>Instagram</dt><dd>${ig}</dd><dt>Origem</dt><dd>${e(sources[l.source])}${l.campaign_id?` · ${e(campaignChoices()[l.campaign_id]??"")}`:""}</dd><dt>Motivo registrado</dt><dd>${e(l.outcome_reason??"—")}</dd></dl>
    ${l.notes?`<p>${e(l.notes)}</p>`:""}<div class="inline-actions">${link}${a("Editar lead","lead",id,"secondary")}${isOpen(l)?a("Agendar retorno","schedule",id,"weak")+a("Registrar venda","sale",id):closed?a("Recebimento","receipt",closed.id):""}</div>
    <h3>Histórico de retornos</h3>${list.length?`<ul class="history">${list.map(r=>`<li><strong>${dayLabel(r.due_on,true)} ${e(r.due_time?.slice(0,5)??"")}</strong><span>${e(r.state)} · ${e(r.note??"Retomar contato")}</span></li>`).join("")}</ul>`:"<p>Nenhum retorno registrado.</p>"}
    <h3>Evidências</h3>${demoMode?"<p>Disponíveis com Supabase configurado.</p>":`<form class="filters" data-submit="upload" data-id="${e(id)}"><label>Anexar evidência<input type="file" name="file" accept="image/jpeg,image/png,image/webp,application/pdf" required></label><button class="button secondary" type="submit">Enviar</button><p class="form-error" role="alert"></p></form><div id="evidence" role="status">Carregando anexos…</div>`}</div>`);
  if(!demoMode){
    let files;
    try{files=await repo.listFiles(id);}catch{files=null;}
    if(show!==modalToken||!dialog.open)return;
    const element=dialog.querySelector("#evidence");
    if(!files){element.textContent="Falha ao consultar os anexos.";return;}
    element.innerHTML=files.length?`<ul class="history">${files.map(x=>`<li><button class="button link" data-action="file" data-id="${e(id)}" data-file="${e(x.name)}">${e(x.name.replace(/^[a-f0-9-]{36}-/i,""))}</button></li>`).join("")}</ul>`:"Nenhum anexo.";
  }
}
const ui={lead:editLead,schedule,sale,receipt,spend,campaign,detail,
  close(){dialog.close();},
  page(id){if(id in defaults){s.page=id;refreshView();window.scrollTo({top:0});}},
  mode(id){if(modes(s.page).includes(id)){s.modes[s.page]=id;localStorage.setItem("motolab-views",JSON.stringify(s.modes));refreshView();}},
  stage(id){s.filters.stage=id;refreshView();},
  follow(id){s.filters.follow=id;refreshView();},
  finance(id){s.filters.finance=id;refreshView();},
  agendaDay(id){s.filters.agendaDay=id;refreshView();},
  clearSearch(){s.filters.search="";refreshView();},
  preset(id){const [unit,n]=id.split(":");dialog.querySelector('[name="due_on"]').value=shift(today(),Number(n),unit);},
  async complete(id){await repo.complete(id);await refresh();notify("Retorno concluído.");},
  async signout(){if(demoMode){notify("Você está na demonstração local.");return;}await result(db.auth.signOut());reset();},
  async file(id,element){
    const windowRef=window.open("about:blank","_blank");
    if(windowRef)windowRef.opener=null;
    try{const url=await repo.signed(id,element.dataset.file);if(windowRef)windowRef.location.replace(url);else window.location.assign(url);}
    catch(error){windowRef?.close();throw error;}
  }
};
const workflows={
  async lead(f,id){
    const old=fromLead(id),ph=phone(f.phone),ig=clean(text(f.instagram).replace(/^@/,""));
    if(!ph&&!ig)throw Error("Informe telefone ou Instagram.");
    if(ig&&!/^[a-z0-9_.]{1,30}$/i.test(ig))throw Error("Confira o @ do Instagram.");
    if(text(f.name).length<2)throw Error("Informe o nome do lead.");
    if(f.stage==="perdido"&&!clean(f.reason))throw Error("Registre o motivo da perda.");
    const source=old?.stage==="ganho"?old.source:f.source;
    const campaign=old?.stage==="ganho"?old.campaign_id:source==="meta"?clean(f.campaign):null;
    await repo.saveLead(id,{name:text(f.name),phone:ph,instagram:ig,motorcycle:clean(f.motorcycle),
      region:clean(f.region),source,campaign_id:campaign,stage:f.stage,
      qualified:f.qualified==="on",outcome_reason:clean(f.reason),notes:clean(f.notes)});
    return id?"Lead atualizado.":"Lead criado.";
  },
  async schedule(f,id){
    await repo.schedule(id,{due_on:f.due_on,due_time:clean(f.due_time),note:clean(f.note)});
    return "Retorno agendado.";
  },
  async sale(f,id){
    await repo.sale({lead_id:id,sold_on:f.sold_on,kind:f.kind,expected_cents:cents(f.expected),reason:text(f.reason)});
    return "Venda registrada. Retornos pendentes foram encerrados.";
  },
  async receipt(f){
    const amount=cents(f.value);
    if(!amount)throw Error("Informe um recebimento maior que zero.");
    await repo.receipt({sale_id:f.sale_id,received_on:f.received_on,cents:amount,note:clean(f.note)});
    return "Recebimento registrado.";
  },
  async spend(f,id){
    const p={media_cents:cents(f.media),direct_cents:cents(f.direct),conversations:Number(f.conversations||0)};
    if(!p.media_cents&&!p.direct_cents)throw Error("Informe o valor investido.");
    if(id)await repo.patchSpend(id,p);else await repo.spend({...p,campaign_id:f.campaign_id,spent_on:f.spent_on});
    return "Gasto registrado.";
  },
  async campaign(f){await repo.campaign({name:text(f.name),offer:f.offer});return "Anúncio criado.";},
  async upload(f,id){await repo.upload(id,f.file);return "Evidência anexada.";}
};
document.addEventListener("click",ev=>{
  const el=ev.target.closest("button[data-action]");if(!el||!ui[el.dataset.action]||el.disabled)return;
  ev.preventDefault();
  const cb=ui[el.dataset.action];
  Promise.resolve().then(()=>cb(el.dataset.id??"",el)).catch(err=>notify(commandError(err),"error"));
});
dialog.addEventListener("click",ev=>{if(ev.target===dialog)dialog.close();});
document.addEventListener("change",ev=>{
  const el=ev.target;
  if(el.dataset.range){
    const next={...s.period,[el.dataset.range]:el.value};
    if(!next.from||!next.to||next.from>next.to){notify("Confira o período selecionado.","error");refreshView();return;}
    s.period=next;refreshView();
  }
  if("agenda" in el.dataset&&el.value){s.filters.agendaDay=el.value;refreshView();}
  if("workspace" in el.dataset)chooseWorkspace(s.workspaces.find(w=>w.id===el.value)).catch(err=>notify(commandError(err),"error"));
  if(el.name==="source"&&el.form?.elements.campaign)syncCampaign(el.form);
});
document.addEventListener("submit",async ev=>{
  const form=ev.target;if(!form.dataset.submit)return;
  ev.preventDefault();
  const action=form.dataset.submit, id=form.dataset.id??"", data=Object.fromEntries(new FormData(form));
  if(action==="search"){s.filters.search=data.q;refreshView();return;}
  if(form.dataset.saving)return;
  const btn=form.querySelector('[type="submit"]'), error=form.querySelector(".form-error");
  form.dataset.saving="1";if(btn)btn.disabled=true;if(error)error.textContent="";
  try{
    if(action==="login"){
      const {user}=await result(db.auth.signInWithPassword({email:text(data.email),password:data.password}));
      await start(user);return;
    }
    const ok=await workflows[action](data,id);
    if(action==="upload"){await detail(id);notify(ok);return;}
    dialog.close();notify(ok);
    try{await refresh();}catch{notify("Registro salvo. Recarregue a página para atualizar os dados.","error");}
  }catch(err){if(error)error.textContent=commandError(err);else notify(commandError(err),"error");}
  finally{delete form.dataset.saving;if(btn)btn.disabled=false;}
});
if(demoMode)start(null).catch(err=>notify(commandError(err),"error"));
else if(!configured)app.innerHTML=login("","setup");
else{
  app.innerHTML=login();
  db.auth.onAuthStateChange((event)=>{if(event==="SIGNED_OUT")reset();});
  result(db.auth.getSession()).then(({session})=>session?.user?start(session.user):null)
    .catch(err=>{app.innerHTML=login(commandError(err));});
}
