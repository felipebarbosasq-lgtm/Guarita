import { useState } from 'react'
import { Badge, Campo, Modal, PageHeader, Vazio, notificar } from '../components/ui'
import { salvarItem, update, useDB } from '../lib/store'
import { agoraISO, brl, dataHoraBR, hoje, placeholderFoto, uid } from '../lib/format'
import type { Imovel, StatusImovel } from '../lib/types'

export const statusImovel: Record<StatusImovel, [string, string]> = { disponivel: ['Disponível', 'verde'], reservado: ['Reservado', 'amarelo'], vendido: ['Vendido', 'preto'], alugado: ['Alugado', 'azul'], inativo: ['Inativo', 'cinza'] }
export const tiposImovel = ['Apartamento', 'Casa', 'Cobertura', 'Studio', 'Sala comercial', 'Loja', 'Galpão', 'Terreno', 'Chácara']
const portais = ['Portal A', 'Portal B', 'Portal C', 'Portal D']

export function novoImovel(codigo: string): Imovel {
  const id = uid()
  return { id, codigo, titulo: '', tipo: 'Apartamento', finalidade: 'venda', preco: 0, condominio: 0, iptu: 0, endereco: '', bairro: '', cidade: 'São Paulo', quartos: 2, banheiros: 1, vagas: 1, area: 0, descricao: '', fotos: [], status: 'disponivel', destaque: false, publicadoSite: true, portais: [], chave: { local: '' }, criadoEm: hoje() }
}

export function Imoveis() {
  const db = useDB(d => d)
  const [edit, setEdit] = useState<Imovel | null>(null)
  const [f, setF] = useState({ busca: '', finalidade: '', status: '', tipo: '' })
  const lista = db.imoveis.filter(i => (!f.finalidade || i.finalidade === f.finalidade) && (!f.status || i.status === f.status) && (!f.tipo || i.tipo === f.tipo) && (i.codigo + i.titulo + i.bairro + i.endereco).toLowerCase().includes(f.busca.toLowerCase()))
  const proxCodigo = `GM-${100 + db.imoveis.length + 1}`
  return <>
    <PageHeader titulo="Imóveis" sub={`${db.imoveis.length} imóveis · ${db.imoveis.filter(i => i.publicadoSite).length} no site`} acoes={<button className="btn-primary" onClick={() => setEdit(novoImovel(proxCodigo))}>+ Cadastrar imóvel</button>} />
    <div className="mb-4 flex flex-wrap gap-2">
      <input className="input max-w-xs" placeholder="Código, título, bairro…" value={f.busca} onChange={e => setF({ ...f, busca: e.target.value })} />
      <select className="input w-auto" value={f.finalidade} onChange={e => setF({ ...f, finalidade: e.target.value })}><option value="">Venda e aluguel</option><option value="venda">Venda</option><option value="aluguel">Aluguel</option></select>
      <select className="input w-auto" value={f.tipo} onChange={e => setF({ ...f, tipo: e.target.value })}><option value="">Todos os tipos</option>{tiposImovel.map(t => <option key={t}>{t}</option>)}</select>
      <select className="input w-auto" value={f.status} onChange={e => setF({ ...f, status: e.target.value })}><option value="">Todos os status</option>{Object.entries(statusImovel).map(([k, v]) => <option key={k} value={k}>{v[0]}</option>)}</select>
    </div>
    {lista.length === 0 ? <Vazio texto="Nenhum imóvel encontrado." /> : (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {lista.map(i => (
          <button key={i.id} onClick={() => setEdit(i)} className="overflow-hidden rounded-xl border border-neutral-200 bg-white text-left transition hover:border-ink hover:shadow-[4px_4px_0_#0A0A0A]">
            <div className="relative"><img src={i.fotos[0] ?? placeholderFoto(i.id, i.codigo)} alt="" className="aspect-[16/10] w-full object-cover" />
              <div className="absolute left-2 top-2 flex gap-1"><Badge cor="preto">{i.codigo}</Badge>{i.destaque && <Badge cor="amarelo">★ destaque</Badge>}</div></div>
            <div className="p-4">
              <div className="flex items-start justify-between gap-2"><div className="font-bold">{i.titulo || 'Sem título'}</div><Badge cor={statusImovel[i.status][1]}>{statusImovel[i.status][0]}</Badge></div>
              <div className="mt-1 text-sm text-ink-muted">{i.tipo} · {i.bairro}, {i.cidade}</div>
              <div className="mt-2 text-sm">{i.area} m² · {i.quartos} qts · {i.vagas} vagas</div>
              <div className="mt-3 flex items-end justify-between"><div className="font-display text-lg font-black">{brl(i.preco)}{i.finalidade === 'aluguel' && <span className="text-xs font-semibold">/mês</span>}</div><div className="text-xs text-ink-muted">{i.publicadoSite ? 'No site' : 'Fora do site'} · {i.portais.length} portais</div></div>
            </div>
          </button>
        ))}
      </div>
    )}
    {edit && <ImovelModal imovel={edit} onFechar={() => setEdit(null)} />}
  </>
}

export function ImovelModal({ imovel, onFechar }: { imovel: Imovel; onFechar: () => void }) {
  const pessoas = useDB(d => d.pessoas)
  const existe = useDB(d => d.imoveis.some(i => i.id === imovel.id))
  const [i, setI] = useState<Imovel>(imovel)
  const [url, setUrl] = useState('')
  const set = (p: Partial<Imovel>) => setI({ ...i, ...p })
  const nums: [keyof Imovel, string][] = [['preco', i.finalidade === 'aluguel' ? 'Aluguel (R$/mês)' : 'Preço (R$)'], ['condominio', 'Condomínio'], ['iptu', 'IPTU'], ['area', 'Área (m²)'], ['quartos', 'Quartos'], ['banheiros', 'Banheiros'], ['vagas', 'Vagas']]
  const enviarFotos = (files: FileList | null) => {
    if (!files) return
    Array.from(files).slice(0, 10).forEach(file => {
      const r = new FileReader()
      r.onload = () => setI(prev => ({ ...prev, fotos: [...prev.fotos, String(r.result)] }))
      r.readAsDataURL(file)
    })
  }
  return (
    <Modal aberto onFechar={onFechar} titulo={existe ? `Imóvel ${i.codigo}` : 'Cadastrar imóvel'} largura="max-w-4xl">
      <form className="grid gap-4 sm:grid-cols-4" onSubmit={e => { e.preventDefault(); salvarItem('imoveis', { ...i, fotos: i.fotos.length ? i.fotos : [placeholderFoto(i.id, i.codigo)] }); notificar('Imóvel salvo'); onFechar() }}>
        <Campo label="Código"><input className="input" value={i.codigo} onChange={e => set({ codigo: e.target.value })} required /></Campo>
        <Campo label="Título do anúncio" className="sm:col-span-3"><input className="input" value={i.titulo} onChange={e => set({ titulo: e.target.value })} required /></Campo>
        <Campo label="Tipo"><select className="input" value={i.tipo} onChange={e => set({ tipo: e.target.value })}>{tiposImovel.map(t => <option key={t}>{t}</option>)}</select></Campo>
        <Campo label="Finalidade"><select className="input" value={i.finalidade} onChange={e => set({ finalidade: e.target.value as Imovel['finalidade'] })}><option value="venda">Venda</option><option value="aluguel">Aluguel</option></select></Campo>
        <Campo label="Status"><select className="input" value={i.status} onChange={e => set({ status: e.target.value as StatusImovel })}>{Object.entries(statusImovel).map(([k, v]) => <option key={k} value={k}>{v[0]}</option>)}</select></Campo>
        <Campo label="Proprietário"><select className="input" value={i.proprietarioId ?? ''} onChange={e => set({ proprietarioId: e.target.value || undefined })}><option value="">—</option>{pessoas.filter(p => p.tipos.includes('proprietario')).map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}</select></Campo>
        {nums.map(([k, l]) => <Campo key={k} label={l}><input type="number" min={0} className="input" value={i[k] as number} onChange={e => set({ [k]: Number(e.target.value) } as Partial<Imovel>)} /></Campo>)}
        <Campo label="Endereço" className="sm:col-span-2"><input className="input" value={i.endereco} onChange={e => set({ endereco: e.target.value })} /></Campo>
        <Campo label="Bairro"><input className="input" value={i.bairro} onChange={e => set({ bairro: e.target.value })} required /></Campo>
        <Campo label="Cidade"><input className="input" value={i.cidade} onChange={e => set({ cidade: e.target.value })} /></Campo>
        <Campo label="Descrição" className="sm:col-span-4"><textarea className="input" rows={4} value={i.descricao} onChange={e => set({ descricao: e.target.value })} /></Campo>
        <div className="sm:col-span-4">
          <div className="label">Fotos</div>
          <div className="flex flex-wrap gap-2">
            {i.fotos.map((f, n) => <div key={n} className="relative"><img src={f} alt="" className="h-20 w-28 rounded-lg object-cover" />
              <button type="button" className="absolute -right-2 -top-2 h-6 w-6 rounded-full bg-ink text-xs text-white" onClick={() => set({ fotos: i.fotos.filter((_, x) => x !== n) })}>×</button>
              {n > 0 && <button type="button" className="absolute bottom-1 left-1 rounded bg-white/90 px-1 text-[10px] font-bold" onClick={() => { const fs = [...i.fotos];[fs[0], fs[n]] = [fs[n], fs[0]]; set({ fotos: fs }) }}>capa</button>}</div>)}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <input className="input max-w-sm" placeholder="Colar URL de uma foto" value={url} onChange={e => setUrl(e.target.value)} />
            <button type="button" className="btn-ghost" onClick={() => { if (url) { set({ fotos: [...i.fotos, url] }); setUrl('') } }}>Adicionar URL</button>
            <label className="btn-ghost cursor-pointer">Enviar arquivos<input type="file" accept="image/*" multiple className="hidden" onChange={e => enviarFotos(e.target.files)} /></label>
          </div>
        </div>
        <div className="sm:col-span-2">
          <div className="label">Publicação</div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-ink" checked={i.publicadoSite} onChange={e => set({ publicadoSite: e.target.checked })} />Publicar no site</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-ink" checked={i.destaque} onChange={e => set({ destaque: e.target.checked })} />Destaque na página inicial</label>
        </div>
        <div className="sm:col-span-2">
          <div className="label">Portais (exportação XML)</div>
          {portais.map(p => <label key={p} className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-ink" checked={i.portais.includes(p)} onChange={e => set({ portais: e.target.checked ? [...i.portais, p] : i.portais.filter(x => x !== p) })} />{p}</label>)}
        </div>
        <Campo label="Local da chave" className="sm:col-span-2"><input className="input" value={i.chave.local} onChange={e => set({ chave: { ...i.chave, local: e.target.value } })} placeholder="Ex.: Quadro 2, gancho 14" /></Campo>
        <div className="flex justify-end gap-2 sm:col-span-4">
          {existe && <button type="button" className="btn-danger mr-auto" onClick={() => { if (confirm('Excluir este imóvel?')) { update(d => { d.imoveis = d.imoveis.filter(x => x.id !== i.id) }); onFechar() } }}>Excluir</button>}
          <button type="button" className="btn-ghost" onClick={onFechar}>Cancelar</button><button className="btn-primary">Salvar imóvel</button>
        </div>
      </form>
    </Modal>
  )
}

/** Gera o feed XML de imóveis para os portais (formato genérico). */
export function feedXML(imoveis: Imovel[], portal: string) {
  const esc = (s: string) => s.replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]!))
  const itens = imoveis.filter(i => i.portais.includes(portal) && i.status === 'disponivel').map(i => `  <imovel>
    <codigo>${esc(i.codigo)}</codigo><titulo>${esc(i.titulo)}</titulo><tipo>${esc(i.tipo)}</tipo><finalidade>${i.finalidade}</finalidade>
    <preco>${i.preco}</preco><condominio>${i.condominio}</condominio><iptu>${i.iptu}</iptu><area>${i.area}</area>
    <quartos>${i.quartos}</quartos><banheiros>${i.banheiros}</banheiros><vagas>${i.vagas}</vagas>
    <endereco>${esc(i.endereco)}</endereco><bairro>${esc(i.bairro)}</bairro><cidade>${esc(i.cidade)}</cidade>
    <descricao>${esc(i.descricao)}</descricao>
  </imovel>`).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<carga portal="${esc(portal)}">\n${itens}\n</carga>\n`
}

export function Chaves() {
  const imoveis = useDB(d => d.imoveis)
  const usuarios = useDB(d => d.usuarios)
  const [quem, setQuem] = useState<Record<string, string>>({})
  return <>
    <PageHeader titulo="Gestão de chaves" sub="Onde está cada chave e com quem" />
    <div className="card overflow-x-auto p-0"><table className="table">
      <thead><tr><th>Imóvel</th><th>Local</th><th>Situação</th><th>Ação</th></tr></thead>
      <tbody>{imoveis.map(i => (
        <tr key={i.id}><td><b>{i.codigo}</b> · {i.titulo}</td><td>{i.chave.local || '—'}</td>
          <td>{i.chave.retiradaPor ? <Badge cor="amarelo">Com {i.chave.retiradaPor} desde {dataHoraBR(i.chave.retiradaEm)}</Badge> : <Badge cor="verde">No quadro</Badge>}</td>
          <td>{i.chave.retiradaPor
            ? <button className="btn-ghost" onClick={() => update(d => { const x = d.imoveis.find(x => x.id === i.id)!; x.chave = { local: x.chave.local } })}>Registrar devolução</button>
            : <div className="flex gap-2"><select className="input w-44" value={quem[i.id] ?? ''} onChange={e => setQuem({ ...quem, [i.id]: e.target.value })}><option value="">Retirada por…</option>{usuarios.map(u => <option key={u.id}>{u.nome}</option>)}</select>
              <button className="btn-dark" disabled={!quem[i.id]} onClick={() => update(d => { const x = d.imoveis.find(x => x.id === i.id)!; x.chave = { ...x.chave, retiradaPor: quem[i.id], retiradaEm: agoraISO() } })}>Retirar</button></div>}
          </td></tr>
      ))}</tbody>
    </table></div>
  </>
}
