import { applyLanguage } from "./lib/i18n";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

applyLanguage();
createRoot(document.getElementById("root")!).render(<App />);
