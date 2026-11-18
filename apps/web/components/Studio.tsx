"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import type { DesignVersion, SessionStatus } from "@fishbelly/core";

interface Props {
  templateId: string;
  productName: string;
  /** The brand this session is opened through; it decides the workspace the design lands in. */
  brandId: string;
  /** Set when running inside a brand's iframe. */
  parentOrigin?: string;
}

interface Approval {
  designId: string;
  status: SessionStatus;
}

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Something went wrong. Please try again.");
  return data as T;
}

/** The whole customer experience: a prompt box and a preview. Nothing else. */
export function Studio({ templateId, productName, brandId, parentOrigin }: Props) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [version, setVersion] = useState<DesignVersion | null>(null);
  const [approval, setApproval] = useState<Approval | null>(null);
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState<"idle" | "generating" | "approving">("idle");
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return; // React dev mode runs effects twice
    started.current = true;
    post<{ session: { id: string } }>("/api/sessions", { templateId, brandId })
      .then((data) => setSessionId(data.session.id))
      .catch((err: Error) => setError(err.message));
  }, [templateId, brandId]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!sessionId || !prompt.trim() || busy !== "idle") return;
    setBusy("generating");
    setError(null);
    try {
      const data = await post<{ version: DesignVersion }>(`/api/sessions/${sessionId}/prompt`, { prompt });
      setVersion(data.version);
      setPrompt("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy("idle");
    }
  }

  async function onApprove() {
    if (!sessionId || !version || busy !== "idle") return;
    setBusy("approving");
    setError(null);
    try {
      const data = await post<Approval>(`/api/sessions/${sessionId}/approve`, { versionId: version.id });
      setApproval(data);
      if (parentOrigin && window.parent !== window) {
        window.parent.postMessage(
          { type: "fishbelly:design-approved", designId: data.designId, previewUrl: version.previewUrl },
          parentOrigin,
        );
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy("idle");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="relative aspect-square overflow-hidden rounded-2xl bg-[#f3f0ea] shadow-sm ring-1 ring-black/5">
        {version ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={version.previewUrl} alt={version.spec.summary} className="h-full w-full object-contain" />
        ) : (
          <div className="flex h-full items-center justify-center px-8 text-center text-neutral-400">
            Describe your {productName.toLowerCase()} and it will appear here.
          </div>
        )}
        {busy === "generating" && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/60 text-sm text-neutral-600">
            Creating your design…
          </div>
        )}
      </div>

      {version && version.notes.length > 0 && !approval && (
        <ul className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {version.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      )}
      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}

      {approval ? (
        <div className="rounded-xl bg-white px-4 py-4 text-sm ring-1 ring-black/5">
          <p className="font-medium">Design approved.</p>
          <p className="mt-1 text-neutral-600">
            {approval.status === "failed"
              ? "We hit a problem preparing it for production. Our team will take a look."
              : "We're preparing it for production."}
          </p>
          <p className="mt-2 font-mono text-xs text-neutral-400">{approval.designId}</p>
        </div>
      ) : (
        <>
          <form onSubmit={onSubmit} className="flex gap-2">
            <input
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              maxLength={1000}
              disabled={!sessionId}
              placeholder={version ? "What would you like to change?" : "An ocean-wave texture, slightly asymmetric…"}
              className="min-w-0 flex-1 rounded-xl bg-white px-4 py-3 outline-none ring-1 ring-black/10 focus:ring-2 focus:ring-[var(--accent)]"
            />
            <button
              type="submit"
              disabled={!sessionId || !prompt.trim() || busy !== "idle"}
              className="rounded-xl bg-[var(--accent)] px-5 py-3 font-medium text-white disabled:opacity-40"
            >
              {version ? "Update" : "Create"}
            </button>
          </form>
          {version && (
            <button
              onClick={onApprove}
              disabled={busy !== "idle"}
              className="rounded-xl px-5 py-3 font-medium text-[var(--accent)] ring-1 ring-[var(--accent)] disabled:opacity-40"
            >
              {busy === "approving" ? "Approving…" : "Approve this design"}
            </button>
          )}
        </>
      )}
    </div>
  );
}
