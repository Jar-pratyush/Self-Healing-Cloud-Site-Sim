import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/bricolage-grotesque/opsz.css";
import "@fontsource-variable/instrument-sans/wght.css";
import "@fontsource-variable/jetbrains-mono/wght.css";
import "./styles/tokens.css";
import "./styles/base.css";
import { App } from "./app";

const root_element = document.getElementById("root");

if (root_element) {
  createRoot(root_element).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
