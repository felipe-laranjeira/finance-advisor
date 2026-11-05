import Link from 'next/link';

export default function StockNotFound() {
  return (
    <main className="min-h-[60vh] bg-[#f1f6ff] px-4 py-16 text-[#0b1b3f] sm:px-6">
      <section className="mx-auto max-w-xl rounded-2xl border border-[#dce6f7] bg-white p-6 text-center shadow-sm">
        <p className="text-sm font-bold uppercase tracking-widest text-[#1d4ed8]">Ação não encontrada</p>
        <h1 className="mt-2 text-2xl font-extrabold">Este ticker não está disponível</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Confira o código ou volte à lista de ações ativas da B3.
        </p>
        <Link
          className="mt-5 inline-flex rounded-lg bg-[#1d4ed8] px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1d4ed8]"
          href="/#acoes"
        >
          Voltar para a lista
        </Link>
      </section>
    </main>
  );
}
