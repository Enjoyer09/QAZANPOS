import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { mockDemoFetch, initDemoDatabase } from "./lib/demoSandbox.ts";

if (sessionStorage.getItem("birsaas_demo_active") === "true") {
  initDemoDatabase();
  window.fetch = mockDemoFetch as any;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
