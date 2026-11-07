import { useState } from 'react'
import { Badge, Barra, Campo, Kpi, PageHeader, Tabs, notificar } from '../components/ui'
import { getDB, salvarItem, update, useDB, usarCreditoIA } from '../lib/store'
import { addDias, brl, dataBR, hoje, num, placeholderFoto, uid } from '../lib/format'
import type { Imovel, SiteConfig, TipoComponenteSite } from '../lib/types'
import { novoImovel, tiposImovel } from './Imoveis'

export const nomeComponente: Record<TipoComponenteSite, string> = {
  banner: 'Banner principal', busca: 'Busca de imóveis', destaques: 'Imóveis em destaque', lancamentos: 'Lançamentos', aluguel: 'Imóveis para alugar', venda: 'Imóveis à venda',
  sobre: 'Sobre a imobiliária', equipe: 'Nossa equipe', depoimentos: 'Depoimentos', contato: 'Formulário de contato', blog: 'Últimos posts do blog', servicos: 'Serviços',
  numeros: 'Números da imobiliária', mapa: 'Mapa / endereço', anuncie: 'Anuncie seu imóvel',
}

/* ---------------- Editor do site ---------------- */
export function EditorSite() {
  const site = useDB(d => d.site)
  const [aba, setAba] = useState<'identidade' | 'home' | 'paginas' | 'blog'>('identidade')
  const [modo, setModo] = useState<'desktop' | 'mobile'>('desktop')
  const [versao, setVersao] = useState(0)
  const set = (p: Partial<SiteConfig>) => { update(d => { Object.assign(d.site, p) }); setVersao(v => v + 1) }
  const mover = (i: number, dir: -1 | 1) => { update(d => { const c = d.site.componentes; const j = i + dir; if (j < 0 || j >= c.length) return;[c[i], c[j]] = [c[j], c[i]] }); setVersao(v => v + 1) }
  return <>
    <PageHeader titulo="Editor do site" sub="Personalize o site da imobiliária e veja o resultado ao vivo" acoes={<a href="/s" target="_blank" rel="noreferrer" className="btn-dark">Abrir site ↗</a>} />
    <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
      <div>
        <Tabs abas={[{ id: 'identidade', nome: 'Identidade' }, { id: 'home', nome: 'Página inicial' }, { id: 'paginas', nome: 'Páginas' }, { id: 'blog', nome: 'Blog' }]} ativa={aba} onChange={setAba} />
        {aba === 'identidade' && <div className="card space-y-4">
          <Campo label="Nome da imobiliária"><input className="input" value={site.nome} onChange={e => set({ nome: e.target.value })} /></Campo>
          <Campo label="Slogan"><input className="input" value={site.slogan} onChange={e => set({ slogan: e.target.value })} /></Campo>
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Cor principal"><input type="color" className="h-10 w-full cursor-pointer rounded-lg border border-neutral-300" value={site.corPrimaria} onChange={e => set({ corPrimaria: e.target.value })} /></Campo>
            <Campo label="Cor secundária"><input type="color" className="h-10 w-full cursor-pointer rounded-lg border border-neutral-300" value={site.corSecundaria} onChange={e => set({ corSecundaria: e.target.value })} /></Campo>
          </div>
          <Campo label="Fonte"><select className="input" value={site.fonte} onChange={e => set({ fonte: e.target.value })}>{['Inter', 'Archivo', 'Georgia', 'Arial'].map(f => <option key={f}>{f}</option>)}</select></Campo>
          <Campo label="WhatsApp (com DDI e DDD)"><input className="input" value={site.whatsapp} onChange={e => set({ whatsapp: e.target.value })} /></Campo>
          <Campo label="E-mail"><input className="input" value={site.email} onChange={e => set({ email: e.target.value })} /></Campo>
          <Campo label="Endereço"><input className="input" value={site.endereco} onChange={e => set({ endereco: e.target.value })} /></Campo>
          <Campo label="Texto “Sobre”"><textarea className="input" rows={3} value={site.sobre} onChange={e => set({ sobre: e.target.value })} /></Campo>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-ink" checked={site.marcaDagua} onChange={e => set({ marcaDagua: e.target.checked })} />Marca d’água nas fotos</label>
        </div>}
        {aba === 'home' && <div className="card space-y-2">
          <p className="mb-2 text-sm text-ink-muted">Ative, desative e reordene os {site.componentes.length} blocos da página inicial.</p>
          {site.componentes.map((c, i) => <div key={c.id} className={`flex items-center gap-2 rounded-lg border p-2 ${c.ativo ? 'border-ink bg-brand-light' : 'border-neutral-200'}`}>
            <input type="checkbox" className="h-4 w-4 accent-ink" checked={c.ativo} onChange={e => { update(d => { d.site.componentes[i].ativo = e.target.checked }); setVersao(v => v + 1) }} />
            <span className="flex-1 text-sm font-semibold">{nomeComponente[c.tipo]}</span>
            <button className="rounded px-2 hover:bg-white" onClick={() => mover(i, -1)} aria-label="Subir">↑</button><button className="rounded px-2 hover:bg-white" onClick={() => mover(i, 1)} aria-label="Descer">↓</button>
          </div>)}
        </div>}
        {aba === 'paginas' && <div className="card space-y-4">
          {site.paginas.map((p, i) => <div key={p.id} className="space-y-2 rounded-lg border border-neutral-200 p-3">
            <input className="input font-bold" value={p.titulo} onChange={e => update(d => { d.site.paginas[i].titulo = e.target.value })} />
            <textarea className="input" rows={3} value={p.conteudo} onChange={e => update(d => { d.site.paginas[i].conteudo = e.target.value })} />
            <div className="flex justify-between text-xs"><a className="underline" href={`/s/pagina/${p.id}`} target="_blank" rel="noreferrer">Ver página</a><button className="text-red-700 underline" onClick={() => update(d => { d.site.paginas.splice(i, 1) })}>Remover</button></div>
          </div>)}
          <button className="btn-ghost" onClick={() => update(d => { d.site.paginas.push({ id: uid(), titulo: 'Nova página', conteudo: '' }) })}>+ Página</button>
        </div>}
        {aba === 'blog' && <div className="card space-y-4">
          {site.posts.map((p, i) => <div key={p.id} className="space-y-2 rounded-lg border border-neutral-200 p-3">
            <input className="input font-bold" value={p.titulo} onChange={e => update(d => { d.site.posts[i].titulo = e.target.value })} />
            <textarea className="input" rows={4} value={p.conteudo} onChange={e => update(d => { d.site.posts[i].conteudo = e.target.value })} />
            <div className="flex justify-between text-xs"><span>{dataBR(p.em)}</span><button className="text-red-700 underline" onClick={() => update(d => { d.site.posts.splice(i, 1) })}>Remover</button></div>
          </div>)}
          <button className="btn-ghost" onClick={() => update(d => { d.site.posts.unshift({ id: uid(), titulo: 'Novo post', conteudo: '', em: hoje() }) })}>+ Post</button>
        </div>}
      </div>
      <div>
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-bold">Prévia ao vivo</span>
          <div className="flex rounded-lg border border-neutral-300 p-0.5 text-sm font-semibold">
            <button className={`rounded-md px-3 py-1 ${modo === 'desktop' ? 'bg-ink text-brand' : ''}`} onClick={() => setModo('desktop')}>Desktop</button>
            <button className={`rounded-md px-3 py-1 ${modo === 'mobile' ? 'bg-ink text-brand' : ''}`} onClick={() => setModo('mobile')}>Celular</button>
          </div>
        </div>
        <div className="flex justify-center rounded-xl border border-neutral-200 bg-neutral-200 p-3">
          <iframe key={versao} title="Prévia do site" src="/s?previa=1" className={`h-[720px] rounded-lg bg-white shadow ${modo === 'mobile' ? 'w-[390px]' : 'w-full'}`} />
        </div>
      </div>
    </div>
  </>
}

/* ---------------- Analytics ---------------- */
export function Analytics() {
  const db = useDB(d => d)
  const [dias, setDias] = useState(30)
  const desde = addDias(hoje(), -dias)
  const visitas = db.analytics.visitas.filter(v => v.data >= desde)
  const porPagina = Object.entries(visitas.reduce<Record<string, number>>((a, v) => { a[v.pagina] = (a[v.pagina] ?? 0) + 1; return a }, {})).sort((a, b) => b[1] - a[1]).slice(0, 10)
  const porImovel = Object.entries(visitas.filter(v => v.imovelId).reduce<Record<string, number>>((a, v) => { a[v.imovelId!] = (a[v.imovelId!] ?? 0) + 1; return a }, {})).sort((a, b) => b[1] - a[1]).slice(0, 10)
  const leadsSite = db.oportunidades.filter(o => o.origem.startsWith('Site') && o.criadoEm >= desde).length
  const porDia = Array.from({ length: Math.min(dias, 14) }, (_, i) => { const d = addDias(hoje(), -i); return { d, n: visitas.filter(v => v.data === d).length } }).reverse()
  return <>
    <PageHeader titulo="Analytics do site" sub="Visitas, imóveis mais vistos e conversão em leads" acoes={<select className="input w-auto" value={dias} onChange={e => setDias(Number(e.target.value))}><option value={7}>7 dias</option><option value={30}>30 dias</option><option value={90}>90 dias</option></select>} />
    <div className="grid gap-4 sm:grid-cols-3">
      <Kpi destaque titulo="Visualizações" valor={num(visitas.length)} />
      <Kpi titulo="Leads do site" valor={leadsSite} />
      <Kpi titulo="Conversão" valor={visitas.length ? `${((leadsSite / visitas.length) * 100).toFixed(1)}%` : '—'} detalhe="leads ÷ visualizações" />
    </div>
    {visitas.length === 0 && <p className="mt-4 rounded-xl bg-brand-light p-4 text-sm">Ainda não há visitas registradas. Abra o <a className="font-bold underline" href="/s" target="_blank" rel="noreferrer">site</a> e navegue pelos imóveis para ver os números aparecerem aqui.</p>}
    <div className="mt-6 grid gap-6 lg:grid-cols-3">
      <div className="card"><h2 className="mb-4 font-black">Por dia</h2><div className="space-y-1">{porDia.map(p => <Barra key={p.d} rotulo={dataBR(p.d).slice(0, 5)} valor={p.n} max={Math.max(1, ...porDia.map(x => x.n))} />)}</div></div>
      <div className="card"><h2 className="mb-4 font-black">Páginas mais vistas</h2><div className="space-y-2">{porPagina.map(([p, n]) => <Barra key={p} rotulo={p} valor={n} max={porPagina[0][1]} />)}</div></div>
      <div className="card"><h2 className="mb-4 font-black">Imóveis mais vistos</h2><div className="space-y-2">{porImovel.map(([id, n]) => <Barra key={id} rotulo={db.imoveis.find(i => i.id === id)?.codigo ?? id} valor={n} max={porImovel[0][1]} />)}</div></div>
    </div>
  </>
}

/* ---------------- Guarita IA ---------------- */
function destaques(i: Imovel) {
  const d: string[] = []
  if (i.quartos) d.push(`${i.quartos} ${i.quartos > 1 ? 'dormitórios' : 'dormitório'}`)
  if (i.banheiros) d.push(`${i.banheiros} ${i.banheiros > 1 ? 'banheiros' : 'banheiro'}`)
  if (i.vagas) d.push(`${i.vagas} ${i.vagas > 1 ? 'vagas' : 'vaga'} de garagem`)
  if (i.area) d.push(`${i.area} m²`)
  return d
}

export function gerarDescricao(i: Imovel, tom: 'formal' | 'descontraido') {
  const d = destaques(i).join(', ')
  const preco = i.finalidade === 'aluguel' ? `Aluguel de ${brl(i.preco)}${i.condominio ? ` + condomínio de ${brl(i.condominio)}` : ''}.` : `Valor de venda: ${brl(i.preco)}.`
  if (tom === 'formal') return `${i.tipo} ${i.finalidade === 'aluguel' ? 'para locação' : 'à venda'} no bairro ${i.bairro}, em ${i.cidade}. O imóvel conta com ${d}. ${i.descricao ? i.descricao + ' ' : ''}Localização privilegiada, próxima a comércio, serviços e transporte. ${preco} Agende sua visita com a nossa equipe.`
  return `Procurando ${i.tipo.toLowerCase()} ${i.finalidade === 'aluguel' ? 'para alugar' : 'para comprar'} em ${i.bairro}? 😍 Esse aqui tem ${d} e está esperando por você! ${i.descricao ? i.descricao + ' ' : ''}Tudo pertinho: mercado, padaria e transporte. ${preco} Bora marcar uma visita? 🏡`
}

export function gerarPost(i: Imovel) {
  const tag = (s: string) => '#' + s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
  return `🏡 ${i.titulo}\n📍 ${i.bairro}, ${i.cidade}\n\n✔ ${destaques(i).join('\n✔ ')}\n\n💰 ${i.finalidade === 'aluguel' ? brl(i.preco) + '/mês' : brl(i.preco)}\n\n📲 Chama no WhatsApp e agende sua visita!\nCód. ${i.codigo}\n\n${[tag(i.bairro), tag(i.cidade), tag(i.tipo), i.finalidade === 'aluguel' ? '#aluguel' : '#imovelavenda', '#imoveis', '#imobiliaria'].join(' ')}`
}

/** Extrai dados de um texto livre (ex.: mensagem do proprietário) para pré-preencher o cadastro. */
export function extrairImovel(texto: string): Partial<Imovel> {
  const t = texto.toLowerCase()
  const n = (re: RegExp) => { const m = t.match(re); return m ? Number(m[1].replace(/\./g, '').replace(',', '.')) : undefined }
  const mil = n(/([\d.,]+)\s*mil\b/)
  const preco = n(/r\$\s*([\d.]+(?:,\d{2})?)/) ?? (mil ? mil * 1000 : undefined)
  const tipo = tiposImovel.find(x => t.includes(x.toLowerCase())) ?? (t.includes('apto') ? 'Apartamento' : undefined)
  const bairro = texto.match(/(?:bairro|no|na|em)\s+([A-ZÁÉÍÓÚÂÊÔÃÕÇ][\wÀ-ú]+(?:\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ][\wÀ-ú]+)*)/)?.[1]
  return {
    tipo, bairro, preco: Number.isFinite(preco) ? preco : undefined,
    finalidade: /alug|loca/.test(t) ? 'aluguel' : 'venda',
    quartos: n(/(\d+)\s*(?:quartos?|dormit[óo]rios?|dorms?)/), banheiros: n(/(\d+)\s*banheiros?/), vagas: n(/(\d+)\s*vagas?/), area: n(/([\d.,]+)\s*m(?:²|2)/),
    condominio: n(/condom[íi]nio\s*(?:de\s*)?r?\$?\s*([\d.]+)/),
  }
}

export function IA() {
  const db = useDB(d => d)
  const [aba, setAba] = useState<'descricao' | 'post' | 'cadastro'>('descricao')
  const [imovelId, setImovelId] = useState(db.imoveis[0]?.id ?? '')
  const [tom, setTom] = useState<'formal' | 'descontraido'>('formal')
  const [saida, setSaida] = useState('')
  const [texto, setTexto] = useState('Tenho um apartamento no bairro Vila Madalena para alugar, 2 quartos, 1 banheiro, 1 vaga, 65 m², aluguel R$ 3.800 e condomínio de 700.')
  const [extraido, setExtraido] = useState<Partial<Imovel> | null>(null)
  const im = db.imoveis.find(i => i.id === imovelId)
  const cred = db.config.creditosIA
  const usar = (fn: () => void) => { if (!usarCreditoIA()) return notificar('Créditos de IA do mês esgotados'); fn() }
  return <>
    <PageHeader titulo="Guarita IA" sub="Assistentes para escrever anúncios, posts e cadastrar imóveis" acoes={<Badge cor="preto">{cred.usados}/{cred.limite} créditos usados no mês</Badge>} />
    <Tabs abas={[{ id: 'descricao', nome: 'Descrição de imóvel' }, { id: 'post', nome: 'Gerador de posts' }, { id: 'cadastro', nome: 'Cadastro por texto' }]} ativa={aba} onChange={a => { setAba(a); setSaida('') }} />
    {aba !== 'cadastro' && <div className="grid gap-6 lg:grid-cols-2">
      <div className="card space-y-4">
        <Campo label="Imóvel"><select className="input" value={imovelId} onChange={e => setImovelId(e.target.value)}>{db.imoveis.map(i => <option key={i.id} value={i.id}>{i.codigo} · {i.titulo}</option>)}</select></Campo>
        {aba === 'descricao' && <Campo label="Tom"><select className="input" value={tom} onChange={e => setTom(e.target.value as 'formal')}><option value="formal">Formal</option><option value="descontraido">Descontraído</option></select></Campo>}
        <button className="btn-primary" disabled={!im} onClick={() => im && usar(() => setSaida(aba === 'descricao' ? gerarDescricao(im, tom) : gerarPost(im)))}>Gerar</button>
      </div>
      <div className="card">
        <div className="label">Resultado</div>
        <textarea className="input min-h-[240px]" value={saida} onChange={e => setSaida(e.target.value)} placeholder="O texto gerado aparece aqui e pode ser editado." />
        <div className="mt-3 flex gap-2">
          <button className="btn-ghost" disabled={!saida} onClick={() => { navigator.clipboard?.writeText(saida); notificar('Copiado!') }}>Copiar</button>
          {aba === 'descricao' && <button className="btn-dark" disabled={!saida || !im} onClick={() => { update(d => { d.imoveis.find(x => x.id === imovelId)!.descricao = saida }); notificar('Descrição salva no imóvel') }}>Salvar no imóvel</button>}
          {aba === 'post' && <button className="btn-dark" disabled={!saida || !im} onClick={() => { update(d => { d.site.posts.unshift({ id: uid(), titulo: im!.titulo, conteudo: saida, em: hoje() }) }); notificar('Post publicado no blog do site') }}>Publicar no blog</button>}
        </div>
      </div>
    </div>}
    {aba === 'cadastro' && <div className="grid gap-6 lg:grid-cols-2">
      <div className="card space-y-3">
        <Campo label="Cole a mensagem do proprietário ou a descrição do imóvel"><textarea className="input" rows={8} value={texto} onChange={e => setTexto(e.target.value)} /></Campo>
        <button className="btn-primary" onClick={() => usar(() => setExtraido(extrairImovel(texto)))}>Extrair dados</button>
      </div>
      <div className="card">
        <div className="label">Dados encontrados</div>
        {extraido ? <>
          <table className="table"><tbody>{Object.entries(extraido).map(([k, v]) => <tr key={k}><td className="capitalize">{k}</td><td className="font-semibold">{v === undefined ? <span className="text-ink-muted">não encontrado</span> : String(v)}</td></tr>)}</tbody></table>
          <button className="btn-dark mt-4" onClick={() => {
            const base = novoImovel(`GM-${100 + getDB().imoveis.length + 1}`)
            const novo: Imovel = { ...base, ...Object.fromEntries(Object.entries(extraido).filter(([, v]) => v !== undefined)), descricao: texto, titulo: `${extraido.tipo ?? 'Imóvel'} ${extraido.quartos ? extraido.quartos + ' dorm. ' : ''}${extraido.bairro ? 'em ' + extraido.bairro : ''}`.trim(), publicadoSite: false }
            novo.fotos = [placeholderFoto(novo.id, novo.codigo)]
            salvarItem('imoveis', novo); notificar(`Imóvel ${novo.codigo} criado como rascunho (fora do site). Revise em Imóveis.`)
          }}>Criar imóvel com esses dados</button>
        </> : <p className="text-sm text-ink-muted">Clique em “Extrair dados”.</p>}
      </div>
    </div>}
    <p className="mt-6 text-xs text-ink-muted">Os assistentes desta versão funcionam com regras locais, sem enviar dados para fora. Dá para ligá-los a um modelo de linguagem depois, por API.</p>
  </>
}
