import type { CheckPlanOutput, ListPrdsOutput, PrdSummary, StructuredPRD } from "@makerkit/prd";

import { getPrdOverview, type PrdOverview } from "./prd-overview";

export interface ListProjectPrdsDeps {
  prdsDirExists(): Promise<boolean>;
  listPrds(): Promise<ListPrdsOutput>;
  /** The PRD and its plan check, for the overview. */
  loadPrd(filename: string): Promise<{ prd: StructuredPRD; check: CheckPlanOutput }>;
}

export interface PrdListItem extends PrdSummary {
  /** First paragraph of the overview, plain text, for the list. */
  summary: string;
  overview: PrdOverview;
}

export interface ProjectPrds {
  /** False when the project has no .prds folder yet. */
  hasPrdsDir: boolean;
  prds: PrdListItem[];
  /** Files that could not be read, e.g. invalid JSON. Shown, never fatal. */
  warnings: string[];
}

/**
 * Lists the project's PRDs with where each one stands. Checks for the .prds
 * folder first because PrdService.list() creates it, and viewing Loop must
 * not change the project.
 */
export async function listProjectPrds(deps: ListProjectPrdsDeps): Promise<ProjectPrds> {
  const prdsDirExists = await deps.prdsDirExists();

  if (!prdsDirExists) {
    return { hasPrdsDir: false, prds: [], warnings: [] };
  }

  const { prds, warnings } = await deps.listPrds();

  const items = await Promise.all(
    prds.map(async (summary): Promise<PrdListItem> => {
      const { prd, check } = await deps.loadPrd(summary.filename);

      return {
        ...summary,
        summary: firstParagraph(prd.introduction.overview),
        overview: getPrdOverview(prd, check),
      };
    }),
  );

  return { hasPrdsDir: true, prds: items, warnings };
}

/** The first paragraph as plain text, without Markdown markers, at most ~160 characters. */
export function firstParagraph(markdown: string) {
  const text = (markdown.split(/\n\s*\n/)[0] ?? "")
    .replace(/[*_`#>]/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();

  return text.length > 160 ? `${text.slice(0, 157).trimEnd()}…` : text;
}
