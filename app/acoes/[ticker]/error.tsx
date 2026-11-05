'use client';

export default function StockPageError({ reset }: { reset: () => void }) {
  return (
    <main className="min-h-[60vh] bg-[#f1f6ff] px-4 py-16 text-[#0b1b3f] sm:px-6">
      <section className="mx-auto max-w-xl rounded-2xl border border-[#dce6f7] bg-white p-6 text-center shadow-sm">
        <h1 className="text-xl font-extrabold">Não foi possível carregar esta análise</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Os dados armazenados não estão disponíveis agora. Tente novamente em alguns instantes.
        </p>
        <button
          className="mt-5 rounded-lg bg-[#1d4ed8] px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1d4ed8]"
          onClick={reset}
          type="button"
        >
          Tentar novamente
        </button>
      </section>
    </main>
  );
}
