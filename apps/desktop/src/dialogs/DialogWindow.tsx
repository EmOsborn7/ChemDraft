import { useEffect, useRef, useState } from "react";
import { detectDialogPlatform, dialogEnvelope, sameDialog, type DialogMessage } from "./dialogProtocol";
import { sendDialogMessage, subscribeDialogHost } from "./dialogTransport";
import { performFocusedFieldSelectAll } from "../editHistoryRouting";
import { ArrangementSpacingForm } from "./ArrangementSpacingForm";
import { formatPageSizeFieldValue, PageSizeForm, type PageSizeDraft } from "./PageSizeForm";

export function DialogWindow({ hostId }: { hostId: string }) {
  const [snapshot, setSnapshot] = useState<Extract<DialogMessage, { type: "snapshot" }>>();
  const [draft, setDraft] = useState<PageSizeDraft>();
  const [percent, setPercent] = useState(100);
  const currentPercent = useRef(percent);
  currentPercent.current = percent;
  const [preview, setPreview] = useState<string>();
  const previewRequestId = useRef<string | undefined>(undefined);
  const previewParts = useRef<{ count: number; chunks: string[] } | undefined>(undefined);
  const previewTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const actionTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const actionPending = useRef(false);
  const pendingRequestId = useRef<string | undefined>(undefined);
  useEffect(() => {
    const preventReload = (event: KeyboardEvent) => {
      const modifier = detectDialogPlatform() === "macos" ? event.metaKey : event.ctrlKey;
      if (modifier && event.key.toLowerCase() === "a") {
        event.preventDefault();
        performFocusedFieldSelectAll(document);
      }
      if (event.key === "F5" || (modifier && event.key.toLowerCase() === "r")) event.preventDefault();
    };
    window.addEventListener("keydown", preventReload);
    return () => window.removeEventListener("keydown", preventReload);
  }, []);
  useEffect(() => {
    let stopped = false;
    let stop: (() => void) | undefined;
    let latest: DialogMessage | undefined;
    void subscribeDialogHost(hostId, message => {
      if (stopped) return;
      if (message.type === "snapshot") {
        if (latest && (message.sessionId !== latest.sessionId || message.snapshotRevision < latest.snapshotRevision)) return;
        // Replay must not replace the user's draft at the same revision.
        if (!latest || message.snapshotRevision > latest.snapshotRevision) {
          setSnapshot(message);
          if (message.dialogKind === "pageSize") setDraft({ width: formatPageSizeFieldValue(message.data.width), height: formatPageSizeFieldValue(message.data.height), unit: message.data.unit });
          else { setPercent(100); setPreview(undefined); }
          latest = message;
        }
      } else if (latest && sameDialog(message, latest) && message.type === "preview" && message.requestId === previewRequestId.current && message.data.percent === currentPercent.current && !actionPending.current) {
        if (message.data.error) { clearTimeout(previewTimer.current); setError(message.data.error); setPreview(undefined); return; }
        const { index, count, chunk } = message.data;
        if (index === 0) previewParts.current = { count, chunks: [] };
        const parts = previewParts.current;
        if (!parts || parts.count !== count || index !== parts.chunks.length) {
          clearTimeout(previewTimer.current); previewRequestId.current = undefined;
          setError("Preview delivery was incomplete. Move the slider to try again."); setPreview(undefined); return;
        }
        parts.chunks.push(chunk);
        if (parts.chunks.length === count) {
          clearTimeout(previewTimer.current); setError(undefined);
          setPreview(`data:image/svg+xml;base64,${parts.chunks.join("")}`); previewParts.current = undefined;
        }
      } else if (latest && sameDialog(message, latest) && message.type === "result" && message.requestId === pendingRequestId.current) {
        clearTimeout(actionTimer.current);
        // A successful terminal receipt precedes native destruction. Never reopen Apply here.
        if (message.data.status === "error") { actionPending.current = false; setBusy(false); }
        setError(message.data.error);
      }
    }).then(unlisten => { if (stopped) unlisten(); else stop = unlisten; }).catch(e => { if (!stopped) setError(String(e)); });
    return () => { stopped = true; stop?.(); clearTimeout(actionTimer.current); clearTimeout(previewTimer.current); };
  }, [hostId]);
  // React committed the form, including first-field focus. Hidden webviews suspend rAF: never wait for it.
  useEffect(() => {
    if (!snapshot) return;
    void sendDialogMessage(hostId, { ...dialogEnvelope(snapshot), requestId: crypto.randomUUID(), type: "ready", data: {} }).catch(e => setError(String(e)));
  }, [hostId, snapshot]);
  useEffect(() => {
    if (snapshot?.dialogKind !== "arrangementSpacing") return;
    const debounce = setTimeout(() => {
      const requestId = crypto.randomUUID();
      previewRequestId.current = requestId; previewParts.current = undefined;
      clearTimeout(previewTimer.current);
      previewTimer.current = setTimeout(() => { setPreview(undefined); setError("Preview did not arrive. Move the slider to try again."); }, 10000);
      void sendDialogMessage(hostId, { ...dialogEnvelope(snapshot), requestId, type: "action", data: { action: "preview", percent } })
        .catch(e => { if (previewRequestId.current === requestId) { clearTimeout(previewTimer.current); setError(String(e)); } });
    }, percent === 100 ? 0 : 120);
    return () => { clearTimeout(debounce); clearTimeout(previewTimer.current); };
  }, [hostId, snapshot, percent]);
  const sendAction = (data: Extract<DialogMessage, { type: "action" }>["data"]) => {
    if (!snapshot || actionPending.current) return;
    actionPending.current = true;
    setBusy(true);
    const requestId = crypto.randomUUID();
    pendingRequestId.current = requestId;
    clearTimeout(actionTimer.current);
    actionTimer.current = setTimeout(() => {
      // Unknown completion must never retry a mutation automatically. Native title-bar close remains available.
      setError("The drawing did not acknowledge this action. Close this window to continue; the action was not retried.");
    }, 10000);
    void sendDialogMessage(hostId, { ...dialogEnvelope(snapshot), requestId, type: "action", data }).catch(e => {
      clearTimeout(actionTimer.current); actionPending.current = false; setBusy(false); setError(String(e));
    });
  };
  if (!snapshot) return <p role="status">{error ?? "Opening dialog…"}</p>;
  if (snapshot.dialogKind === "arrangementSpacing") return <ArrangementSpacingForm {...snapshot.data} percent={percent}
    preview={preview} busy={busy} error={error} onChange={value => {
      previewRequestId.current = undefined; previewParts.current = undefined;
      setPreview(undefined); setError(undefined); setPercent(value);
    }} onCancel={() => sendAction({ action: "cancel" })} onSave={() => sendAction({ action: "apply", percent })} />;
  if (!draft) return <p role="status">Opening Custom Page Size…</p>;
  return <PageSizeForm title={snapshot.data.title} state={draft} onChange={setDraft} busy={busy} error={error}
    onCancel={() => sendAction({ action: "cancel" })} onApply={size => sendAction({ action: "apply", ...size })} />;
}
