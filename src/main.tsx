import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-500.css";
import "@fontsource/inter/latin-600.css";
import "@fontsource/manrope/latin-400.css";
import "@fontsource/manrope/latin-500.css";
import "@fontsource/manrope/latin-600.css";
import "@fontsource/manrope/latin-700.css";
import "@fontsource/manrope/latin-800.css";
import "@fontsource/material-symbols-outlined";
import App from "./App";
import { OnboardingWindow } from "./components/OnboardingWindow";
import "./index.css";

const windowMode = new URLSearchParams(window.location.search).get("window");
const RootComponent = windowMode === "onboarding" ? OnboardingWindow : App;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RootComponent />
  </StrictMode>
);
