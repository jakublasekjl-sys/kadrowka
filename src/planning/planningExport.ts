import type { ContentBundle } from '../types/content'
import { dayColumns, dayPeriods, planningSteps, profileTitles, type PlanningDraft, yearColumns, yearMonths } from './planningModel'
import { safeCsvCell } from '../security/csv'

function download(blob: Blob, fileName: string) {
  const url=URL.createObjectURL(blob)
  const anchor=document.createElement('a')
  anchor.href=url
  anchor.download=fileName
  anchor.style.display='none'
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(()=>URL.revokeObjectURL(url),1000)
}
function safeName(value:string){return value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9_-]+/g,'-').replace(/^-|-$/g,'').toLowerCase()||'plan'}
function nonempty(value:string|undefined){return value?.trim()??''}

export function buildPlanSummary(draft:PlanningDraft,content:ContentBundle){
  const lines=[draft.name,'',`Typ planu: ${profileTitles[draft.profile]}`,'']
  for(const step of planningSteps(draft.profile,content)){
    lines.push(`## ${step.title}`)
    if(draft.skipped.includes(step.id)){lines.push('Etap pominięty.','');continue}
    for(const field of step.fields){
      const prefix=`${draft.profile}.${step.id}.${field.key}`
      if(field.kind==='info'||field.kind==='review')continue
      if(field.kind==='text'||field.kind==='noteList'){
        const value=nonempty(draft.answers[`${prefix}.value`]); if(value)lines.push(`${field.label}:`,value,'')
      }else if(field.kind==='question'){
        const current=nonempty(draft.answers[`${prefix}.current`]); const desired=nonempty(draft.answers[`${prefix}.desired`]); const comment=nonempty(draft.answers[`${prefix}.comment`]);
        if(current||desired||comment){lines.push(field.label??'Pytanie');if(current)lines.push(`Stan obecny: ${current}`);if(desired)lines.push(`Stan pożądany: ${desired}`);if(comment)lines.push(`Komentarz: ${comment}`);lines.push('')}
      }else if(field.kind==='aspect'){
        const values=[['Stan obecny','currentState'],['Stan pożądany','desiredState'],['Pomysły praktyk','practiceIdeas'],['Komentarz','comment']].map(([label,key])=>[label,nonempty(draft.answers[`${prefix}.${key}`])]).filter(([,value])=>value)
        if(values.length){lines.push(field.title??field.label??'Obszar');values.forEach(([label,value])=>lines.push(`${label}: ${value}`));lines.push('')}
      }else if(field.kind==='goalTasks'){
        const count=Math.max(1,Number(draft.answers[`${prefix}.count`]??3));for(let i=0;i<count;i++){const goal=nonempty(draft.answers[`${prefix}.${i}.goal`]);const tasks=nonempty(draft.answers[`${prefix}.${i}.tasks`]);if(goal||tasks){lines.push(`Cel ${i+1}: ${goal}`);if(tasks)lines.push(`Działania: ${tasks}`)}}lines.push('')
      }else if(field.kind==='analysisSelector'){
        for(const tool of content.analysisTools.filter((item)=>draft.selectedAnalysisToolIds.includes(item.id))){lines.push(tool.title);for(const prompt of tool.prompts){const value=nonempty(draft.answers[`${draft.profile}.${step.id}.analysis.${tool.id}.${prompt.key}`]);if(value)lines.push(`${prompt.label}: ${value}`)}lines.push('')}
      }else if(field.kind==='yearSchedule'){
        yearMonths.forEach((month,mi)=>{const values=yearColumns.map((column,ci)=>[column,nonempty(draft.answers[`${draft.profile}.${step.id}.yearSchedule.${mi}.${ci}`])]).filter(([,value])=>value);if(values.length){lines.push(month);values.forEach(([label,value])=>lines.push(`${label}: ${value}`));lines.push('')}})
      }else if(field.kind==='daySchedule'){
        const count=Math.max(1,Number(draft.answers[`${draft.profile}.${step.id}.daySchedule.count`]??field.defaultDays??14));for(let day=0;day<count;day++){const label=nonempty(draft.answers[`${draft.profile}.${step.id}.daySchedule.${day}.day`])||`Dzień ${day+1}`;let has=false;const part:string[]=[];dayPeriods.forEach((period,pi)=>{const values=dayColumns.map((column)=>[column.label,nonempty(draft.answers[`${draft.profile}.${step.id}.daySchedule.${day}.${pi}.${column.key}`])]).filter(([,value])=>value);if(values.length){has=true;part.push(period);values.forEach(([name,value])=>part.push(`${name}: ${value}`))}});if(has)lines.push(label,...part,'')}
      }
    }
    lines.push('')
  }
  return lines.join('\n').replace(/\n{3,}/g,'\n\n').trim()
}

export function exportPlanTxt(summary:string,name:string){download(new Blob([summary],{type:'text/plain;charset=utf-8'}),`${safeName(name)}.txt`)}

export async function exportPlanDocx(summary:string,name:string){
  const { Document, Packer, Paragraph, TextRun } = await import('docx')
  const children=summary.split('\n').map((line)=>line.startsWith('## ')?new Paragraph({children:[new TextRun({text:line.slice(3),bold:true,color:'755390',size:32})],spacing:{before:180,after:100}}):new Paragraph({text:line,spacing:{after:line?100:40}}))
  const blob=await Packer.toBlob(new Document({sections:[{properties:{},children}]}));download(blob,`${safeName(name)}.docx`)
}

function wrapCanvasLine(context:CanvasRenderingContext2D,text:string,maxWidth:number){
  if(!text)return [''];const words=text.split(/\s+/);const lines:string[]=[];let current='';for(const word of words){const next=current?`${current} ${word}`:word;if(context.measureText(next).width>maxWidth&&current){lines.push(current);current=word}else current=next}if(current)lines.push(current);return lines
}

export async function exportPlanPdf(summary:string,name:string){
  const { jsPDF } = await import('jspdf')
  const width=1240,height=1754,margin=90,lineHeight=34;const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const context=canvas.getContext('2d')!;const pdf=new jsPDF({unit:'mm',format:'a4'});let page=0,y=margin
  function clear(){context.fillStyle='#fff';context.fillRect(0,0,width,height);context.fillStyle='#22252b';context.font='24px Arial';y=margin}
  function addPage(){if(page>0)pdf.addPage();pdf.addImage(canvas.toDataURL('image/jpeg',.92),'JPEG',0,0,210,297);page++}
  clear();for(const raw of summary.split('\n')){const heading=raw.startsWith('## ');context.font=heading?'bold 34px Arial':'24px Arial';context.fillStyle=heading?'#755390':'#22252b';const lines=wrapCanvasLine(context,heading?raw.slice(3):raw,width-margin*2);const needed=Math.max(1,lines.length)*(heading?44:lineHeight)+(heading?18:0);if(y+needed>height-margin){addPage();clear()}if(heading)y+=12;for(const line of lines){context.fillText(line,margin,y);y+=heading?44:lineHeight}if(!raw)y+=10}addPage();pdf.save(`${safeName(name)}.pdf`)
}

export function exportHalizCsv(draft:PlanningDraft){
  const step='harmonogram';const count=Math.max(1,Number(draft.answers['haliz.harmonogram.daySchedule.count']??14));const rows=[['Dzień','Pora dnia','Temat / zajęcia','Forma / opis','Osoba odpowiedzialna','Uwagi']]
  for(let day=0;day<count;day++){const label=nonempty(draft.answers[`haliz.${step}.daySchedule.${day}.day`])||`Dzień ${day+1}`;dayPeriods.forEach((period,pi)=>rows.push([label,period,...dayColumns.map((column)=>nonempty(draft.answers[`haliz.${step}.daySchedule.${day}.${pi}.${column.key}`]))]))}
  const csv='\ufeff'+rows.map((row)=>row.map((cell)=>`"${safeCsvCell(cell).replaceAll('"','""')}"`).join(';')).join('\r\n');download(new Blob([csv],{type:'text/csv;charset=utf-8'}),`${safeName(draft.name)}-harmonogram.csv`)
}
