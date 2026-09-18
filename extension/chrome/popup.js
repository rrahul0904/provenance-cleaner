const $ = (id) => document.getElementById(id);
const fields = ["apiKey", "apiBase", "mode", "intensity", "purpose"];

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function setStatus(message, error = false) {
  $("status").textContent = message;
  $("status").className = error ? "status error" : "status";
}

async function loadSettings() {
  const saved = await chrome.storage.local.get(fields);
  $("apiKey").value = saved.apiKey || "";
  $("apiBase").value = saved.apiBase || "https://provenance-cleaner.vercel.app";
  $("mode").value = saved.mode || "parity";
  $("intensity").value = saved.intensity || "balanced";
  $("purpose").value = saved.purpose || "general";
}

async function saveSettings() {
  const payload = Object.fromEntries(fields.map((id) => [id, $(id).value.trim()]));
  await chrome.storage.local.set(payload);
  setStatus("Settings saved. Content is not stored.");
}

async function sendToPage(message) {
  const tab = await activeTab();
  if (!tab?.id) throw new Error("No active tab.");
  return chrome.tabs.sendMessage(tab.id, message);
}

async function rewriteSelection() {
  setStatus("Reading selected text…");
  const selected = await sendToPage({ type: "selection" });
  if (!selected?.ok || !selected.text) throw new Error(selected?.reason || "Select text first.");
  if (selected.text.trim().length < 20) throw new Error("Select at least 20 characters.");

  const apiKey = $("apiKey").value.trim();
  if (!apiKey) throw new Error("Add a developer API key first.");
  const base = $("apiBase").value.trim().replace(/\/$/u, "");
  const body = {
    operationId: crypto.randomUUID(),
    text: selected.text,
    mode: $("mode").value,
    intensity: $("intensity").value,
    purpose: $("purpose").value,
  };

  setStatus("Running protected rewrite…");
  const response = await fetch(`${base}/api/v1/transform`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error?.message || payload?.error || "Rewrite failed.");

  $("output").value = payload.text;
  $("outputBox").hidden = false;
  if (selected.editable) {
    const replaced = await sendToPage({ type: "replace", text: payload.text });
    if (!replaced?.ok) throw new Error(replaced?.reason || "Result was generated but could not be placed in the page.");
    setStatus(`Validated and replaced in page · ${payload.purpose}/${payload.intensity}. Undo is available.`);
  } else {
    setStatus("Validated result is ready. The original selection is read-only, so copy the result instead.");
  }
}

$("rewrite").addEventListener("click", () => rewriteSelection().catch((error) => setStatus(error.message, true)));
$("undo").addEventListener("click", () => sendToPage({ type: "undo" }).then((result) => {
  if (!result?.ok) throw new Error(result?.reason || "Could not undo.");
  setStatus("Last in-page rewrite undone.");
}).catch((error) => setStatus(error.message, true)));
$("save").addEventListener("click", () => saveSettings().catch((error) => setStatus(error.message, true)));
$("copy").addEventListener("click", () => navigator.clipboard.writeText($("output").value).then(() => setStatus("Result copied.")).catch(() => setStatus("Could not copy result.", true)));
void loadSettings();
