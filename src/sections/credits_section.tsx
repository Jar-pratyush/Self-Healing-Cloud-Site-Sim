import { BrandMark } from "../components/brand_mark";
import "./credits_section.css";

const capstone_repo_url = "https://github.com/zaidbinshams/self-healing-cloud-infrastructure";

export function CreditsSection() {
  return (
    <footer id="credits" className="credits_section" aria-labelledby="credits_heading">
      <div className="page_width credits_grid">
        <div className="credits_lead">
          <p className="section_kicker credits_kicker">
            <span className="section_number">§6</span>
            <span className="section_rule" aria-hidden="true" />
            <span>Credits</span>
          </p>
          <h2 id="credits_heading" className="credits_title">
            Researched, experimented and brought to you by Pratyush, Zaid and Team.
          </h2>
        </div>

        <ul className="credits_links">
          <li>
            <a href={capstone_repo_url}>Project repository</a>
            <span>Code, configuration, pre-registration and every figure's data</span>
          </li>
          <li>
            <a href={`${capstone_repo_url}/blob/main/docs/PREREGISTRATION.md`}>Pre-registration</a>
            <span>Hypotheses and analysis plan, committed before training</span>
          </li>
          <li>
            <a href={`${capstone_repo_url}/blob/main/LICENSE`}>MIT License</a>
            <span>For the project code</span>
          </li>
        </ul>
      </div>

      <div className="page_width credits_base">
        <BrandMark size={22} />
        <span>Self-Healing Cloud Infrastructure</span>
      </div>
    </footer>
  );
}
