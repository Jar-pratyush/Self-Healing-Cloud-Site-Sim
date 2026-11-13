export type SectionEntry = {
  section_id: string;
  section_number: number;
  nav_label: string;
};

// Order of the page. Section ids double as URL anchors.
export const section_list: SectionEntry[] = [
  { section_id: "problem", section_number: 1, nav_label: "Problem" },
  { section_id: "how_it_works", section_number: 2, nav_label: "How it works" },
  { section_id: "replay", section_number: 3, nav_label: "Replay" },
  { section_id: "results", section_number: 4, nav_label: "Results" },
  { section_id: "deep_dive", section_number: 5, nav_label: "Deep dive" },
  { section_id: "credits", section_number: 6, nav_label: "Credits" },
];
