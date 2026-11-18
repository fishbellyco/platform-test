import { notFound } from "next/navigation";
import { getDeps } from "@/lib/deps";

export const dynamic = "force-dynamic";

const colour: Record<string, string> = {
  pass: "text-green-700",
  succeeded: "text-green-700",
  fail: "text-red-700",
  failed: "text-red-700",
  not_checked: "text-amber-700",
  running: "text-amber-700",
};

// One design, start to finish: versions, every pipeline step, validation results.
// TODO: "rerun from this step" button and a 3D viewer for the mesh.
export default async function DesignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { store } = getDeps();
  const session = await store.get("sessions", id);
  if (!session) notFound();
  const [versions, jobs, approved, assets] = await Promise.all([
    store.list("versions", { sessionId: id }),
    store.list("jobs", { sessionId: id }),
    store.list("approved", { sessionId: id }),
    store.list("assets", { sessionId: id }),
  ]);
  const totalCost = jobs.reduce((sum, job) => sum + job.costUsd, 0);

  return (
    <main className="mx-auto max-w-4xl space-y-10 px-5 py-10 text-sm">
      <header>
        <h1 className="font-mono text-base">{session.id}</h1>
        <p className="text-neutral-600">
          {session.templateId} v{session.templateVersion} · {session.brandId ?? "standalone"} · status{" "}
          <strong>{session.status}</strong> · cost ${totalCost.toFixed(4)}
        </p>
      </header>

      <section>
        <h2 className="mb-3 font-semibold">Versions</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {versions.map((v) => (
            <figure key={v.id} className="rounded-xl bg-white p-3 ring-1 ring-black/5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={v.previewUrl} alt="" className="aspect-square w-full rounded-lg object-contain" />
              <figcaption className="mt-2">
                <p>
                  <strong>v{v.index}</strong>
                  {approved[0]?.versionId === v.id && " · approved"}
                </p>
                <p className="text-neutral-600">“{v.prompt}”</p>
                {v.notes.map((note) => (
                  <p key={note} className="text-amber-800">
                    {note}
                  </p>
                ))}
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {assets.map((asset) => (
        <section key={asset.id}>
          <h2 className="mb-3 font-semibold">
            Validation: {asset.outcome} ·{" "}
            <a className="underline" href={asset.meshUrl}>
              download {asset.format.toUpperCase()}
            </a>
          </h2>
          <ul>
            {asset.checks.map((c) => (
              <li key={c.check}>
                <span className={`inline-block w-28 ${colour[c.status] ?? ""}`}>{c.status}</span>
                {c.check}: {c.detail}
              </li>
            ))}
          </ul>
        </section>
      ))}

      <section>
        <h2 className="mb-3 font-semibold">Pipeline steps</h2>
        {jobs.map((job) => (
          <details key={job.id} className="border-t border-black/10 py-2">
            <summary className="cursor-pointer">
              <span className="inline-block w-24">{job.kind}</span>
              <span className="inline-block w-40 text-neutral-600">{job.provider}</span>
              <span className={`inline-block w-24 ${colour[job.status] ?? ""}`}>{job.status}</span>
              <span className="text-neutral-500">
                {job.durationMs ?? "–"} ms · ${job.costUsd}
              </span>
              {job.error && <span className="ml-2 text-red-700">{job.error}</span>}
            </summary>
            <pre className="mt-2 overflow-x-auto rounded-lg bg-neutral-100 p-3 text-xs">
              {JSON.stringify({ input: job.input, output: job.output }, null, 2)}
            </pre>
          </details>
        ))}
      </section>
    </main>
  );
}
