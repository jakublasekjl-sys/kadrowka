import { useMemo, useState } from 'react'
import { ContentLinkButton } from '../components/ContentLink'
import { PageHeader } from '../components/PageHeader'
import { SearchField } from '../components/SearchField'
import type { ContentBundle, ContentModule, ContentFile } from '../types/content'
import { matchesQuery, relaxedKey } from '../utils/content'

const categoryOrder=['Zmiany w Systemie Pracy z Kadrą','Motywowanie','Kultura Organizacyjna','Model przywództwa','Przekrojowe o pracy z kadrą','Praca nad sobą','Pozyskiwanie kadry w ZHP','Podsumowywanie pracy','Kształcenie','Praca Komisji Stopni Instruktorskich','Inne']

function lookupKeys(article:ContentFile){const values=[`${article.title??''} ${article.fileName??''}`,article.title,article.fileName,article.path];const keys=new Set<string>();for(const value of values){if(!value)continue;keys.add(relaxedKey(value));const segment=value.replaceAll('\\','/').split('/').pop()??'';keys.add(relaxedKey(segment));keys.add(relaxedKey(segment.replace(/\.[a-z0-9]+$/i,'')))}return [...keys]}
function fallbackCategories(article:ContentFile){const key=relaxedKey(`${article.title} ${article.fileName}`);if(/motyw|zachec/.test(key))return['Motywowanie'];if(/pozyski|wolontarius/.test(key))return['Pozyskiwanie kadry w ZHP'];if(/przyw|lider|model|postaw/.test(key))return['Model przywództwa'];if(/ksztalc|kurs|woodbadge|konferenc|zsk/.test(key))return['Kształcenie'];if(/stopien|stopni|ksi|proba|opiekun/.test(key))return['Praca Komisji Stopni Instruktorskich'];if(/zespol|kultur|organizac|relac|mentor/.test(key))return['Kultura Organizacyjna'];return['Inne']}

export function CzuwajArticlesPage({content,module}:{content:ContentBundle;module:ContentModule}){
  const [query,setQuery]=useState('');const [category,setCategory]=useState('Wszystkie')
  const articles=useMemo(()=> (module.files??[]).filter((file)=>!['image','page'].includes(file.type??'')).map((file)=>{const categories=lookupKeys(file).map((key)=>content.czuwajCategories[key]).find((items)=>items?.length)??fallbackCategories(file);return{file,categories}}).sort((a,b)=>(a.file.title??'').localeCompare(b.file.title??'','pl')),[content.czuwajCategories,module.files])
  const present=new Set(articles.flatMap((item)=>item.categories));const categories=['Wszystkie',...categoryOrder.filter((item)=>present.has(item))]
  const visible=articles.filter((item)=>(category==='Wszystkie'||item.categories.includes(category))&&matchesQuery(query,item.file.title,item.file.fileName,item.categories.join(' ')))
  return <div className="page-stack"><PageHeader title="Artykuły z Czuwaj o pracy z kadrą" lead={`${articles.length} artykułów uporządkowanych według obszarów pracy z kadrą.`}/><SearchField value={query} onChange={setQuery} placeholder="Szukaj artykułu"/><div className="filter-chips">{categories.map((item)=><button type="button" className={category===item?'active':''} onClick={()=>setCategory(item)} key={item}>{item}</button>)}</div><p className="result-count">Znaleziono: {visible.length}</p><div className="article-grid">{visible.map(({file,categories})=><article className="article-card" key={file.id??file.path}><div><h2>{file.title}</h2><p>{categories.join(', ')}</p></div><ContentLinkButton item={file}/></article>)}</div></div>
}
