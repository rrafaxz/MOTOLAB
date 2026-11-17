const ZONE = "America/Sao_Paulo";
const formatter = new Intl.NumberFormat("pt-BR", {style:"currency",currency:"BRL"});
const stages = {novo:"Novo",atendimento:"Em atendimento",proposta:"Proposta",
  acompanhamento:"Em acompanhamento",ganho:"Ganho",perdido:"Perdido"};
const sources = {meta:"Meta Ads",instagram:"Instagram",indicacao:"Indicação",loja:"Loja",outro:"Outro"};
const offers = {financiamento:"Financiamento",consorcio:"Consórcio",avista:"À vista",mista:"Mista"};
function money(cents) {return Number.isFinite(cents) ? formatter.format(cents/100) : "—";}
function cents(input) {
  let s=String(input??"").trim().replace(/^R\$\s*/,"");
  if(!s)return 0;
  if(s.includes(","))s=s.replace(/\./g,"").replace(",",".");
  if(!/^\d+(?:\.\d{1,2})?$/.test(s))throw Error("Informe o valor no formato 120,50.");
  const [whole,fraction=""]=s.split(".");
  const value=Number(whole)*100+Number(fraction.padEnd(2,"0"));
  if(!Number.isSafeInteger(value)||value>100000000)throw Error("O valor informado excede o limite.");
  return value;
}
function today(date=new Date()) {
  const parts=new Intl.DateTimeFormat("en-CA",{timeZone:ZONE,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(date);
  const by=Object.fromEntries(parts.map(p=>[p.type,p.value]));
  return `${by.year}-${by.month}-${by.day}`;
}
function shift(day,amount,unit="days") {
  const d=new Date(`${day}T12:00:00Z`);
  if(unit==="months"){
    const old=d.getUTCDate();
    d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+amount);
    const end=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();
    d.setUTCDate(Math.min(old,end));
  }else d.setUTCDate(d.getUTCDate()+amount);
  return d.toISOString().slice(0,10);
}
function dayLabel(day, withYear=false) {
  if(!day)return "—";
  const [year,month,num]=day.slice(0,10).split("-");
  return `${num}/${month}${withYear?"/"+year:""}`;
}
function phone(input){
  const s=String(input??"").trim(), digits=s.replace(/\D/g,"");
  if(!digits)return null;
  const n=s.startsWith("+")||digits.length>11?digits:"55"+digits;
  if(!/^[1-9]\d{9,14}$/.test(n) || (n.startsWith("55")&&![12,13].includes(n.length)))
    throw Error("Informe o WhatsApp com DDD e número completo.");
  return n;
}
function isOpen(lead){return !["ganho","perdido"].includes(lead.stage);}
function within(day,period){return !!day&&day>=period.from&&day<=period.to;}
function total(rows,key){return rows.reduce((acc,r)=>acc+(Number(r[key])||0),0);}
function receiptMap(rows) {
  const result=new Map();
  for(const r of rows)result.set(r.sale_id,(result.get(r.sale_id)??0)+r.cents);
  return result;
}
function summarize(data, period, day=today()){
  const leads=data.leads.filter(l=>within(l.acquired_on,period));
  const sales=data.sales.filter(s=>within(s.sold_on,period));
  const receipts=data.receipts.filter(r=>within(r.received_on,period));
  const spend=data.spend.filter(s=>within(s.spent_on,period));
  const payable=receiptMap(data.receipts);
  const pending=sales.reduce((n,s)=>n+Math.max(0,s.expected_cents-(payable.get(s.id)??0)),0);
  const paidLeads=leads.filter(l=>l.source==="meta"&&l.campaign_id);
  const paidLeadIds=new Set(paidLeads.map(l=>l.id));
  const attributed=data.sales.filter(s=>s.sold_on<=day&&paidLeadIds.has(s.lead_id));
  const attributedSaleIds=new Set(attributed.map(s=>s.id));
  const attributionReceipts=data.receipts.filter(r=>r.received_on<=day&&attributedSaleIds.has(r.sale_id));
  const adCost=total(spend,"media_cents"),cost=adCost+total(spend,"direct_cents");
  const revenue=total(attributionReceipts,"cents"),qualifiedPaid=paidLeads.filter(l=>l.qualified).length;
  const scheduled=data.followups.filter(x=>x.state==="pendente");
  return {leads,sales,receipts,spend,paidLeads,attributed,paid:total(receipts,"cents"),pending,cost,adCost,revenue,
    qualified:leads.filter(l=>l.qualified).length,proposals:leads.filter(l=>l.stage==="proposta").length,
    todayCount:scheduled.filter(r=>r.due_on===day).length,lateCount:scheduled.filter(r=>r.due_on<day).length,
    cac:cost&&attributed.length?cost/attributed.length:null,cpl:cost&&qualifiedPaid?cost/qualifiedPaid:null,
    roi:cost>0?(revenue-cost)/cost:null};
}
function initials(name){return name.trim().split(/\s+/).slice(0,2).map(w=>w[0]).join("").toUpperCase();}
function slug(value){return String(value??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();}
function escape(value=""){
  return String(value).replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
}

export {stages,sources,offers,money,cents,today,shift,dayLabel,phone,isOpen,within,total,receiptMap,summarize,initials,slug,escape};
