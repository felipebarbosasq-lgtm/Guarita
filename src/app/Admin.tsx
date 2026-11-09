import { useState, type FormEvent } from 'react'
import { Badge, Campo, Modal, PageHeader, Tabs, notificar } from '../components/ui'
import { definirSenhaUsuario, getDB, restaurarBackup, salvarItem, update, useDB } from '../lib/store'
import { downloadArquivo, uid } from '../lib/format'
import type { DB, Indice, Papel, Usuario } from '../lib/types'
import { feedXML } from './Imoveis'

export const permissoes: Record<Papel, string[]> = {
  admin: ['Tudo: CRM, locação, financeiro, site, equipe e configurações'],
  corretor: ['CRM: leads, funil, propostas, imóveis e chaves', 'Locação: consulta de contratos e faturas', 'Site e Guarita IA'],
  financeiro: ['Locação: contratos, faturas, régua e repasses', 'Financeiro: contas, conciliação, DRE e cadastros', 'CRM: consulta'],
}

export function Equipe() {
  const usuarios = useDB(d => d.usuarios)
  const [edit, setEdit] = useState<Usuario | null>(null)
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const novo = edit ? !usuarios.some(u => u.id === edit.id) : false
  const abrir = (u: Usuario | null) => { setEdit(u); setSenha(''); setErro('') }
  const salvar = async (e: FormEvent) => {
    e.preventDefault(); if (!edit) return
    if (novo && senha.length < 8) return setErro('Defina uma senha de pelo menos 8 caracteres para o novo usuário.')
    if (senha && senha.length < 8) return setErro('A senha precisa ter pelo menos 8 caracteres.')
    salvarItem('usuarios', { ...edit, email: edit.email.trim().toLowerCase() })
    try { if (senha) await definirSenhaUsuario(edit.id, senha); notificar(novo ? 'Usuário criado. Envie o e-mail e a senha para a pessoa.' : 'Usuário salvo'); abrir(null) }
    catch (x) { setErro(x instanceof Error ? x.message : 'Erro ao definir a senha.') }
  }
  return <>
    <PageHeader titulo="Equipe e permissões" sub="Usuários e o que cada papel pode fazer" acoes={<button className="btn-primary" onClick={() => abrir({ id: uid(), nome: '', email: '', telefone: '', papel: 'corretor', ativo: true })}>+ Usuário</button>} />
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="card overflow-x-auto p-0 lg:col-span-2"><table className="table">
        <thead><tr><th>Nome</th><th>E-mail</th><th>Papel</th><th>Status</th><th></th></tr></thead>
        <tbody>{usuarios.map(u => <tr key={u.id}><td className="font-semibold">{u.nome}</td><td>{u.email}</td><td className="capitalize">{u.papel}</td><td><Badge cor={u.ativo ? 'verde' : 'cinza'}>{u.ativo ? 'ativo' : 'inativo'}</Badge></td><td><button className="text-sm font-semibold underline" onClick={() => abrir(u)}>Editar</button></td></tr>)}</tbody>
      </table></div>
      <div className="card space-y-4">{(Object.keys(permissoes) as Papel[]).map(p => <div key={p}><div className="font-black capitalize">{p}</div><ul className="mt-1 text-sm text-ink-muted">{permissoes[p].map(x => <li key={x}>■ {x}</li>)}</ul></div>)}</div>
    </div>
    {edit && <Modal aberto onFechar={() => abrir(null)} titulo={novo ? 'Novo usuário' : 'Usuário'}>
      <form className="grid gap-4 sm:grid-cols-2" onSubmit={e => void salvar(e)}>
        <Campo label="Nome"><input required className="input" value={edit.nome} onChange={e => setEdit({ ...edit, nome: e.target.value })} /></Campo>
        <Campo label="E-mail"><input required type="email" className="input" value={edit.email} onChange={e => setEdit({ ...edit, email: e.target.value })} /></Campo>
        <Campo label="Telefone"><input className="input" value={edit.telefone} onChange={e => setEdit({ ...edit, telefone: e.target.value })} /></Campo>
        <Campo label="Papel"><select className="input" value={edit.papel} onChange={e => setEdit({ ...edit, papel: e.target.value as Papel })}><option value="admin">Administrador</option><option value="corretor">Corretor</option><option value="financeiro">Financeiro</option></select></Campo>
        <Campo label={novo ? 'Senha de acesso (mínimo 8)' : 'Nova senha (deixe em branco para manter)'} className="sm:col-span-2"><input type="password" className="input" autoComplete="new-password" value={senha} onChange={e => setSenha(e.target.value)} /></Campo>
        <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" className="accent-ink" checked={edit.ativo} onChange={e => setEdit({ ...edit, ativo: e.target.checked })} />Usuário ativo (desativar bloqueia o acesso na hora)</label>
        {erro && <p className="text-sm font-semibold text-red-700 sm:col-span-2">{erro}</p>}
        <div className="flex justify-end gap-2 sm:col-span-2"><button type="button" className="btn-ghost" onClick={() => abrir(null)}>Cancelar</button><button className="btn-primary">Salvar</button></div>
      </form>
    </Modal>}
  </>
}

export function Configuracoes() {
  const db = useDB(d => d)
  const [aba, setAba] = useState<'indices' | 'integracoes' | 'dados'>('indices')
  const [hook, setHook] = useState({ url: '', evento: 'lead.criado' })
  return <>
    <PageHeader titulo="Configurações" />
    <Tabs abas={[{ id: 'indices', nome: 'Índices de reajuste' }, { id: 'integracoes', nome: 'Portais e webhooks' }, { id: 'dados', nome: 'Importar e exportar' }]} ativa={aba} onChange={setAba} />
    {aba === 'indices' && <div className="card max-w-lg space-y-3">
      <p className="text-sm text-ink-muted">Variação acumulada em 12 meses usada como sugestão nos reajustes. Atualize todo mês.</p>
      {(Object.keys(db.config.indices) as Indice[]).map(i => <Campo key={i} label={`${i} (%)`}><input type="number" step="0.01" className="input" value={db.config.indices[i]} onChange={e => update(d => { d.config.indices[i] = Number(e.target.value) })} /></Campo>)}
    </div>}
    {aba === 'integracoes' && <div className="grid gap-6 lg:grid-cols-2">
      <div className="card space-y-3">
        <h2 className="font-black">Feed XML para portais</h2>
        <p className="text-sm text-ink-muted">Arquivo com os imóveis disponíveis marcados para cada portal.</p>
        {['Portal A', 'Portal B', 'Portal C', 'Portal D'].map(p => <div key={p} className="flex items-center justify-between rounded-lg border border-neutral-200 p-3 text-sm"><span className="font-semibold">{p} · {db.imoveis.filter(i => i.portais.includes(p) && i.status === 'disponivel').length} imóveis</span><button className="btn-ghost px-3 py-1" onClick={() => downloadArquivo(`${p.replace(' ', '-').toLowerCase()}.xml`, feedXML(db.imoveis, p), 'application/xml')}>Baixar XML</button></div>)}
      </div>
      <div className="card space-y-3">
        <h2 className="font-black">Webhooks</h2>
        <p className="text-sm text-ink-muted">URLs que serão avisadas quando os eventos acontecerem. O cadastro fica salvo; o envio automático ainda não está ativo.</p>
        {db.config.webhooks.map(w => <div key={w.id} className="flex items-center justify-between gap-2 rounded-lg border border-neutral-200 p-3 text-sm"><span className="truncate"><Badge cor="amarelo">{w.evento}</Badge> {w.url}</span><button className="text-red-700 underline" onClick={() => update(d => { d.config.webhooks = d.config.webhooks.filter(x => x.id !== w.id) })}>remover</button></div>)}
        <form className="flex flex-wrap gap-2" onSubmit={e => { e.preventDefault(); update(d => { d.config.webhooks.push({ id: uid(), ...hook }) }); setHook({ ...hook, url: '' }) }}>
          <select className="input w-auto" value={hook.evento} onChange={e => setHook({ ...hook, evento: e.target.value })}>{['lead.criado', 'oportunidade.ganha', 'fatura.paga', 'contrato.criado'].map(x => <option key={x}>{x}</option>)}</select>
          <input required type="url" className="input flex-1" placeholder="https://…" value={hook.url} onChange={e => setHook({ ...hook, url: e.target.value })} />
          <button className="btn-dark">Adicionar</button>
        </form>
      </div>
    </div>}
    {aba === 'dados' && <div className="grid gap-6 lg:grid-cols-2">
      <div className="card space-y-3">
        <h2 className="font-black">Backup completo</h2>
        <button className="btn-dark" onClick={() => downloadArquivo('guarita-mob-backup.json', JSON.stringify(getDB(), null, 2), 'application/json')}>Exportar tudo (JSON)</button>
        <label className="btn-ghost cursor-pointer">Restaurar backup<input type="file" accept=".json" className="hidden" onChange={async e => {
          const f = e.target.files?.[0]; if (!f) return
          try { const dados = JSON.parse(await f.text()) as DB; if (!confirm('Substituir os dados atuais pelo backup? A equipe e as senhas atuais são mantidas.')) return; await restaurarBackup(dados); notificar('Backup restaurado') } catch (x) { notificar(x instanceof Error ? x.message : 'Arquivo inválido') }
        }} /></label>
      </div>
      <div className="card space-y-3">
        <h2 className="font-black">Importar imóveis em lote (CSV)</h2>
        <p className="text-xs text-ink-muted">Colunas separadas por ponto e vírgula: codigo;titulo;tipo;finalidade;preco;bairro;cidade;quartos;banheiros;vagas;area</p>
        <label className="btn-primary cursor-pointer">Importar CSV<input type="file" accept=".csv,.txt" className="hidden" onChange={async e => {
          const f = e.target.files?.[0]; if (!f) return
          const linhas = (await f.text()).split(/\r?\n/).filter(Boolean)
          const cab = linhas[0].toLowerCase().includes('codigo') ? linhas.shift() : null
          void cab
          let n = 0
          update(d => {
            for (const l of linhas) {
              const [codigo, titulo, tipo, finalidade, preco, bairro, cidade, quartos, banheiros, vagas, area] = l.split(';').map(s => s.trim())
              if (!codigo) continue
              const id = uid()
              d.imoveis.unshift({ id, codigo, titulo: titulo ?? codigo, tipo: tipo || 'Apartamento', finalidade: finalidade === 'aluguel' ? 'aluguel' : 'venda', preco: Number(preco) || 0, condominio: 0, iptu: 0, endereco: '', bairro: bairro ?? '', cidade: cidade || 'São Paulo', quartos: Number(quartos) || 0, banheiros: Number(banheiros) || 0, vagas: Number(vagas) || 0, area: Number(area) || 0, descricao: '', fotos: [], status: 'disponivel', destaque: false, publicadoSite: false, portais: [], chave: { local: '' }, criadoEm: new Date().toISOString().slice(0, 10) })
              n++
            }
          })
          notificar(`${n} imóveis importados (fora do site até revisão)`)
        }} /></label>
      </div>
    </div>}
  </>
}
