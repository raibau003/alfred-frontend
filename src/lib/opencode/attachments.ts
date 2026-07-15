// Upload a browser File into the agent pod's workspace WITHOUT inlining its
// content into the LLM prompt.
//
// WHY (verified, 2026-06-02): the previous transport sent a FilePart data-URL
// and opencode INLINED the whole file into the prompt to the model. A 1.9 MB
// CSV blows the token budget -> AI_APICallError. The file must instead live on
// disk and be analysed by the agent with pandas/duckdb reading from the path.
//
// MECHANISM (verified against a live opencode server): POST {base}/session/{id}/shell
// with body { agent:"build", command:"<bash>" } runs the command in the cwd
// `/home/agent/sandbox`, returns 200 immediately and DOES NOT invoke the LLM
// (0 tokens). We use it to stream the file to disk in base64 chunks, then
// decode it server-side. The prompt only carries a *reference* to the path.

/** Cap for chat attachments. The file is NOT inlined into the prompt anymore
 *  (it goes to disk), so this can be generous. Kept sane to avoid pathological
 *  uploads over the shell channel. */
export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024; // 25 MB

/** Extensions we let the user pick from the chat input. */
export const ACCEPTED_ATTACHMENT_EXT =
  ".csv,.tsv,.txt,.json,.md,.parquet,.xlsx";

const EXT_MIME: Record<string, string> = {
  csv: "text/csv",
  tsv: "text/tab-separated-values",
  txt: "text/plain",
  json: "application/json",
  md: "text/markdown",
  parquet: "application/vnd.apache.parquet",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

/** Best-effort MIME: trust the browser, fall back to the extension, default csv. */
export function resolveMime(file: File): string {
  if (file.type) return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return EXT_MIME[ext] ?? "application/octet-stream";
}

/** A file the user picked, ready to be uploaded to the workspace on send. */
export interface PreparedAttachment {
  /** The raw browser File — uploaded to disk in send(), NOT inlined. */
  file: File;
  filename: string;
  mime: string;
  size: number;
}

/** Result of writing an attachment to the pod workspace. */
export interface UploadedAttachment {
  /** Relative path inside the workspace cwd, e.g. `data/california-housing.csv`. */
  path: string;
  /** Sanitised filename actually written to disk. */
  filename: string;
  mime: string;
  size: number;
}

export class AttachmentError extends Error {}

/** Validate + capture a picked File. No reading happens here (cheap). */
export function prepareAttachment(file: File): Promise<PreparedAttachment> {
  if (file.size > MAX_ATTACHMENT_BYTES) {
    const mb = (MAX_ATTACHMENT_BYTES / (1024 * 1024)).toFixed(0);
    return Promise.reject(
      new AttachmentError(
        `Archivo muy grande (máx ${mb} MB; el tuyo ${formatBytes(file.size)}). ` +
          `Para datasets enormes, pedile al agente que los cargue desde una URL o tu base de datos.`,
      ),
    );
  }
  return Promise.resolve({
    file,
    filename: file.name,
    mime: resolveMime(file),
    size: file.size,
  });
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/** Sanitise a filename to a safe disk name: keep only [a-zA-Z0-9._-]. */
export function sanitizeFilename(name: string): string {
  // Strip any directory components first, then scrub.
  const base = name.split(/[\\/]/).pop() ?? "file";
  const safe = base.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/^\.+/, "");
  return safe.length > 0 ? safe : "file";
}

/** Read a File into a base64 string (no `data:` prefix). */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () =>
      reject(new AttachmentError("No se pudo leer el archivo."));
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new AttachmentError("Formato de lectura inesperado."));
        return;
      }
      // readAsDataURL emits `data:<mime>;base64,<...>`. Drop the prefix.
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.readAsDataURL(file);
  });
}

// Linux MAX_ARG_STRLEN is 128 KB (32 pages * 4 KB) per single argument, which
// caps how much base64 we can pass in ONE `printf '%s' '<chunk>'` command. We
// stay well under it (chunk + the ~40-byte command wrapper) with 96 KB chunks.
const CHUNK_B64_BYTES = 96 * 1024;

/** POST a shell command to the pod and throw on non-2xx. Runs in cwd
 *  `/home/agent/sandbox`, returns 200 without invoking the LLM. */
async function runShell(
  baseUrl: string,
  sessionId: string,
  command: string,
): Promise<void> {
  const res = await fetch(
    `${baseUrl.replace(/\/$/, "")}/session/${sessionId}/shell`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agent: "build", command }),
    },
  );
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new AttachmentError(
      `shell ${res.status}: ${body.slice(0, 300) || res.statusText}`,
    );
  }
}

/** Create a throwaway session used ONLY for the upload shell writes. Each shell
 *  call creates messages in its session; doing them in the chat session floods
 *  it (a 1.9 MB file = ~30 chunk messages). The pod filesystem is shared across
 *  sessions (verified 2026-06-03), so a file written here is visible to the chat
 *  session — and this session gets deleted afterwards, leaving the chat clean. */
async function createUploadSession(baseUrl: string): Promise<string> {
  const res = await fetch(`${baseUrl.replace(/\/$/, "")}/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  if (!res.ok) {
    throw new AttachmentError(`no se pudo crear la sesión de subida (${res.status})`);
  }
  const data = (await res.json()) as { id?: string };
  if (!data?.id) throw new AttachmentError("la sesión de subida no devolvió id");
  return data.id;
}

async function deleteSession(baseUrl: string, sessionId: string): Promise<void> {
  try {
    await fetch(`${baseUrl.replace(/\/$/, "")}/session/${sessionId}`, {
      method: "DELETE",
    });
  } catch {
    /* best-effort cleanup; a leftover hidden session is harmless */
  }
}

/**
 * Write a File to the agent workspace at `data/<name>` via the shell channel,
 * streaming base64 in chunks so we never exceed the single-arg shell limit.
 *
 * The writes run in a THROWAWAY session (deleted afterwards) so the user's chat
 * session is never polluted by the chunk shell calls. Returns the relative path
 * (`data/<name>`) for the agent to read with pandas. Does NOT inline content
 * into any prompt and consumes 0 LLM tokens.
 */
export async function uploadAttachmentToWorkspace(
  baseUrl: string,
  _chatSessionId: string,
  prepared: PreparedAttachment,
): Promise<UploadedAttachment> {
  const name = sanitizeFilename(prepared.filename);
  const b64Path = `data/${name}.b64`;
  const outPath = `data/${name}`;
  const b64 = await fileToBase64(prepared.file);

  const uploadSid = await createUploadSession(baseUrl);
  try {
    // 1) Fresh staging file (mkdir + truncate any stale .b64 from a retry).
    //    base64 is [A-Za-z0-9+/=] only — no single-quote, no backslash — so it
    //    is safe inside single quotes; printf '%s' avoids any escape parsing.
    await runShell(baseUrl, uploadSid, `mkdir -p data && : > '${b64Path}'`);

    // 2) Append the base64 in chunks (one printf per chunk).
    for (let i = 0; i < b64.length; i += CHUNK_B64_BYTES) {
      const chunk = b64.slice(i, i + CHUNK_B64_BYTES);
      await runShell(baseUrl, uploadSid, `printf '%s' '${chunk}' >> '${b64Path}'`);
    }

    // 3) Decode -> final file, drop the staging file, sanity-check it exists.
    await runShell(
      baseUrl,
      uploadSid,
      `base64 -d '${b64Path}' > '${outPath}' && rm -f '${b64Path}' && wc -c '${outPath}'`,
    );
  } finally {
    await deleteSession(baseUrl, uploadSid);
  }

  return {
    path: outPath,
    filename: name,
    mime: prepared.mime,
    size: prepared.size,
  };
}
