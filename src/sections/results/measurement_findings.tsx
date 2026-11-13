import { StatTile } from "../../components/stat_tile";
import { fault_meta } from "../../content/fault_meta";
import type { FaultCode, MeasurementData } from "../../data/data_types";

type MeasurementFindingsProps = {
  measurement: MeasurementData;
};

type Row = Record<string, string | number | boolean | null>;

function number_of(row: Row | undefined, key: string): number | null {
  const value = row?.[key];
  return typeof value === "number" ? value : null;
}

// Paper B's findings: where latency is measured decides which faults a
// controller can see at all.
export function MeasurementFindings({ measurement }: MeasurementFindingsProps) {
  const decomposition = measurement.fig_b1_decomposition ?? [];
  const after_fix = decomposition.find((row) => row.run === "U40, runtime fix");
  const stalls = measurement.table_stalls ?? [];
  const stalls_before = stalls[0];
  const stalls_after = stalls[1];
  const noise = measurement.fig_b3_estimator_noise ?? [];
  const p95_noise = noise.find((row) => row.window_s === 20 && row.quantile === 0.95);
  const p99_noise = noise.find((row) => row.window_s === 20 && row.quantile === 0.99);
  const detection = measurement.table_runbook_view_detection ?? [];
  const faults = Array.from(new Set(detection.map((row) => String(row.fault)))) as FaultCode[];

  return (
    <div className="measurement_findings">
      <div className="measurement_tiles">
        {after_fix ? (
          <StatTile
            tone="neutral"
            value={number_of(after_fix, "r_client_vs_ping_p99")?.toFixed(2)}
            label="correlation between client-side p99 latency and Wi-Fi ping"
            comparison={
              <>
                Measured at the server it was {number_of(after_fix, "r_server_vs_ping_p99")?.toFixed(2)}. Client-side
                latency mostly measured the wireless link, so the SLA is read from the frontend's own logs.
              </>
            }
          />
        ) : null}
        {stalls_before && stalls_after ? (
          <StatTile
            tone="neutral"
            value={`${number_of(stalls_before, "stall_events")} → ${number_of(stalls_after, "stall_events")}`}
            label={`request stall events in about ${Math.round((number_of(stalls_before, "span_s") ?? 0) / 60)} minutes of load`}
            comparison={
              <>
                A .NET thread-pool setting in cartservice removed them: {number_of(stalls_before, "slow_over_500ms")} of{" "}
                {number_of(stalls_before, "requests")?.toLocaleString("en")} requests over 500 ms before,{" "}
                {number_of(stalls_after, "slow_over_500ms")} of {number_of(stalls_after, "requests")?.toLocaleString("en")} after.
              </>
            }
          />
        ) : null}
        {p95_noise && p99_noise ? (
          <StatTile
            tone="neutral"
            value={`${number_of(p95_noise, "bootstrap_sampling_cv")} vs ${number_of(p99_noise, "bootstrap_sampling_cv")}`}
            label="sampling noise of p95 vs p99 in a 20 s window"
            comparison={
              <>
                With about {number_of(p95_noise, "median_requests_per_window")} requests per tick, p99 rests on only{" "}
                {number_of(p99_noise, "expected_tail_samples_k")} tail samples, p95 on{" "}
                {number_of(p95_noise, "expected_tail_samples_k")}. The SLA uses p95.
              </>
            }
          />
        ) : null}
      </div>

      <h4 className="subsection_title">Which faults each latency signal can detect</h4>
      <div className="detection_chart" role="img" aria-label="Share of fault episodes detected from latency alone, server-side versus client-side">
        {faults.map((fault) => {
          const server = detection.find((row) => row.fault === fault && row.signal === "server p95");
          const client = detection.find((row) => row.fault === fault && row.signal === "client p99");
          return (
            <div key={fault} className="detection_row">
              <span className="detection_label">
                <span className="mono">{fault}</span> {fault_meta[fault].name}
              </span>
              {[
                { row: server, label: "server p95", class_name: "is_server" },
                { row: client, label: "client p99", class_name: "is_client" },
              ].map(({ row, label, class_name }) => {
                const detected = number_of(row, "detected_latency_only") ?? 0;
                const episodes = number_of(row, "episodes") ?? 1;
                return (
                  <span key={label} className={`detection_bar_row ${class_name}`}>
                    <span className="detection_signal mono">{label}</span>
                    <span className="detection_track">
                      <span className="detection_fill" style={{ width: `${(detected / episodes) * 100}%` }} />
                    </span>
                    <span className="detection_value mono">
                      {detected}/{episodes}
                    </span>
                  </span>
                );
              })}
            </div>
          );
        })}
      </div>
      <p className="chart_note">
        Fault episodes from the runbook runs where latency alone crossed its threshold on the first two fault ticks.
        Scaled-to-zero faults (F3) never pushed server-side latency over the threshold; they show up as failed
        requests instead, which both signals catch.
      </p>
    </div>
  );
}
