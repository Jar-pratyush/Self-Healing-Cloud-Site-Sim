import { SiteHeader } from "./components/site_header";
import { ViewModeProvider } from "./state/view_mode_provider";
import { CreditsSection } from "./sections/credits_section";
import { DeepDiveSection } from "./sections/deep_dive_section";
import { HeroSection } from "./sections/hero_section";
import { HowItWorksSection } from "./sections/how_it_works_section";
import { ProblemSection } from "./sections/problem_section";
import { ReplaySection } from "./sections/replay/replay_section";
import { ResultsSection } from "./sections/results_section";

export function App() {
  return (
    <ViewModeProvider>
      <a className="skip_link" href="#problem">
        Skip to content
      </a>
      <div id="top" />
      <SiteHeader />
      <main>
        <HeroSection />
        <ProblemSection />
        <HowItWorksSection />
        <ReplaySection />
        <ResultsSection />
        <DeepDiveSection />
      </main>
      <CreditsSection />
    </ViewModeProvider>
  );
}
