'use client';

import { useMemo } from 'react';

interface DiffViewProps {
  oldContent: string;
  newContent: string;
  fileName?: string;
  mode?: 'unified' | 'split';
}

interface DiffLine {
  type: 'unchanged' | 'added' | 'removed' | 'context';
  content: string;
  oldLineNum?: number;
  newLineNum?: number;
}

function computeDiff(oldContent: string, newContent: string): DiffLine[] {
  const oldLines = oldContent.split('\n');
  const newLines = newContent.split('\n');
  const result: DiffLine[] = [];

  // Simple LCS-based diff algorithm
  const lcs = computeLCS(oldLines, newLines);

  let oldIdx = 0;
  let newIdx = 0;
  let lcsIdx = 0;
  let oldLineNum = 1;
  let newLineNum = 1;

  while (oldIdx < oldLines.length || newIdx < newLines.length) {
    if (lcsIdx < lcs.length && oldIdx < oldLines.length && oldLines[oldIdx] === lcs[lcsIdx]) {
      // Found a common line
      if (newIdx < newLines.length && newLines[newIdx] === lcs[lcsIdx]) {
        result.push({
          type: 'unchanged',
          content: oldLines[oldIdx],
          oldLineNum: oldLineNum++,
          newLineNum: newLineNum++,
        });
        oldIdx++;
        newIdx++;
        lcsIdx++;
      } else if (newIdx < newLines.length) {
        // New line added before the common line
        result.push({
          type: 'added',
          content: newLines[newIdx],
          newLineNum: newLineNum++,
        });
        newIdx++;
      }
    } else if (oldIdx < oldLines.length && (lcsIdx >= lcs.length || oldLines[oldIdx] !== lcs[lcsIdx])) {
      // Old line removed
      result.push({
        type: 'removed',
        content: oldLines[oldIdx],
        oldLineNum: oldLineNum++,
      });
      oldIdx++;
    } else if (newIdx < newLines.length) {
      // New line added
      result.push({
        type: 'added',
        content: newLines[newIdx],
        newLineNum: newLineNum++,
      });
      newIdx++;
    }
  }

  return result;
}

function computeLCS(a: string[], b: string[]): string[] {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to find LCS
  const lcs: string[] = [];
  let i = m, j = n;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      lcs.unshift(a[i - 1]);
      i--;
      j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  return lcs;
}

export default function DiffView({
  oldContent,
  newContent,
  fileName,
  mode = 'unified',
}: DiffViewProps) {
  const diffLines = useMemo(() => computeDiff(oldContent, newContent), [oldContent, newContent]);

  // Calculate stats
  const addedCount = diffLines.filter(l => l.type === 'added').length;
  const removedCount = diffLines.filter(l => l.type === 'removed').length;

  return (
    <div className="diff-view">
      {fileName && (
        <div className="diff-view-header">
          <span className="diff-view-filename">{fileName}</span>
          <span className="diff-view-stats">
            <span className="diff-stat added">+{addedCount}</span>
            <span className="diff-stat removed">-{removedCount}</span>
          </span>
        </div>
      )}
      <div className="diff-view-content">
        {diffLines.map((line, idx) => (
          <div key={idx} className={`diff-line ${line.type}`}>
            <span className="diff-line-numbers">
              <span className="diff-line-num old">
                {line.type !== 'added' ? line.oldLineNum : ''}
              </span>
              <span className="diff-line-num new">
                {line.type !== 'removed' ? line.newLineNum : ''}
              </span>
            </span>
            <span className="diff-line-marker">
              {line.type === 'added' && '+'}
              {line.type === 'removed' && '-'}
              {line.type === 'unchanged' && ' '}
            </span>
            <span className="diff-line-content">{line.content}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
