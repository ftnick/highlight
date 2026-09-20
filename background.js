function logDebug(message, detail) {
  console.log(`[highlight:background] ${message}`, detail ?? "");
}

function resolveSupportedLanguage(api, rawLang) {
  if (!rawLang || rawLang === "text") return null;

  const source = String(rawLang).trim().toLowerCase();
  const bundled = Array.isArray(api?.BUNDLED_LANGUAGES)
    ? api.BUNDLED_LANGUAGES
    : [];

  const match = bundled.find((lang) => {
    const id = String(lang?.id || "").toLowerCase();
    const aliases = (lang?.aliases || []).map((alias) =>
      String(alias).toLowerCase(),
    );
    return id === source || aliases.includes(source);
  });

  return match?.id || null;
}

try {
  importScripts(chrome.runtime.getURL("shiki/shiki.js"));
  logDebug(
    "Shiki loaded",
    !!globalThis.shiki && typeof globalThis.shiki.getHighlighter === "function",
  );
} catch (error) {
  logDebug("Shiki import failed", error?.message || error);
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== "highlight") {
    return false;
  }

  (async () => {
    try {
      const api = globalThis.shiki;
      if (!api || typeof api.getHighlighter !== "function") {
        throw new Error("Shiki unavailable in background worker");
      }

      const highlighter = await api.getHighlighter({
        theme: "dark-plus",
        langs: [],
      });

      const requestedLang = String(message.ext || "text");
      const lang = resolveSupportedLanguage(api, requestedLang) || "text";
      const code =
        typeof message.code === "string"
          ? message.code
          : String(message.code ?? "");

      if (lang && lang !== "text") {
        try {
          const normalized = resolveSupportedLanguage(api, lang);
          if (normalized) {
            await highlighter.loadLanguage(normalized);
          }
        } catch (error) {
          logDebug("Unsupported language, using fallback", lang);
        }
      }

      sendResponse(
        highlighter.codeToHtml(code, {
          lang,
          theme: "dark-plus",
        }),
      );
    } catch (error) {
      logDebug("Background highlight failed", error?.message || error);
      sendResponse(null);
    }
  })();

  return true;
});
