import "./architecture_diagram.css";

// Online Boutique v0.10.7 as deployed in the capstone: 11 deployments after
// its built-in load generator was removed. The agent manages four of them.
const managed_services = ["frontend", "cartservice", "currencyservice", "productcatalogservice"];
const other_services = [
  "checkoutservice",
  "paymentservice",
  "shippingservice",
  "emailservice",
  "recommendationservice",
  "adservice",
  "redis-cart",
];

export function ArchitectureDiagram() {
  return (
    <div className="architecture" role="img" aria-label="Machine B, the controller, connects over a Wi-Fi link to Machine A, which runs the shop on Kubernetes with Chaos Mesh and Prometheus.">
      <div className="machine machine_controller">
        <header className="machine_head">
          <span className="machine_tag">Machine B</span>
          <span className="machine_title">The controller</span>
          <span className="machine_spec">Windows + WSL2 · Python 3.11 · CPU-only PyTorch</span>
        </header>

        <div className="component component_agent">
          <span className="component_name">PER-SAC agent</span>
          <span className="component_note">picks 1 of 12 actions per tick</span>
        </div>

        <div className="component">
          <span className="component_name">Gymnasium environment</span>
          <ul className="component_parts">
            <li>tick clock</li>
            <li>telemetry collector</li>
            <li>action executor</li>
            <li>fault injector</li>
            <li>reward</li>
          </ul>
        </div>

        <div className="component">
          <span className="component_name">Locust</span>
          <span className="component_note">simulated shoppers, one connection per request</span>
        </div>
      </div>

      <div className="link_band" aria-hidden="true">
        <span className="link_label">Wi-Fi hotspot</span>
        <span className="link_wire link_wire_out">
          <span className="link_packet" />
          <span className="link_packet link_packet_late" />
        </span>
        <span className="link_wire link_wire_in">
          <span className="link_packet" />
          <span className="link_packet link_packet_late" />
        </span>
        <span className="link_flows">
          <span>traffic, faults, repairs</span>
          <span>metrics, logs, state</span>
        </span>
      </div>

      <div className="machine machine_cluster">
        <header className="machine_head">
          <span className="machine_tag">Machine A</span>
          <span className="machine_title">The shop</span>
          <span className="machine_spec">One laptop · single-node K3s</span>
        </header>

        <div className="component component_shop">
          <span className="component_name">Online Boutique</span>
          <ul className="service_grid">
            {managed_services.map((service) => (
              <li key={service} className="service_chip service_chip_managed">
                {service}
              </li>
            ))}
            {other_services.map((service) => (
              <li key={service} className="service_chip">
                {service}
              </li>
            ))}
          </ul>
          <span className="component_note">
            <span className="legend_swatch" /> managed by the agent
          </span>
        </div>

        <div className="component_row">
          <div className="component component_chaos">
            <span className="component_name">Chaos Mesh</span>
            <span className="component_note">CPU stress faults</span>
          </div>
          <div className="component">
            <span className="component_name">Prometheus</span>
            <span className="component_note">cAdvisor, 5 s scrape</span>
          </div>
        </div>
      </div>
    </div>
  );
}
