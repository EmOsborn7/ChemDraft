import { describe, expect, it } from "vitest";
import { DIALOG_MAX_BYTES, parseDialogMessage, validateDialogDelivery, type DialogMessage } from "./dialogProtocol";

export const snapshot = (): Extract<DialogMessage, { type: "snapshot" }> => ({ protocolVersion: 1, ownerWindowId: "main", documentTabId: "tab-1", dialogKind: "pageSize", sessionId: "session-1", requestId: "request-1", snapshotRevision: 1, type: "snapshot", data: { title: "Drawing", width: 8.5, height: 11, unit: "inch" } });
describe("dialog contract", () => {
  it("accepts only the registered sender and current envelope", () => {
    const s = snapshot();
    const ready: DialogMessage = { ...s, type: "ready", data: {} };
    expect(validateDialogDelivery(ready, "dialog-main-pageSize-1", s, "dialog-main-pageSize-1")).toEqual(ready);
    for (const sender of ["main", "preferences", "dialog-main-pageSize-2"]) expect(validateDialogDelivery(ready, sender, s, "dialog-main-pageSize-1")).toBeUndefined();
    for (const change of [{ sessionId: "old" }, { snapshotRevision: 2 }, { ownerWindowId: "other" }, { documentTabId: "tab-2" }, { dialogKind: "export" }]) {
      expect(validateDialogDelivery({ ...ready, ...change }, "dialog-main-pageSize-1", s, "dialog-main-pageSize-1")).toBeUndefined();
    }
    expect(validateDialogDelivery(s, "main", s, "dialog-main-pageSize-1")).toEqual(s);
    expect(validateDialogDelivery(s, "dialog-main-pageSize-1", s, "dialog-main-pageSize-1")).toBeUndefined();
  });
  it("rejects unknown types, malformed dimensions, extra fields, and oversized payloads", () => {
    const s = snapshot();
    const bad = [null, [], "{}", { ...s, callback: "edit.undo" }, { ...s, protocolVersion: 2 }, { ...s, type: "command" },
      { ...s, snapshotRevision: 1.5 }, { ...s, data: { ...s.data, width: NaN } }, { ...s, data: { ...s.data, height: 0 } },
      { ...s, data: { ...s.data, title: "x".repeat(DIALOG_MAX_BYTES) } }, { ...s, data: { ...s.data, path: "/private" } },
      { ...s, type: "action", data: { action: "invoke", commandId: "edit.undo" } },
      { ...s, type: "action", data: { action: "cancel", width: 10 } }];
    for (const value of bad) expect(parseDialogMessage(value)).toBeUndefined();
    expect(parseDialogMessage({ ...s, data: { ...s.data, title: "😀".repeat(128) } })).toBeDefined();
    expect(parseDialogMessage({ ...s, data: { ...s.data, title: "😀".repeat(129) } })).toBeUndefined();
    expect(parseDialogMessage({ ...s, type: "result", data: { status: "error", error: null } })).toBeUndefined();
    const cycle: Record<string, unknown> = {}; cycle.self = cycle;
    expect(parseDialogMessage(cycle)).toBeUndefined();
  });
});

it("validates spacing kinds, bounded preview chunks and typed actions without broadening page-size messages", () => {
  const s = { ...snapshot(), dialogKind: "arrangementSpacing", data: { title: "Selection", minPercent: 25, maxPercent: 150 } };
  expect(parseDialogMessage(s)).toBeDefined();
  const preview = { ...s, type: "preview", data: { percent: 100, index: 0, count: 1, chunk: "PHN2Zy8+" } };
  expect(parseDialogMessage(preview)).toBeDefined();
  for (const data of [ { ...preview.data, chunk: "x".repeat(2001) }, { ...preview.data, count: 1025 }, { ...preview.data, index: 1 }, { ...preview.data, percent: 24 }, { ...preview.data, error: "bad" }, { ...preview.data, chunk: "https://example.com" } ]) expect(parseDialogMessage({...preview,data})).toBeUndefined();
  expect(parseDialogMessage({...s,type:"action",data:{action:"preview",percent:80}})).toBeDefined();
  expect(parseDialogMessage({...snapshot(),type:"action",data:{action:"preview",percent:80}})).toBeUndefined();
  expect(parseDialogMessage({...s,type:"action",data:{action:"apply",percent:NaN}})).toBeUndefined();
});
