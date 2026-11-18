"use client";

import { useParams, useRouter } from "next/navigation";

/** Switching workspace is navigation: the workspace is part of every /admin URL. */
export function WorkspaceSwitcher({ workspaces }: { workspaces: { id: string; name: string }[] }) {
  const router = useRouter();
  const params = useParams<{ workspace?: string }>();
  const current = workspaces.some((w) => w.id === params.workspace) ? params.workspace : "";

  return (
    <select
      aria-label="Workspace"
      value={current}
      onChange={(event) => router.push(`/admin/${event.target.value}`)}
      className="rounded-lg bg-white px-3 py-1.5 ring-1 ring-black/10"
    >
      {!current && (
        <option value="" disabled>
          Choose a workspace…
        </option>
      )}
      {workspaces.map((w) => (
        <option key={w.id} value={w.id}>
          {w.name}
        </option>
      ))}
    </select>
  );
}
