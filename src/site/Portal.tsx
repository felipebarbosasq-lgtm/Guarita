import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Badge, Logo } from '../components/ui'
import { api } from '../lib/store'
import { brl, competenciaBR, dataBR, hoje } from '../lib/format'

interface DadosPortal {
  nome: string
  alugueis: { codigo: string; imovel: string; diaVencimento: number; indice: string; faturas: { id: string; competencia: string; vencimento: string; valor: number; status: string }[] }[]
  imoveis: { codigo: string; imovel: string; valorAluguel: number; status: string }[]
  repasses: { id: string; contrato?: string; valorBruto: number; taxa: number; valorLiquido: number; status: string; previsto: string; realizadoEm?: string }[]
}

/** Área do inquilino e do proprietário: faturas, repasses e contratos. */
export default function Portal() {
  const { slug = '' } = useParams()
  const [documento, setDocumento] = useState('')
  const [email, setEmail] = useState('')
  const [erro, setErro] = useState('')
  const [dados, setDados] = useState<DadosPortal | null>(null)
  const entrar = async (e: FormEvent) => {
    e.preventDefault(); setErro('')
    try { setDados(await api<DadosPortal>(`/api/publico/${slug}/portal`, { corpo: { documento, email } })) } catch (x) { setErro(x instanceof Error ? x.message : 'Erro') }
  }
  if (!dados) return (
    <div className="flex min-h-screen items-center justify-center bg-brand p-4">
      <form className="w-full max-w-sm space-y-4 rounded-2xl border-4 border-ink bg-white p-6 shadow-[8px_8px_0_#0A0A0A]" onSubmit={e => void entrar(e)}>
        <Logo />
        <h1 className="text-2xl font-black">Área do cliente</h1>
        <p className="text-sm text-ink-muted">Inquilinos e proprietários: acompanhe faturas, repasses e contratos.</p>
        <input className="input" placeholder="CPF ou CNPJ" value={documento} onChange={e => setDocumento(e.target.value)} required />
        <input className="input" type="email" placeholder="E-mail cadastrado" value={email} onChange={e => setEmail(e.target.value)} required />
        {erro && <p className="text-sm font-semibold text-red-700" role="alert">{erro}</p>}
        <button className="btn-dark w-full py-3">Entrar</button>
        {slug === 'demo' && <p className="text-xs text-ink-muted">Demonstração: 234.567.890-11 + juliana@email.com (inquilina) ou 123.456.789-00 + marcos@email.com (proprietário).</p>}
      </form>
    </div>
  )
  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="border-b border-neutral-200 bg-white"><div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4"><Logo to={`/portal/${slug}`} /><button className="btn-ghost" onClick={() => setDados(null)}>Sair</button></div></header>
      <main className="mx-auto max-w-5xl space-y-8 px-4 py-8">
        <h1 className="text-3xl font-black">Olá, {dados.nome.split(' ')[0]}</h1>
        {dados.alugueis.map(c => (
          <section key={c.codigo} className="card overflow-x-auto">
            <h2 className="text-xl font-black">Meu aluguel · {c.imovel}</h2>
            <p className="text-sm text-ink-muted">Contrato {c.codigo} · vence todo dia {c.diaVencimento} · reajuste pelo {c.indice}</p>
            <table className="table mt-4"><thead><tr><th>Competência</th><th>Vencimento</th><th>Valor</th><th>Status</th></tr></thead>
              <tbody>{c.faturas.map(f => <tr key={f.id}><td>{competenciaBR(f.competencia)}</td><td>{dataBR(f.vencimento)}</td><td className="font-semibold">{brl(f.valor)}</td><td>{f.status === 'paga' ? <Badge cor="verde">Paga</Badge> : f.vencimento < hoje() ? <Badge cor="vermelho">Em atraso</Badge> : <Badge cor="amarelo">Em aberto</Badge>}</td></tr>)}</tbody></table>
            {!c.faturas.length && <p className="mt-3 text-sm text-ink-muted">Nenhuma fatura emitida ainda.</p>}
          </section>
        ))}
        {dados.imoveis.length > 0 && <section className="card overflow-x-auto">
          <h2 className="text-xl font-black">Meus imóveis administrados</h2>
          <table className="table mt-4"><thead><tr><th>Contrato</th><th>Imóvel</th><th>Aluguel</th><th>Status</th></tr></thead>
            <tbody>{dados.imoveis.map(c => <tr key={c.codigo}><td>{c.codigo}</td><td>{c.imovel}</td><td>{brl(c.valorAluguel)}</td><td><Badge cor={c.status === 'ativo' ? 'verde' : 'cinza'}>{c.status}</Badge></td></tr>)}</tbody></table>
          <h3 className="mt-6 font-black">Extrato de repasses</h3>
          <table className="table mt-2"><thead><tr><th>Contrato</th><th>Bruto</th><th>Taxa</th><th>Líquido</th><th>Status</th></tr></thead>
            <tbody>{dados.repasses.map(r => <tr key={r.id}><td>{r.contrato}</td><td>{brl(r.valorBruto)}</td><td>−{brl(r.taxa)}</td><td className="font-semibold">{brl(r.valorLiquido)}</td><td>{r.status === 'realizado' ? <Badge cor="verde">Pago em {dataBR(r.realizadoEm)}</Badge> : <Badge cor="amarelo">Previsto {dataBR(r.previsto)}</Badge>}</td></tr>)}</tbody></table>
          {!dados.repasses.length && <p className="mt-2 text-sm text-ink-muted">Nenhum repasse ainda.</p>}
        </section>}
        {!dados.alugueis.length && !dados.imoveis.length && <p className="text-ink-muted">Você ainda não tem contratos conosco.</p>}
        <Link to={`/s/${slug}`} className="text-sm font-semibold underline">Ir para o site da imobiliária</Link>
      </main>
    </div>
  )
}
