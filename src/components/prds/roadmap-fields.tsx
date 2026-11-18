import type { PrdRoadmap } from "@makerkit/prd";

import { SECTION_EDITS } from "#/lib/prds/section-edits";

export function RoadmapFields({ roadmap }: { roadmap?: PrdRoadmap }) {
  const fields = SECTION_EDITS.roadmap.fields.filter(({ key }) => roadmap?.[key] != null);

  if (fields.length === 0) {
    return <p className="text-sm text-muted-foreground">No roadmap metadata set.</p>;
  }

  return (
    <dl className="grid gap-2 text-sm">
      {fields.map(({ key, label }) => (
        <div key={key} className="flex flex-wrap gap-x-2">
          <dt className="font-medium">{label}</dt>
          <dd className={key === "criticality" ? "capitalize" : undefined}>{roadmap?.[key]}</dd>
        </div>
      ))}
    </dl>
  );
}
