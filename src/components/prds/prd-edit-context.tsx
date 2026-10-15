import type { StructuredPRD } from "@makerkit/prd";
import { createContext, useContext } from "react";

/** The PRD being shown, as last loaded. Editors read from it. */
const PrdEditContext = createContext<{ filename: string; prd: StructuredPRD } | null>(null);

export const PrdEditProvider = PrdEditContext.Provider;

export function usePrdEdit() {
  const context = useContext(PrdEditContext);

  if (!context) {
    throw new Error("usePrdEdit must be used inside PrdEditProvider");
  }

  return context;
}
