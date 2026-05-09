import { applyLanguage } from "./lib/i18n";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

applyLanguage();

function suppressInjectedTranslationChrome() {
  if (typeof document === "undefined") return;
  const blockedText = ["Google Translate", "English", "Arabic", "KareemAbuZaid"];
  const hideInjectedNode = (node: Element) => {
    if (node.id === "root" || node.closest("#root")) return;
    const text = node.textContent || "";
    const className = typeof node.className === "string" ? node.className : "";
    const shouldHide = blockedText.some((item) => text.includes(item)) || className.includes("skiptranslate") || className.includes("goog-te");
    if (shouldHide && node instanceof HTMLElement) node.style.display = "none";
  };
  const scan = () => Array.from(document.body.children).forEach(hideInjectedNode);
  scan();
  new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
}

suppressInjectedTranslationChrome();

createRoot(document.getElementById("root")!).render(
  <div dir="rtl" lang="ar">
    <App />
  </div>,
);
