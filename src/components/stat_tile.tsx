import type { ReactNode } from "react";
import "./stat_tile.css";

type StatTileProps = {
  value: ReactNode;
  unit?: string;
  label: ReactNode;
  comparison?: ReactNode;
  tone?: "agent" | "fault" | "neutral";
};

export function StatTile({ value, unit, label, comparison, tone = "agent" }: StatTileProps) {
  return (
    <div className={`stat_tile stat_tile_${tone}`}>
      <p className="stat_value">
        {value}
        {unit ? <span className="stat_unit">{unit}</span> : null}
      </p>
      <p className="stat_label">{label}</p>
      {comparison ? <p className="stat_comparison">{comparison}</p> : null}
    </div>
  );
}
