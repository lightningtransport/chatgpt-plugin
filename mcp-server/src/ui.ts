/** Portable MCP Apps view for governed reporting results. It intentionally makes
 * no network requests: all business data arrives in the tool result. */
export const REPORTING_VIEW_URI = "ui://lightning-transport/reporting-view.html";

export const reportingViewHtml = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  :root { color-scheme: light dark; font: 14px/1.45 system-ui, sans-serif; }
  body { margin: 0; padding: 16px; color: CanvasText; background: Canvas; }
  h1 { font-size: 18px; margin: 0 0 4px; } .muted { color: GrayText; margin: 0 0 14px; }
  .grid { display:grid; gap:10px; grid-template-columns:repeat(auto-fit,minmax(140px,1fr)); }
  .card { border:1px solid color-mix(in srgb, CanvasText 18%, transparent); border-radius:10px; padding:12px; }
  .number { font-size:24px; font-weight:700; } .label { color:GrayText; font-size:12px; }
  .warning { border-left:4px solid #b7791f; background:color-mix(in srgb,#b7791f 12%, Canvas); padding:10px; margin:12px 0; }
  table { border-collapse:collapse; width:100%; margin-top:12px; font-size:12px; } th,td { text-align:left; padding:7px; border-bottom:1px solid color-mix(in srgb, CanvasText 14%, transparent); vertical-align:top; }
  th { color:GrayText; } .scroll { overflow:auto; } ul { padding-left:20px; }
</style></head><body><main id="app" aria-live="polite">Loading reporting view…</main>
<script>
const app=document.getElementById('app'); let pending=new Map(), n=1;
function esc(v){return String(v??'—').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));}
function scalar(v){return v===null||v===undefined?'—':typeof v==='object'?JSON.stringify(v):String(v);}
function rows(data){ return Array.isArray(data?.items)?data.items:Array.isArray(data?.alerts)?data.alerts:Array.isArray(data?.settlementSummary)?data.settlementSummary:[]; }
function cards(data){ const source=data?.kpis??data?.summary??{}; return Object.entries(source).filter(([,v])=>typeof v!=='object').slice(0,8); }
function render(data){
 const title=data?.title||'Lightning Transport report', body=data?.data||{}, state=body.status;
 const notice=state==='BLOCKED_BY_DATA'||state==='PARTIAL'?'<div class="warning"><strong>'+esc(state)+'</strong> '+esc((body.limitations||[]).join(' '))+'</div>':'';
 const cs=cards(body).map(([k,v])=>'<section class="card"><div class="number">'+esc(scalar(v))+'</div><div class="label">'+esc(k.replace(/([A-Z])/g,' $1'))+'</div></section>').join('');
 const list=rows(body), keys=[...new Set(list.flatMap(r=>Object.keys(r||{})))].slice(0,8);
 const table=list.length&&keys.length?'<div class="scroll"><table><thead><tr>'+keys.map(k=>'<th>'+esc(k)+'</th>').join('')+'</tr></thead><tbody>'+list.slice(0,100).map(r=>'<tr>'+keys.map(k=>'<td>'+esc(scalar(r[k]))+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>':'';
 const evidence=body.evidence?'<p class="muted">Evidence: '+esc(JSON.stringify(body.evidence))+'</p>':'';
 app.innerHTML='<h1>'+esc(title)+'</h1><p class="muted">Read-only reporting view</p>'+notice+(cs?'<div class="grid">'+cs+'</div>':'')+table+evidence;
}
function request(method,params){const id=n++; parent.postMessage({jsonrpc:'2.0',id,method,params},'*');return new Promise((resolve,reject)=>pending.set(id,{resolve,reject}));}
addEventListener('message',event=>{if(event.source!==parent)return;const m=event.data;if(!m||m.jsonrpc!=='2.0')return;if(m.id!==undefined&&pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);return;}if(m.method==='ui/notifications/tool-result')render(m.params?.structuredContent);},{passive:true});
request('ui/initialize',{}).then(r=>render(r?.toolResult?.structuredContent||r?.structuredContent)).catch(()=>{});
</script></body></html>`;

export function registerReportingView(server: any) {
  server.registerResource("lightning-reporting-view", REPORTING_VIEW_URI, {}, async () => ({
    contents: [{ uri: REPORTING_VIEW_URI, mimeType: "text/html;profile=mcp-app", text: reportingViewHtml, _meta: { ui: { prefersBorder: true } } }],
  }));
}
