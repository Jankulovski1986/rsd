import Link from "next/link";
import Client from "./client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function getEntries(id: string) {
  const res = await fetch(`${process.env.APP_BASE_URL}/api/verzeichnis/${id}`, { cache: 'no-store' });
  if (!res.ok) return [] as any[];
  return res.json();
}

export default async function VerzeichnisPage({ params }: { params: { id: string } }) {
  const id = params.id;
  const entries = await getEntries(id);
  return (
    <main className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Verzeichnis {id}</h1>
        <Link href="/" className="text-blue-700 underline">Zurück</Link>
      </div>
      <Client id={id} initial={entries} />
    </main>
  );
}
