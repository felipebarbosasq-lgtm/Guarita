import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge, Logo } from '../components/ui'
import { useDB } from '../lib/store'
import { brl, competenciaBR, dataBR, hoje } from '../lib/format'

/** Área do inquilino e do proprietário: faturas, repasses e contratos. */
export default function Portal() {
  const db = useDB(d => d)
  const [doc, setDoc] = useState('')
  const [pessoaId, setPessoaId] = useState<string | null>(null)
  const pessoa = db.pessoas.find(p => p.id === pessoaId)
  const limpa = (s: string) => s.replace(/\D/g, '')
  if (!pessoa) return (
    <div className="flex min-h-screen items-center justify-center bg-brand p-4">
      <form className="w-full max-w-sm space-y-4 rounded-2xl border-4 border-ink bg-white p-6 shadow-[8px_8px_0_#0A0A0A]" onSubmit={e => {
        e.preventDefault()
        const p = db.pessoas.find(p => (limpa(doc) && limpa(p.documento) === limpa(doc)) || p.email.toLowerCase() === doc.toLowerCase().trim())
        if (p) setPessoaId(p.id); else alert('Cadastro não encontrado. Confira o CPF/CNPJ ou e-mail.')
      }}>
        <Logo />
        <h1 className="text-2xl font-black">Área do cliente</h1>
        <p className="text-sm text-ink-muted">Inquilinos e proprietários: acompanhe faturas, repasses e contratos.</p>
        <input className="input" placeholder="CPF, CNPJ ou e-mail" value={doc} onChange={e => setDoc(e.target.value)} required />
        <button className="btn-dark w-full py-3">Entrar</button>
        <p className="text-xs text-ink-muted">Demonstração: use 234.567.890-11 (inquilina) ou 123.456.789-00 (proprietário).</p>
      </form>
    </div>
  )
  const comoInquilino = db.contratos.filter(c => c.inquilinoId === pessoa.id)
  const comoProprietario = db.contratos.filter(c => c.proprietarioId === pessoa.id)
  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="border-b border-neutral-200 bg-white"><div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4"><Logo to="/portal" /><button className="btn-ghost" onClick={() => setPessoaId(null)}>Sair</button></div></header>
      <main className="mx-auto max-w-5xl space-y-8 px-4 py-8">
        <h1 className="text-3xl font-black">Olá, {pessoa.nome.split(' ')[0]}</h1>
        {comoInquilino.map(c => {
          const fs = db.faturas.filter(f => f.contratoId === c.id).sort((a, b) => b.competencia.localeCompare(a.competencia))
          return <section key={c.id} className="card">
            <h2 className="text-xl font-black">Meu aluguel · {db.imoveis.find(i => i.id === c.imovelId)?.titulo}</h2>
            <p className="text-sm text-ink-muted">Contrato {c.codigo} · vence todo dia {c.diaVencimento} · reajuste pelo {c.indice}</p>
            <table className="table mt-4"><thead><tr><th>Competência</th><th>Vencimento</th><th>Valor</th><th>Status</th></tr></thead>
              <tbody>{fs.map(f => <tr key={f.id}><td>{competenciaBR(f.competencia)}</td><td>{dataBR(f.vencimento)}</td><td className="font-semibold">{brl(f.valor)}</td><td>{f.status === 'paga' ? <Badge cor="verde">Paga</Badge> : f.vencimento < hoje() ? <Badge cor="vermelho">Em atraso</Badge> : <Badge cor="amarelo">Em aberto</Badge>}</td></tr>)}</tbody></table>
            {!fs.length && <p className="mt-3 text-sm text-ink-muted">Nenhuma fatura emitida ainda.</p>}
          </section>
        })}
        {comoProprietario.length > 0 && <section className="card">
          <h2 className="text-xl font-black">Meus imóveis administrados</h2>
          <table className="table mt-4"><thead><tr><th>Contrato</th><th>Imóvel</th><th>Aluguel</th><th>Status</th></tr></thead>
            <tbody>{comoProprietario.map(c => <tr key={c.id}><td>{c.codigo}</td><td>{db.imoveis.find(i => i.id === c.imovelId)?.titulo}</td><td>{brl(c.valorAluguel)}</td><td><Badge cor={c.status === 'ativo' ? 'verde' : 'cinza'}>{c.status}</Badge></td></tr>)}</tbody></table>
          <h3 className="mt-6 font-black">Extrato de repasses</h3>
          <table className="table mt-2"><thead><tr><th>Contrato</th><th>Bruto</th><th>Taxa</th><th>Líquido</th><th>Status</th></tr></thead>
            <tbody>{db.repasses.filter(r => r.proprietarioId === pessoa.id).map(r => <tr key={r.id}><td>{db.contratos.find(c => c.id === r.contratoId)?.codigo}</td><td>{brl(r.valorBruto)}</td><td>−{brl(r.taxa)}</td><td className="font-semibold">{brl(r.valorLiquido)}</td><td>{r.status === 'realizado' ? <Badge cor="verde">Pago em {dataBR(r.realizadoEm)}</Badge> : <Badge cor="amarelo">Previsto {dataBR(r.previsto)}</Badge>}</td></tr>)}</tbody></table>
        </section>}
        {!comoInquilino.length && !comoProprietario.length && <p className="text-ink-muted">Você ainda não tem contratos conosco.</p>}
        <Link to="/s" className="text-sm font-semibold underline">Ir para o site da imobiliária</Link>
      </main>
    </div>
  )
}
