'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface GitStatus {
  modified: string[];
  added: string[];
  deleted: string[];
  untracked: string[];
}

export default function WorkspacePage() {
  const params = useParams();
  const router = useRouter();
  const repoFullName = Array.isArray(params.repo) ? params.repo.join('/') : params.repo;

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [gitStatus, setGitStatus] = useState<GitStatus | null>(null);
  const [showGitPanel, setShowGitPanel] = useState(false);
  const [commitMessage, setCommitMessage] = useState('');
  const [committing, setCommitting] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [sessionId] = useState(() => `workspace-${Date.now()}`);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    // Load initial git status
    loadGitStatus();
  }, [repoFullName]);

  async function loadGitStatus() {
    try {
      const response = await fetch(`/api/workspace/git/status?repo=${encodeURIComponent(repoFullName)}`);
      const data = await response.json();
      if (data.status) {
        setGitStatus(data.status);
      }
    } catch (err) {
      console.error('Failed to load git status:', err);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      const response = await fetch('/api/workspace/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          repoFullName,
          sessionId,
        }),
      });

      if (!response.body) {
        throw new Error('No response body');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantMessage = '';

      setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === 'chunk' && data.content) {
                assistantMessage += data.content;
                setMessages((prev) => {
                  const newMessages = [...prev];
                  newMessages[newMessages.length - 1] = {
                    role: 'assistant',
                    content: assistantMessage,
                  };
                  return newMessages;
                });
              }
            } catch (e) {
              // Ignore parse errors
            }
          }
        }
      }

      // Refresh git status after Claude might have made changes
      loadGitStatus();
    } catch (err) {
      console.error('Chat error:', err);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Error: Failed to get response' },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function handleCommit() {
    if (!commitMessage.trim()) return;
    setCommitting(true);

    try {
      const response = await fetch('/api/workspace/git/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repoFullName,
          message: commitMessage,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setCommitMessage('');
        loadGitStatus();
        alert('Changes committed successfully!');
      } else {
        alert(`Commit failed: ${data.error}`);
      }
    } catch (err) {
      alert('Failed to commit changes');
    } finally {
      setCommitting(false);
    }
  }

  async function handlePush() {
    try {
      const response = await fetch('/api/workspace/git/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoFullName }),
      });

      const data = await response.json();
      if (data.success) {
        alert('Pushed to remote successfully!');
      } else {
        alert(`Push failed: ${data.error}`);
      }
    } catch (err) {
      alert('Failed to push changes');
    }
  }

  const hasChanges = gitStatus && (
    gitStatus.modified.length > 0 ||
    gitStatus.added.length > 0 ||
    gitStatus.deleted.length > 0 ||
    gitStatus.untracked.length > 0
  );

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-800 p-4 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/repos')}
            className="text-gray-400 hover:text-white"
          >
            ← Back
          </button>
          <h1 className="text-xl font-bold text-purple-400">{repoFullName}</h1>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowGitPanel(!showGitPanel)}
            className={`px-4 py-2 rounded-lg transition-colors ${
              hasChanges
                ? 'bg-yellow-600 hover:bg-yellow-500'
                : 'bg-gray-700 hover:bg-gray-600'
            }`}
          >
            Git {hasChanges && `(${(gitStatus?.modified.length || 0) + (gitStatus?.untracked.length || 0)} changes)`}
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Chat panel */}
        <div className="flex-1 flex flex-col">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <div className="text-gray-500 text-center py-12">
                <p className="text-lg">Ready to work on {repoFullName}</p>
                <p className="text-sm mt-2">Ask Claude to read, edit, or create files in this repository.</p>
              </div>
            )}
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`p-4 rounded-lg ${
                  msg.role === 'user'
                    ? 'bg-purple-900/30 border border-purple-800'
                    : 'bg-gray-800 border border-gray-700'
                }`}
              >
                <div className="text-xs text-gray-500 mb-2">
                  {msg.role === 'user' ? 'You' : 'Claude'}
                </div>
                <div className="whitespace-pre-wrap">{msg.content}</div>
              </div>
            ))}
            {loading && (
              <div className="text-gray-500">Claude is thinking...</div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form onSubmit={handleSubmit} className="p-4 border-t border-gray-800">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask Claude to edit code..."
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 focus:outline-none focus:border-purple-500"
                disabled={loading}
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 px-6 py-3 rounded-lg transition-colors"
              >
                Send
              </button>
            </div>
          </form>
        </div>

        {/* Git panel */}
        {showGitPanel && (
          <div className="w-80 border-l border-gray-800 p-4 overflow-y-auto">
            <h2 className="text-lg font-semibold mb-4">Git Status</h2>

            {gitStatus && (
              <div className="space-y-4">
                {gitStatus.modified.length > 0 && (
                  <div>
                    <h3 className="text-sm text-yellow-400 mb-2">Modified</h3>
                    {gitStatus.modified.map((file) => (
                      <div key={file} className="text-sm text-gray-400 truncate">
                        {file}
                      </div>
                    ))}
                  </div>
                )}

                {gitStatus.added.length > 0 && (
                  <div>
                    <h3 className="text-sm text-green-400 mb-2">Added</h3>
                    {gitStatus.added.map((file) => (
                      <div key={file} className="text-sm text-gray-400 truncate">
                        {file}
                      </div>
                    ))}
                  </div>
                )}

                {gitStatus.untracked.length > 0 && (
                  <div>
                    <h3 className="text-sm text-gray-400 mb-2">Untracked</h3>
                    {gitStatus.untracked.map((file) => (
                      <div key={file} className="text-sm text-gray-500 truncate">
                        {file}
                      </div>
                    ))}
                  </div>
                )}

                {gitStatus.deleted.length > 0 && (
                  <div>
                    <h3 className="text-sm text-red-400 mb-2">Deleted</h3>
                    {gitStatus.deleted.map((file) => (
                      <div key={file} className="text-sm text-gray-400 truncate">
                        {file}
                      </div>
                    ))}
                  </div>
                )}

                {!hasChanges && (
                  <div className="text-gray-500 text-sm">No changes</div>
                )}

                {hasChanges && (
                  <div className="pt-4 space-y-3">
                    <input
                      type="text"
                      value={commitMessage}
                      onChange={(e) => setCommitMessage(e.target.value)}
                      placeholder="Commit message..."
                      className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm"
                    />
                    <button
                      onClick={handleCommit}
                      disabled={!commitMessage.trim() || committing}
                      className="w-full bg-green-600 hover:bg-green-500 disabled:bg-gray-700 px-4 py-2 rounded text-sm"
                    >
                      {committing ? 'Committing...' : 'Commit All'}
                    </button>
                    <button
                      onClick={handlePush}
                      className="w-full bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded text-sm"
                    >
                      Push to GitHub
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
