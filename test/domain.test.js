import test from "node:test";
import assert from "node:assert/strict";
import { summarize, cents, shift, phone, today, escape } from "../src/domain.js";

test("normaliza dinheiro, telefone e data brasileira", () => {
  assert.equal(cents("R$ 1.234,56"),123456);
  assert.throws(()=>cents("10,123"));
  assert.equal(phone("(61) 99999-0000"),"5561999990000");
  assert.equal(shift("2026-01-31",1,"months"),"2026-02-28");
  assert.equal(today(new Date("2026-11-17T01:30:00Z")),"2026-11-16");
  assert.equal(escape("<img>"),"&lt;img&gt;");
});

test("atribui comissão ao mês do lead e separa o caixa", () => {
  const data={
    leads:[
      {id:"m",source:"meta",campaign_id:"c",acquired_on:"2026-11-10",qualified:true},
      {id:"o",source:"instagram",campaign_id:null,acquired_on:"2026-11-10",qualified:true}
    ],
    sales:[
      {id:"sm",lead_id:"m",sold_on:"2026-12-01",expected_cents:45000},
      {id:"so",lead_id:"o",sold_on:"2026-11-16",expected_cents:70000}
    ],
    receipts:[
      {sale_id:"sm",received_on:"2026-12-04",cents:45000},
      {sale_id:"so",received_on:"2026-11-20",cents:70000}
    ],
    spend:[{spent_on:"2026-11-05",media_cents:12000,direct_cents:3000}],
    followups:[{state:"pendente",due_on:"2026-12-04"},{state:"cancelado",due_on:"2026-12-05"}]
  };
  const result=summarize(data,{from:"2026-11-01",to:"2026-11-30"},"2026-12-05");
  assert.deepEqual([result.paid,result.cost,result.revenue,result.cac,result.cpl,result.roi,result.lateCount,result.todayCount],
    [70000,15000,45000,15000,15000,2,1,0]);
});
