import { CheckIcon, CopyIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "#/components/ui/button";

/** An instruction for the user's agent, shown as text with a copy button. */
export function CopyInstruction({ instruction }: { instruction: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) {
      return;
    }

    const timeout = setTimeout(() => setCopied(false), 2000);

    return () => clearTimeout(timeout);
  }, [copied]);

  return (
    <div className="flex w-full items-center gap-2 rounded-lg border bg-muted/50 p-2 pl-3 text-left">
      <code className="flex-1 font-mono text-sm">{instruction}</code>
      <Button
        variant="outline"
        size="sm"
        onClick={() => navigator.clipboard.writeText(instruction).then(() => setCopied(true))}
      >
        {copied ? <CheckIcon data-icon="inline-start" /> : <CopyIcon data-icon="inline-start" />}
        {copied ? "Copied" : "Copy instruction"}
      </Button>
    </div>
  );
}
