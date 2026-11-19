import { useEffect, useState } from 'react';
import type { EmailReview, Suggestion, SuggestionStatus } from '../../features/emailReview/model';
import './emailReview.css';

const API='/api/preview/email-review';
interface ReviewState {connected:boolean;lastSync?:string;lastError?:string;items:EmailReview[]}
const sample:EmailReview[]=[
  {id:'sample-1',sender:'school@example.invalid',subject:'School trip',receivedAt:'2026-11-18T09:00:00Z',sourceUrl:null,summary:'A class trip is planned for 3 December. Return the permission form by 27 November.',status:'pending',suggestions:[
    {id:'s1',kind:'task',title:'Return trip permission form',date:'2026-11-27',time:null,endTime:null,detail:'Check the original school message for instructions.',status:'pending'},
    {id:'s2',kind:'event',title:'Class trip',date:'2026-12-03',time:null,endTime:null,detail:'Time not supplied.',status:'pending'}]},
  {id:'sample-2',sender:'school@example.invalid',subject:'Festive craft session',receivedAt:'2026-11-18T12:00:00Z',sourceUrl:null,summary:'Optional craft session on 10 December, 15:30 to 16:30. Booking required.',status:'pending',suggestions:[
    {id:'s3',kind:'event',title:'Festive craft session',date:'2026-12-10',time:'15:30',endTime:'16:30',detail:'Optional event.',status:'pending'},
    {id:'s4',kind:'task',title:'Book craft session if interested',date:null,time:null,endTime:null,detail:'No deadline supplied.',status:'pending'}]},
  {id:'sample-3',sender:'updates@example.invalid',subject:'Weekly learning update',receivedAt:'2026-11-17T12:00:00Z',sourceUrl:null,summary:'The class has been exploring shapes and autumn colours. No household action identified.',status:'pending',suggestions:[]}
];
type Change={id:string;suggestionId?:string;status:SuggestionStatus|'reviewed';title?:string;date?:string|null;time?:string|null};
function SuggestionCard({item,onChange,disabled}:{item:Suggestion;onChange:(change:Omit<Change,'id'|'suggestionId'>)=>void;disabled:boolean}){
  const [title,setTitle]=useState(item.title);
  const [date,setDate]=useState(item.date??'');
  const [time,setTime]=useState(item.time??'');
  useEffect(()=>{setTitle(item.title);setDate(item.date??'');setTime(item.time??'');},[item.title,item.date,item.time]);
  return <div className="email-review-suggestion">
    <div className="email-review-label">{item.kind==='event'?'Calendar suggestion':'To-do suggestion'} · {item.status}</div>
    <label>Title<input value={title} onChange={e=>setTitle(e.target.value)} maxLength={150}/></label>
    <div className="email-review-fields">
      <label>{item.kind==='event'?'Event date':'Due date'}<input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label>
      <label>Time (optional)<input type="time" value={time} onChange={e=>setTime(e.target.value)}/></label>
    </div>
    {item.detail&&<small>{item.detail}</small>}
    <div className="email-review-actions">
      <button type="button" disabled={disabled||!title.trim()||(item.kind==='event'&&!date)} onClick={()=>onChange({status:'approved',title,date:date||null,...(time!==(item.time??'')?{time:time||null}:{})})}>{item.status==='approved'?'Save edits':'Approve'}</button>
      <button type="button" disabled={disabled} onClick={()=>onChange({status:item.status==='dismissed'?'pending':'dismissed'})}>{item.status==='dismissed'?'Restore':'Dismiss'}</button>
    </div>
  </div>;
}
export function EmailReviewPanel({sampleMode}:{sampleMode:boolean}){
  const [key,setKey]=useState('');
  const [live,setLive]=useState<ReviewState|null>(null);
  const [examples,setExamples]=useState<EmailReview[]>(sample);
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const [showReviewed,setShowReviewed]=useState(false);
  async function call(path='',method='GET',data?:unknown){
    const r=await fetch(API+path,{method,headers:{'x-email-review-key':key,'content-type':'application/json'},...(data?{body:JSON.stringify(data)}:{})});
    const result=await r.json();
    if(!r.ok)throw new Error(result.message??'Email review request failed');
    return result;
  }
  async function perform(action:()=>Promise<void>){setBusy(true);setError('');try{await action();}catch(e){setError(e instanceof Error?e.message:'Could not complete request');}finally{setBusy(false);}}
  async function refresh(){setLive(await call());}
  function change(input:Change){
    if(sampleMode){setExamples(old=>old.map(m=>m.id!==input.id?m:input.suggestionId?{...m,suggestions:m.suggestions.map(s=>s.id!==input.suggestionId?s:{...s,...(input.title!==undefined?{title:input.title}:{}),...(input.date!==undefined?{date:input.date}:{}),...(input.time!==undefined?{time:input.time,endTime:null}:{}),status:input.status as SuggestionStatus})}:{...m,status:input.status as EmailReview['status']}));return;}
    void perform(async()=>{const updated=await call('','PATCH',input) as EmailReview;setLive(old=>old?{...old,items:old.items.map(m=>m.id===updated.id?updated:m)}:old);});
  }
  const items=sampleMode?examples:live?.items??[];
  const pending=items.filter(m=>m.status==='pending').length;
  const approved=items.flatMap(m=>m.suggestions.filter(s=>s.status==='approved'));
  return <section className="preview-section email-review" aria-labelledby="email-review-title">
    <div className="preview-section__heading"><div><span className="preview-kicker">School · incoming information</span><h2 id="email-review-title">Email review</h2></div><span className="preview-section__caption">{sampleMode?'Sample data':live?pending+' to review':'Private'}</span></div>
    {sampleMode?<p className="preview-muted">Illustrative emails only. Approvals and edits in sample mode are not saved.</p>:!live?
      <form className="email-review-unlock" onSubmit={e=>{e.preventDefault();void perform(refresh);}}>
        <p>Real email data is private. Enter the separate email review access key to unlock; the key is kept only in this page's memory.</p>
        <label>Access key<input type="password" autoComplete="off" value={key} onChange={e=>setKey(e.target.value)} required/></label>
        <button type="submit" disabled={busy||!key}>Unlock email review</button>
        <small>Use the Sample data selector above to explore the workflow without connecting Outlook.</small>
      </form>:<div className="email-review-actions">
        <span>{live.connected?'Outlook connected':'Outlook not connected'}{live.lastSync?' · Last sync '+new Date(live.lastSync).toLocaleString('en-GB'):''}</span>
        <button type="button" disabled={busy} onClick={()=>void perform(refresh)}>Refresh</button>
        {!live.connected&&<button type="button" disabled={busy} onClick={()=>void perform(async()=>{const result=await call('/connect','POST');window.location.assign(result.url);})}>Connect Outlook</button>}
        {live.connected&&<button type="button" disabled={busy} onClick={()=>{if(window.confirm('Disconnect Outlook and remove all imported reviews and approvals?'))void perform(async()=>{await call('','DELETE');await refresh();});}}>Disconnect</button>}
        <button type="button" disabled={busy} onClick={()=>{setLive(null);setKey('');setError('');}}>Lock</button>
        {live.lastError&&<p role="status">{live.lastError}</p>}
      </div>}
    {error&&<p role="alert">{error}</p>}
    {(sampleMode||live)&&<>
      <div className="email-review-actions"><label><input type="checkbox" checked={showReviewed} onChange={e=>setShowReviewed(e.target.checked)}/> Show reviewed</label><span>{pending} messages to review · {approved.length} approved suggestions</span></div>
      <div className="email-review-grid">{items.filter(m=>showReviewed||m.status==='pending').map(m=><article className="email-review-message" key={m.id}>
        <span className="email-review-label">{new Date(m.receivedAt).toLocaleDateString('en-GB')} · {m.sender}</span><h3>{m.subject}</h3><p>{m.summary}</p>
        {m.sourceUrl&&<a href={m.sourceUrl} target="_blank" rel="noreferrer">Open original in Outlook</a>}
        {m.suggestions.length===0&&<small>No actions or events identified. Check the original if needed.</small>}
        {m.suggestions.map(s=><SuggestionCard key={s.id} item={s} disabled={busy} onChange={c=>change({id:m.id,suggestionId:s.id,...c})}/>)}
        <button type="button" disabled={busy||(m.status==='pending'&&m.suggestions.some(s=>s.status==='pending'))} onClick={()=>change({id:m.id,status:m.status==='pending'?'reviewed':'pending'})}>{m.status==='pending'?'Mark message reviewed':'Return to review'}</button>
      </article>)}</div>
      {pending===0&&<p className="preview-muted">Nothing waiting to review.</p>}
      {approved.length>0&&<div className="email-review-approved"><h3>Approved for the household</h3>{approved.map(s=><p key={s.id}><strong>{s.title}</strong> · {s.kind==='event'?'Event':'To-do'} · {s.date??'No date'} {s.time??''}{s.endTime?'–'+s.endTime:''}</p>)}</div>}
      <p className="preview-footnote">Approvals stay in this preview's review queue. They do not write to Google Calendar or the live household timeline.</p>
    </>}
  </section>;
}
