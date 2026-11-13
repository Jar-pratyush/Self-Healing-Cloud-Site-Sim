import { BrandMark } from "../components/brand_mark";
import type { Provenance } from "../data/data_types";
import { useSiteData } from "../data/use_site_data";
import "./credits_section.css";

const capstone_repo_url = "https://github.com/zaidbinshams/self-healing-cloud-infrastructure";

function format_day(timestamp: string | null): string {
  if (!timestamp) {
    return "";
  }
  return new Date(timestamp).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

// Which state of the capstone repository the page's numbers were read from.
function ProvenanceLine() {
  const { data: provenance } = useSiteData<Provenance>("provenance.json");
  if (!provenance) {
    return null;
  }
  const commit = provenance.capstone_commit;
  return (
    <span className="credits_provenance">
      Data exported {format_day(provenance.exported_at)}
      {commit ? (
        <>
          {" "}from commit <a href={`${capstone_repo_url}/tree/${commit}`}>{commit.slice(0, 7)}</a> (
          {format_day(provenance.capstone_commit_date)})
        </>
      ) : null}
      {provenance.capstone_tracked_changes ? ", with uncommitted changes" : ""}.
    </span>
  );
}

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
        <ProvenanceLine />
      </div>
    </footer>
  );
}
