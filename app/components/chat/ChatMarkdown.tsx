'use client';

import React, { useMemo } from 'react';
import { marked } from 'marked';
import hljs from 'highlight.js';

interface ChatMarkdownProps {
  content: string;
  className?: string;
}

// Configure marked once
const renderer = new marked.Renderer();
renderer.code = (code: string, lang: string | undefined) => {
  let highlighted = code;
  if (lang && hljs.getLanguage(lang)) {
    try {
      highlighted = hljs.highlight(code, { language: lang }).value;
    } catch {
      // fallback
    }
  } else {
    try {
      highlighted = hljs.highlightAuto(code).value;
    } catch {
      // fallback
    }
  }
  const langClass = lang ? `language-${lang}` : '';
  return `<pre><code class="hljs ${langClass}">${highlighted}</code></pre>`;
};

marked.setOptions({
  gfm: true,
  breaks: true,
  renderer,
});

export function ChatMarkdown({ content, className }: ChatMarkdownProps) {
  const html = useMemo(() => {
    try {
      const result = marked.parse(content);
      return typeof result === 'string' ? result : '';
    } catch {
      return content;
    }
  }, [content]);

  return (
    <div
      className={`chat-markdown ${className || ''}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export default ChatMarkdown;
