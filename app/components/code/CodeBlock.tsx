'use client';

import { useEffect, useRef, useState } from 'react';
import hljs from 'highlight.js';

interface CodeBlockProps {
  code: string;
  language?: string;
  fileName?: string;
  startLine?: number;
  highlightLines?: number[];
  maxLines?: number;
  showLineNumbers?: boolean;
}

const CopyIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
  </svg>
);

const CheckIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

function getLanguageFromFileName(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const languageMap: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    py: 'python',
    rb: 'ruby',
    rs: 'rust',
    go: 'go',
    java: 'java',
    kt: 'kotlin',
    swift: 'swift',
    c: 'c',
    cpp: 'cpp',
    h: 'c',
    hpp: 'cpp',
    cs: 'csharp',
    php: 'php',
    html: 'html',
    htm: 'html',
    css: 'css',
    scss: 'scss',
    less: 'less',
    json: 'json',
    jsonc: 'json',
    xml: 'xml',
    yaml: 'yaml',
    yml: 'yaml',
    toml: 'toml',
    md: 'markdown',
    mdx: 'markdown',
    sql: 'sql',
    sh: 'bash',
    bash: 'bash',
    zsh: 'bash',
    dockerfile: 'dockerfile',
    vue: 'html',
    svelte: 'html',
  };
  return languageMap[ext] || 'plaintext';
}

export default function CodeBlock({
  code,
  language,
  fileName,
  startLine = 1,
  highlightLines = [],
  maxLines = 20,
  showLineNumbers = true,
}: CodeBlockProps) {
  const codeRef = useRef<HTMLElement>(null);
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const lines = code.split('\n');
  const hasMoreLines = lines.length > maxLines;
  const displayLines = expanded ? lines : lines.slice(0, maxLines);
  const remainingLines = lines.length - maxLines;

  const lang = language || (fileName ? getLanguageFromFileName(fileName) : 'plaintext');

  useEffect(() => {
    if (codeRef.current) {
      hljs.highlightElement(codeRef.current);
    }
  }, [code, expanded]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="code-block">
      {fileName && (
        <div className="code-block-header">
          <span className="code-block-filename">{fileName}</span>
          <button
            className="code-block-copy"
            onClick={handleCopy}
            title={copied ? 'Copied!' : 'Copy code'}
          >
            {copied ? <CheckIcon /> : <CopyIcon />}
          </button>
        </div>
      )}
      <div className="code-block-content">
        {showLineNumbers && (
          <div className="code-block-line-numbers">
            {displayLines.map((_, i) => {
              const lineNum = startLine + i;
              const isHighlighted = highlightLines.includes(lineNum);
              return (
                <span
                  key={i}
                  className={`code-block-line-number ${isHighlighted ? 'highlighted' : ''}`}
                >
                  {lineNum}
                </span>
              );
            })}
          </div>
        )}
        <pre className="code-block-pre">
          <code ref={codeRef} className={`language-${lang}`}>
            {displayLines.join('\n')}
          </code>
        </pre>
      </div>
      {hasMoreLines && !expanded && (
        <button className="code-block-expand" onClick={() => setExpanded(true)}>
          Show {remainingLines} more line{remainingLines !== 1 ? 's' : ''}
        </button>
      )}
      {expanded && hasMoreLines && (
        <button className="code-block-expand" onClick={() => setExpanded(false)}>
          Show less
        </button>
      )}
    </div>
  );
}
