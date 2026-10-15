import {
  $applyNodeReplacement,
  TextNode,
  type EditorConfig,
  type LexicalNode,
  type SerializedTextNode,
} from "lexical";

/**
 * A Markdown image (`![alt](attachments/diagram.png)`), kept as its source text.
 * The document view shows images from the PRD's attachments folder; the editor
 * shows the source as one unit, so editing text around it can't break the
 * image, and it is written back unchanged.
 */
export class MarkdownImageNode extends TextNode {
  static getType(): string {
    return "markdown-image";
  }

  static clone(node: MarkdownImageNode): MarkdownImageNode {
    return new MarkdownImageNode(node.__text, node.__key);
  }

  static importJSON(serializedNode: SerializedTextNode): MarkdownImageNode {
    return $createMarkdownImageNode(serializedNode.text).updateFromJSON(serializedNode);
  }

  createDOM(config: EditorConfig): HTMLElement {
    const dom = super.createDOM(config);
    dom.className = "rounded bg-muted px-1 py-0.5 font-mono text-[0.85em] text-muted-foreground";

    return dom;
  }

  canInsertTextBefore(): boolean {
    return false;
  }

  canInsertTextAfter(): boolean {
    return false;
  }

  isTextEntity(): true {
    return true;
  }
}

export function $createMarkdownImageNode(source: string): MarkdownImageNode {
  return $applyNodeReplacement(new MarkdownImageNode(source).setMode("token"));
}

export function $isMarkdownImageNode(
  node: LexicalNode | null | undefined,
): node is MarkdownImageNode {
  return node instanceof MarkdownImageNode;
}
