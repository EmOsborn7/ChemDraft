// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ReactionConditionsDialog } from "./ReactionConditionsDialog";
import type { TextSpan } from "@chemdraft/chem-core";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("reaction condition symbols and native scripts", () => {
  let container: HTMLDivElement, root: Root;
  const save = vi.fn(), cancel = vi.fn();
  beforeEach(() => {
    save.mockClear(); cancel.mockClear();
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { callback(0); return 0; });
    container = document.createElement("div"); document.body.append(container); root = createRoot(container);
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); vi.unstubAllGlobals(); });
  async function render(text: string, spans: TextSpan[] = []) {
    await act(async () => root.render(createElement(ReactionConditionsDialog, {
      initialText: text, initialSpans: spans, initialSide: -1, onSave: save, onCancel: cancel
    })));
  }
  async function click(label: string) {
    await act(async () => container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!.click());
  }
  async function select(start: number, end = start) {
    await act(async () => container.querySelector("textarea")!.setSelectionRange(start, end));
  }
  async function type(text: string) {
    const input = container.querySelector("textarea")!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(input, text);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }
  async function submit() {
    await act(async () => container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
  }
  it("formats arbitrary selected text and retains the underlying formula, symbols and selection", async () => {
    await render("K2CO3, THF\n80 C, 2 h\nFe3+");
    await select(1, 2); await click("Subscript");
    expect(container.querySelector('button[aria-label="Subscript"]')?.getAttribute("aria-pressed")).toBe("true");
    expect(container.querySelector("textarea")!.selectionStart).toBe(1);
    expect(container.querySelector("textarea")!.selectionEnd).toBe(2);
    await select(4, 5); await click("Subscript");
    const start = container.querySelector("textarea")!.value.indexOf("3+");
    await select(start, start + 2); await click("Superscript");
    await select(14); await click("Insert degree symbol");
    expect(container.querySelector("textarea")!.value).toContain("80 °C");
    const preview = container.querySelector('[aria-label="Formatted conditions preview"]')!;
    expect(preview.querySelectorAll('span[style*="vertical-align: -0.16em"]')).toHaveLength(2);
    expect(preview.querySelector('span[style*="vertical-align: super"]')!.textContent).toBe("3+");
    await submit();
    const [text, side, spans] = save.mock.calls[0] as [string, number, TextSpan[]];
    expect(side).toBe(-1);
    expect(spans.map(span => span.text).join("")).toBe(text);
    expect(spans.filter(span => span.script === "subscript").map(span => span.text)).toEqual(["2", "3"]);
    expect(spans.find(span => span.script === "superscript")?.text).toBe("3+");
  });
  it("supports script typing, normal reset, symbol replacement and previously formatted runs", async () => {
    await render("Fe"); await select(2); await click("Superscript");
    await type("Fe3+"); await select(4); await click("Normal text");
    await type("Fe3+ at 80 C");
    await select(11); await click("Insert degree symbol");
    await select(0, 2); await click("Insert heat (delta) symbol");
    await submit();
    const [text, , spans] = save.mock.calls[0] as [string, number, TextSpan[]];
    expect(text).toBe("Δ3+ at 80 °C");
    expect(spans.find(span => span.script === "superscript")?.text).toBe("3+");
    expect(spans.at(-1)?.script).toBe("normal");
  });
  it("reopens rich labels and cancels all formatting and symbol edits", async () => {
    await render("CO2", [{text:"CO",script:"normal",style:{}},{text:"2",script:"subscript",style:{}}]);
    expect(container.querySelector('span[style*="vertical-align: -0.16em"]')?.textContent).toBe("2");
    await select(2, 3); await click("Superscript");
    await select(3); await click("Insert plus or minus symbol");
    await act(async () => container.querySelector("form")!.dispatchEvent(new KeyboardEvent("keydown", {key:"Escape",bubbles:true,cancelable:true})));
    expect(cancel).toHaveBeenCalledTimes(1); expect(save).not.toHaveBeenCalled();
  });
});
