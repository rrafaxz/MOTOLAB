import {today,shift,isOpen} from "./domain.js";
const nameMap={leads:"ml_leads",followups:"ml_followups",campaigns:"ml_campaigns",sales:"ml_sales",
  receipts:"ml_receipts",spend:"ml_spend"};
const evidenceBucket="motolab-evidencias";
async function result(p){
  const {data,error}=await p;
  if(error){
    if(error.code==="23505")throw Error("Já existe um registro para esses dados. Confira os lançamentos.");
    throw Error(error.message);
  }
  return data;
}
function remote(client,workspace){
  const tb=key=>client.from(nameMap[key]);
  const scoped=(key,id)=>tb(key).select("*").eq("workspace_id",workspace).eq("id",id);
  async function all(key){
    const list=[];
    for(let start=0;;start+=400){
      const page=await result(tb(key).select("*").eq("workspace_id",workspace).order("id").range(start,start+399));
      list.push(...page);
      if(page.length<400)return list;
    }
  }
  async function insert(key,values){return result(tb(key).insert({...values,workspace_id:workspace}).select("id").single());}
  async function patch(key,id,values){
    return result(tb(key).update(values).eq("workspace_id",workspace).eq("id",id).select("id").single());
  }
  function storage(){return client.storage.from(evidenceBucket);}
  function folder(lead){return `${workspace}/${lead}`;}
  return {
    async load(){return Object.fromEntries(await Promise.all(Object.keys(nameMap).map(async key=>[key,await all(key)])));},
    async saveLead(id,p){return id?patch("leads",id,p):insert("leads",p);},
    schedule(lead,p){return result(client.rpc("ml_schedule",{p_workspace:workspace,p_lead:lead,p_due_on:p.due_on,p_due_time:p.due_time,p_note:p.note}));},
    complete(id){return patch("followups",id,{state:"concluido"});},
    campaign(p){return insert("campaigns",p);},
    sale(p){return insert("sales",p);},
    receipt(p){return insert("receipts",p);},
    async spend(p){
      const prior=await result(tb("spend").select("id").eq("workspace_id",workspace)
        .eq("campaign_id",p.campaign_id).eq("spent_on",p.spent_on).maybeSingle());
      if(prior)throw Error("Esse anúncio já tem lançamento para a data. Abra a linha para editar.");
      return insert("spend",p);
    },
    patchSpend(id,p){return patch("spend",id,p);},
    async listFiles(id){return result(storage().list(folder(id),{limit:100,sortBy:{column:"created_at",order:"desc"}}));},
    async upload(id,file){
      if(!["image/jpeg","image/png","image/webp","application/pdf"].includes(file.type)||file.size>5242880)
        throw Error("Envie JPG, PNG, WebP ou PDF de até 5 MB.");
      await result(scoped("leads",id).single());
      const safe=file.name.normalize("NFD").replace(/[^a-zA-Z0-9._-]/g,"_").slice(-120);
      return result(storage().upload(`${folder(id)}/${crypto.randomUUID()}-${safe}`,file,{contentType:file.type}));
    },
    async signed(id,file){
      const {signedUrl}=await result(storage().createSignedUrl(`${folder(id)}/${file}`,60));
      return signedUrl;
    }
  };
}
function sampleData(){
  const d=today();
  const base=shift(d,-1);
  const campaigns=[
    {id:"demo-cg",name:"CG 160 / Vídeo 02",offer:"financiamento"},
    {id:"demo-biz",name:"Primeira moto",offer:"financiamento"},
    {id:"demo-plan",name:"Planeje sua Honda",offer:"consorcio"}
  ];
  const options=[
   ["Ana Ribeiro","CG 160 Fan","meta","demo-cg","acompanhamento",true],
   ["Bruno Costa","NXR 160 Bros","instagram",null,"proposta",true],
   ["Camila Lima","Biz 125","meta","demo-biz","atendimento",true],
   ["Diego Santos","CG 160 Titan","indicacao",null,"ganho",true],
   ["Eduardo Melo","Pop 110i","meta","demo-biz","novo",false],
   ["Fernanda Rocha","CG 160 Fan","meta","demo-cg","ganho",true]
  ];
  const leads=options.map(([name,motorcycle,source,campaign_id,stage,qualified],i)=>({
    id:"lead-"+i,name,motorcycle,source,campaign_id,stage,qualified,
    acquired_on:base,created_at:base+"T12:00:00Z",region:"Paranoá, DF",phone:null,instagram:null
  }));
  const followups=[[0,d,"14:00"],[1,d,"16:00"],[2,shift(d,3),"10:00"],[4,base,"14:00"]]
    .map(([i,due_on,due_time],j)=>({id:"return-"+j,lead_id:"lead-"+i,due_on,due_time,state:"pendente",note:"Confirmar interesse."}));
  const sales=[
    {id:"sale-1",lead_id:"lead-3",sold_on:base,kind:"financiamento",expected_cents:198000,reason:"Escolheu após comparar condições."},
    {id:"sale-2",lead_id:"lead-5",sold_on:d,kind:"consorcio",expected_cents:287000,reason:"Compra planejada."}
  ];
  const receipts=[
    {id:"pay-1",sale_id:"sale-1",received_on:base,cents:198000},
    {id:"pay-2",sale_id:"sale-2",received_on:d,cents:71000}
  ];
  const spend=campaigns.map((r,i)=>({id:"cost-"+i,campaign_id:r.id,spent_on:shift(d,-i),media_cents:[52000,43000,31000][i],direct_cents:0,conversations:[16,11,8][i]}));
  return {leads,followups,campaigns,sales,receipts,spend};
}
function demo(){
  const key="motolab-demo-v1";
  const fresh=sampleData;
  let data;
  try{data=JSON.parse(localStorage.getItem(key))??fresh();}catch{data=fresh();}
  const persist=()=>localStorage.setItem(key,JSON.stringify(data));
  const add=(key,p)=>{const r={id:crypto.randomUUID(),created_at:new Date().toISOString(),...p};data[key].push(r);persist();return r;};
  const patch=(key,id,p)=>{const row=data[key].find(x=>x.id===id);if(!row)throw Error("Registro não encontrado.");Object.assign(row,p);persist();return row;};
  const cancel=lead=>data.followups.filter(x=>x.lead_id===lead&&x.state==="pendente").forEach(x=>x.state="cancelado");
  return {
    async load(){return structuredClone(data);},
    async saveLead(id,p){
      if(p.phone&&data.leads.some(l=>l.id!==id&&l.phone===p.phone))throw Error("Já existe um lead com esse telefone.");
      if(["ganho","perdido"].includes(p.stage))cancel(id);
      return id?patch("leads",id,p):add("leads",{...p,acquired_on:today()});
    },
    async schedule(id,p){cancel(id);return add("followups",{...p,lead_id:id,state:"pendente"});},
    async complete(id){return patch("followups",id,{state:"concluido"});},
    async campaign(p){return add("campaigns",p);},
    async sale(p){
      const l=data.leads.find(x=>x.id===p.lead_id);
      if(!l||!isOpen(l)||p.sold_on<l.acquired_on)throw Error("Confira o lead e a data de venda.");
      if(data.sales.some(r=>r.lead_id===l.id))throw Error("Venda já registrada.");
      l.stage="ganho";l.outcome_reason=p.reason;cancel(l.id);return add("sales",p);
    },
    async receipt(p){
      const sale=data.sales.find(x=>x.id===p.sale_id);
      const paid=data.receipts.filter(x=>x.sale_id===p.sale_id).reduce((a,b)=>a+b.cents,0);
      if(!sale||p.received_on<sale.sold_on||paid+p.cents>sale.expected_cents)throw Error("Confira a data e o saldo da comissão.");
      return add("receipts",p);
    },
    async spend(p){
      if(data.spend.some(r=>r.campaign_id===p.campaign_id&&r.spent_on===p.spent_on))
        throw Error("Já existe um lançamento para esse dia. Abra o registro para editar.");
      return add("spend",p);
    },
    async patchSpend(id,p){return patch("spend",id,p);},
    async listFiles(){return [];},
    async upload(){throw Error("Anexos ficam disponíveis quando o Supabase é configurado.");}
  };
}

export {remote,demo,result};
