'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { marked } from 'marked';
import hljs from 'highlight.js';
import { MermaidDiagram } from './MermaidDiagram';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

interface ContentBlock {
  type: 'html' | 'mermaid';
  content: string;
  id?: string;
}

export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  const [blocks, setBlocks] = useState<ContentBlock[]>([]);

  // Parse markdown and extract mermaid blocks
  useEffect(() => {
    const parseContent = async () => {
      // Configure marked with syntax highlighting (but skip mermaid blocks)
      marked.setOptions({
        gfm: true,
        breaks: true,
        highlight: (code: string, lang: string) => {
          // Don't highlight mermaid blocks - we'll handle them separately
          if (lang === 'mermaid') {
            return code;
          }
          if (lang && hljs.getLanguage(lang)) {
            try {
              return hljs.highlight(code, { language: lang }).value;
            } catch {
              return code;
            }
          }
          try {
            return hljs.highlightAuto(code).value;
          } catch {
            return code;
          }
        },
      });

      // First, extract mermaid blocks and replace with placeholders
      const mermaidBlocks: { id: string; code: string }[] = [];
      let mermaidIndex = 0;

      const contentWithPlaceholders = content.replace(
        /```mermaid\n([\s\S]*?)```/g,
        (_, code) => {
          const id = `mermaid-block-${mermaidIndex++}`;
          mermaidBlocks.push({ id, code: code.trim() });
          return `<!--MERMAID_PLACEHOLDER_${id}-->`;
        }
      );

      // Render the markdown
      const rendered = await marked(contentWithPlaceholders);
      const htmlContent = typeof rendered === 'string' ? rendered : await rendered;

      // Split by mermaid placeholders and create blocks
      const parts = htmlContent.split(/<!--MERMAID_PLACEHOLDER_(mermaid-block-\d+)-->/);
      const resultBlocks: ContentBlock[] = [];

      for (let i = 0; i < parts.length; i++) {
        if (i % 2 === 0) {
          // HTML content
          if (parts[i].trim()) {
            resultBlocks.push({ type: 'html', content: parts[i] });
          }
        } else {
          // Mermaid placeholder ID
          const mermaidBlock = mermaidBlocks.find(b => b.id === parts[i]);
          if (mermaidBlock) {
            resultBlocks.push({
              type: 'mermaid',
              content: mermaidBlock.code,
              id: mermaidBlock.id,
            });
          }
        }
      }

      setBlocks(resultBlocks);
    };

    parseContent();
  }, [content]);

  // Memoize the rendered output
  const renderedContent = useMemo(() => (
    <div className={`markdown-body ${className || ''}`}>
      {blocks.map((block, index) => {
        if (block.type === 'mermaid') {
          return (
            <MermaidDiagram
              key={block.id || index}
              code={block.content}
              id={block.id || `diagram-${index}`}
            />
          );
        }
        return (
          <div
            key={index}
            dangerouslySetInnerHTML={{ __html: block.content }}
          />
        );
      })}
    </div>
  ), [blocks, className]);

  return renderedContent;
}

export default MarkdownRenderer;
