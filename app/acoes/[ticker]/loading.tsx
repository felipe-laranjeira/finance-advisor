export default function LoadingStockPage() {
  return (
    <main className="min-h-screen bg-[#f1f6ff] px-4 py-8 text-[#0b1b3f] sm:px-6 lg:px-10">
      <div className="mx-auto max-w-[1200px] animate-pulse space-y-6">
        <div className="h-5 w-56 rounded bg-blue-100" />
        <div className="rounded-2xl border border-[#dce6f7] bg-white p-6">
          <div className="h-8 w-64 rounded bg-blue-100" />
          <div className="mt-4 h-5 w-40 rounded bg-slate-100" />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <div className="h-32 rounded-2xl border border-[#dce6f7] bg-white" key={index} />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(260px,1fr)]">
          <div className="h-80 rounded-2xl border border-[#dce6f7] bg-white" />
          <div className="h-56 rounded-2xl border border-[#dce6f7] bg-white" />
        </div>
      </div>
    </main>
  );
}
