import { useEffect, useState } from "react";

// Returns the id of the section currently crossing the upper third of the
// viewport, for highlighting the matching link in the header.
export function useActiveSection(section_ids: string[]): string | null {
  const [active_id, set_active_id] = useState<string | null>(null);
  const id_key = section_ids.join("|");

  useEffect(() => {
    const observed_ids = id_key.split("|");
    const visible_ids = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            visible_ids.add(entry.target.id);
          } else {
            visible_ids.delete(entry.target.id);
          }
        }
        const first_visible = observed_ids.find((section_id) => visible_ids.has(section_id));
        set_active_id(first_visible ?? null);
      },
      { rootMargin: "-30% 0px -60% 0px" },
    );

    for (const section_id of observed_ids) {
      const element = document.getElementById(section_id);
      if (element) {
        observer.observe(element);
      }
    }
    return () => observer.disconnect();
  }, [id_key]);

  return active_id;
}
