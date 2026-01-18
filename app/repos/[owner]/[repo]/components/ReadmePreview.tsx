'use client';

import { useEffect, useState } from 'react';
import { marked } from 'marked';

interface ReadmeData {
  name: string;
  path: string;
  content: string;
  htmlUrl: string;
}

interface ReadmePreviewProps {
  readme: ReadmeData;
}

const BookIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>
  </svg>
);

export default function ReadmePreview({ readme }: ReadmePreviewProps) {
  const [html, setHtml] = useState<string>('');

  useEffect(() => {
    // Configure marked for GitHub-flavored markdown
    marked.setOptions({
      gfm: true,
      breaks: true,
    });

    const rendered = marked(readme.content);
    if (typeof rendered === 'string') {
      setHtml(rendered);
    } else {
      rendered.then(setHtml);
    }
  }, [readme.content]);

  return (
    <div className="readme-preview">
      <div className="readme-header">
        <BookIcon />
        <span className="readme-title">{readme.name}</span>
      </div>
      <div
        className="readme-content markdown-body"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
