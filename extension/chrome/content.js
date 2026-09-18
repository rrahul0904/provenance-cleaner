let lastEdit = null;

function inputSelection() {
  const target = document.activeElement;
  if (!(target instanceof HTMLTextAreaElement || target instanceof HTMLInputElement)) return null;
  const start = target.selectionStart ?? 0;
  const end = target.selectionEnd ?? start;
  if (end <= start) return null;
  return { kind: "input", target, start, end, text: target.value.slice(start, end) };
}

function richSelection() {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null;
  const range = selection.getRangeAt(0);
  const host = range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
    ? range.commonAncestorContainer
    : range.commonAncestorContainer.parentElement;
  const editable = host?.closest?.('[contenteditable="true"]');
  return { kind: editable ? "contenteditable" : "readonly", range: range.cloneRange(), text: selection.toString(), editable };
}

function currentSelection() {
  return inputSelection() || richSelection();
}

function replaceSelection(replacement) {
  const selection = currentSelection();
  if (!selection || !selection.text) return { ok: false, reason: "Select text in an editable field first." };

  if (selection.kind === "input") {
    const { target, start, end } = selection;
    lastEdit = { kind: "input", target, start, replacementLength: replacement.length, original: selection.text };
    target.setRangeText(replacement, start, end, "end");
    target.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertReplacementText", data: replacement }));
    return { ok: true };
  }

  if (selection.kind === "contenteditable" && selection.editable) {
    const htmlBefore = selection.editable.innerHTML;
    const range = selection.range;
    range.deleteContents();
    range.insertNode(document.createTextNode(replacement));
    selection.editable.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertReplacementText", data: replacement }));
    lastEdit = { kind: "contenteditable", target: selection.editable, htmlBefore };
    return { ok: true };
  }

  return { ok: false, reason: "The selected text is read-only. Use Copy result instead." };
}

function undoLast() {
  if (!lastEdit) return { ok: false, reason: "There is no in-page edit to undo." };

  if (lastEdit.kind === "input" && document.contains(lastEdit.target)) {
    const end = lastEdit.start + lastEdit.replacementLength;
    lastEdit.target.setRangeText(lastEdit.original, lastEdit.start, end, "end");
    lastEdit.target.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "historyUndo" }));
    lastEdit = null;
    return { ok: true };
  }

  if (lastEdit.kind === "contenteditable" && document.contains(lastEdit.target)) {
    lastEdit.target.innerHTML = lastEdit.htmlBefore;
    lastEdit.target.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "historyUndo" }));
    lastEdit = null;
    return { ok: true };
  }

  lastEdit = null;
  return { ok: false, reason: "The edited element is no longer available." };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "selection") {
    const selection = currentSelection();
    sendResponse(selection ? { ok: true, text: selection.text, editable: selection.kind !== "readonly" } : { ok: false, reason: "Select some text first." });
    return;
  }
  if (message?.type === "replace") {
    sendResponse(replaceSelection(String(message.text || "")));
    return;
  }
  if (message?.type === "undo") {
    sendResponse(undoLast());
  }
});
