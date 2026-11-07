import { useState } from 'react'
import { Link } from 'react-router-dom'
import { faq, produtos } from './conteudo'

export default function Home() {
  const [aberta, setAberta] = useState<number | null>(0)
  return (
    <main>
      {/* Hero */}
      <section className="relative overflow-hidden bg-brand">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-16 lg:grid-cols-2 lg:py-24">
          <div>
            <span className="badge bg-ink text-brand">CRM + ERP + Site + IA</span>
            <h1 className="mt-5 text-4xl font-black leading-[1.05] tracking-tight sm:text-6xl">A imobiliária inteira num sistema só.</h1>
            <p className="mt-5 max-w-xl text-lg">Leads, funil de vendas, site, contratos de aluguel, cobrança, repasse e financeiro conversando entre si. Menos planilha, mais negócio fechado.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/demonstracao" className="btn-dark px-6 py-3 text-base">Agendar demonstração</Link>
              <Link to="/login" className="btn bg-white px-6 py-3 text-base text-ink hover:bg-neutral-100">Testar agora</Link>
            </div>
          </div>
          <div className="relative">
            <div className="rounded-2xl border-4 border-ink bg-white p-4 shadow-[12px_12px_0_#0A0A0A]">
              <div className="mb-3 flex gap-1.5"><span className="h-3 w-3 rounded-full bg-ink" /><span className="h-3 w-3 rounded-full bg-neutral-300" /><span className="h-3 w-3 rounded-full bg-neutral-300" /></div>
              <div className="grid grid-cols-3 gap-2">
                {['Novo lead', 'Visita', 'Proposta'].map((col, i) => (
                  <div key={col} className="rounded-lg bg-neutral-100 p-2">
                    <div className="mb-2 text-xs font-bold">{col}</div>
                    {Array.from({ length: 3 - i }).map((_, j) => (
                      <div key={j} className="mb-2 rounded-md border border-neutral-200 bg-white p-2">
                        <div className="h-2 w-3/4 rounded bg-ink/80" />
                        <div className="mt-1.5 h-2 w-1/2 rounded bg-neutral-200" />
                        <div className="mt-2 h-4 w-10 rounded bg-brand" />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Plataforma */}
      <section className="mx-auto max-w-7xl px-4 py-20">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-black tracking-tight sm:text-4xl">Uma plataforma, todos os setores</h2>
          <p className="mt-3 text-ink-muted">O lead que chega pelo site já cai no CRM. O contrato fechado já gera fatura. A fatura paga já vira repasse e receita no financeiro.</p>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {produtos.map(p => (
            <Link key={p.slug} to={`/${p.slug}`} className="group rounded-2xl border-2 border-ink p-6 transition hover:-translate-y-1 hover:bg-brand hover:shadow-[6px_6px_0_#0A0A0A]">
              <div className="text-xl font-black">{p.nome}</div>
              <p className="mt-2 text-sm text-ink-muted group-hover:text-ink">{p.sub}</p>
              <div className="mt-4 text-sm font-bold">Conhecer →</div>
            </Link>
          ))}
        </div>
      </section>

      {/* Fluxo integrado */}
      <section className="bg-ink py-20 text-white">
        <div className="mx-auto max-w-7xl px-4">
          <h2 className="text-3xl font-black tracking-tight sm:text-4xl">Do primeiro clique ao repasse</h2>
          <div className="mt-10 grid gap-4 md:grid-cols-5">
            {[
              ['1', 'Site e portais', 'O visitante pede informações sobre um imóvel.'],
              ['2', 'Roleta', 'O lead vai para o próximo corretor da fila.'],
              ['3', 'Funil', 'Visita, proposta e negociação acompanhadas.'],
              ['4', 'Contrato', 'Locação fechada gera fatura todo mês.'],
              ['5', 'Repasse', 'Pagamento recebido, proprietário pago, taxa no caixa.'],
            ].map(([n, t, d]) => (
              <div key={n} className="rounded-2xl border border-white/15 p-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand font-black text-ink">{n}</div>
                <div className="mt-4 font-bold">{t}</div>
                <p className="mt-1 text-sm text-neutral-400">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* IA */}
      <section className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-20 lg:grid-cols-2">
        <div>
          <span className="badge bg-brand text-ink">Guarita IA</span>
          <h2 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">Deixe o texto com a gente</h2>
          <p className="mt-3 text-ink-muted">Descrições de anúncio, posts para redes sociais e cadastro de imóvel a partir de um texto livre, direto dentro do sistema.</p>
          <Link to="/ia-para-imobiliaria" className="btn-dark mt-6">Ver recursos de IA</Link>
        </div>
        <div className="rounded-2xl border-2 border-ink bg-neutral-50 p-6 font-mono text-sm">
          <div className="text-ink-muted">› gerar descrição GM-101</div>
          <p className="mt-3 rounded-lg bg-white p-4 font-sans">Apartamento de 92 m² na Vila Mariana, com 3 dormitórios (1 suíte), varanda gourmet e 2 vagas. Pronto para morar, perto do metrô e de tudo que o bairro oferece.</p>
        </div>
      </section>

      {/* Números */}
      <section className="border-y-2 border-ink bg-brand">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-6 px-4 py-12 text-center md:grid-cols-4">
          {[['6', 'módulos integrados'], ['15', 'blocos no editor de site'], ['99', 'parcelas por lançamento'], ['24h', 'site captando leads']].map(([n, t]) => (
            <div key={t}><div className="font-display text-4xl font-black">{n}</div><div className="text-sm font-semibold">{t}</div></div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-4 py-20">
        <h2 className="text-center text-3xl font-black tracking-tight">Perguntas frequentes</h2>
        <div className="mt-8 divide-y divide-neutral-200 rounded-2xl border border-neutral-200">
          {faq.map((f, i) => (
            <div key={f.p}>
              <button className="flex w-full items-center justify-between px-5 py-4 text-left font-semibold" onClick={() => setAberta(aberta === i ? null : i)}>
                {f.p}<span className="text-xl">{aberta === i ? '−' : '+'}</span>
              </button>
              {aberta === i && <p className="px-5 pb-4 text-sm text-ink-muted">{f.r}</p>}
            </div>
          ))}
        </div>
      </section>

      <section className="px-4 pb-20">
        <div className="mx-auto max-w-7xl rounded-3xl bg-ink px-6 py-14 text-center text-white">
          <h2 className="text-3xl font-black tracking-tight sm:text-4xl">Pronto para organizar a sua imobiliária?</h2>
          <p className="mx-auto mt-3 max-w-xl text-neutral-400">Mostramos o sistema com os dados da sua operação, sem compromisso.</p>
          <Link to="/demonstracao" className="btn-primary mt-8 px-8 py-3 text-base">Agendar demonstração</Link>
        </div>
      </section>
    </main>
  )
}
