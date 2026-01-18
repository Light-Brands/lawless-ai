/**
 * Command Dictionary - Static data for all commands, skills, and agents
 * Used for slash autocomplete and dictionary popup
 */

export interface DictionaryItem {
  name: string;
  description: string;
  type: 'command' | 'skill' | 'agent';
  category: string;
  color?: string; // for agents
  usage?: string; // e.g., "/autotask [task]"
}

export const commandDictionary: DictionaryItem[] = [
  // Commands (18)
  {
    name: 'autotask',
    description: 'Execute task autonomously from description to PR-ready',
    type: 'command',
    category: 'Autonomous',
    usage: '/autotask [task description]',
  },
  {
    name: 'address-pr-comments',
    description: 'Triage and address PR comments from code review bots',
    type: 'command',
    category: 'Review & Quality',
    usage: '/address-pr-comments [PR number]',
  },
  {
    name: 'multi-review',
    description: 'Multi-agent code review with diverse perspectives',
    type: 'command',
    category: 'Review & Quality',
    usage: '/multi-review',
  },
  {
    name: 'verify-fix',
    description: 'Verify a fix actually works before claiming success',
    type: 'command',
    category: 'Review & Quality',
    usage: '/verify-fix',
  },
  {
    name: 'load-rules',
    description: 'Load relevant coding rules for the current task',
    type: 'command',
    category: 'Planning & Research',
    usage: '/load-rules',
  },
  {
    name: 'product-intel',
    description: 'Research product intelligence on competitors and trends',
    type: 'command',
    category: 'Planning & Research',
    usage: '/product-intel [topic]',
  },
  {
    name: 'knowledge',
    description: 'AI Product Manager - maintain living product understanding',
    type: 'command',
    category: 'Planning & Research',
    usage: '/knowledge',
  },
  {
    name: 'setup-environment',
    description: 'Initialize development environment for git worktree',
    type: 'command',
    category: 'Environment & Git',
    usage: '/setup-environment',
  },
  {
    name: 'cleanup-worktree',
    description: 'Clean up a git worktree after its PR has been merged',
    type: 'command',
    category: 'Environment & Git',
    usage: '/cleanup-worktree',
  },
  {
    name: 'session',
    description: 'Save and resume development sessions across conversations',
    type: 'command',
    category: 'Environment & Git',
    usage: '/session [save|resume]',
  },
  {
    name: 'handoff-context',
    description: 'Generate context handoff for new session',
    type: 'command',
    category: 'Environment & Git',
    usage: '/handoff-context',
  },
  {
    name: 'ai-coding-config',
    description: 'Interactive setup for Claude Code, Cursor, and other AI tools',
    type: 'command',
    category: 'Configuration',
    usage: '/ai-coding-config',
  },
  {
    name: 'personality-change',
    description: 'Change or activate a personality for Claude Code and Cursor',
    type: 'command',
    category: 'Configuration',
    usage: '/personality-change [personality]',
  },
  {
    name: 'repo-tooling',
    description: 'Set up repos with linting, formatting, and CI/CD',
    type: 'command',
    category: 'Configuration',
    usage: '/repo-tooling',
  },
  {
    name: 'troubleshoot',
    description: 'Autonomous production error resolution from Sentry or logs',
    type: 'command',
    category: 'Autonomous',
    usage: '/troubleshoot [error]',
  },
  {
    name: 'create-prompt',
    description: 'Create optimized prompts following prompt-engineering principles',
    type: 'command',
    category: 'Content Generation',
    usage: '/create-prompt',
  },
  {
    name: 'generate-AGENTS-file',
    description: 'Generate AGENTS.md with project context for AI assistants',
    type: 'command',
    category: 'Content Generation',
    usage: '/generate-AGENTS-file',
  },
  {
    name: 'generate-llms-txt',
    description: 'Generate llms.txt to help LLMs understand your site',
    type: 'command',
    category: 'Content Generation',
    usage: '/generate-llms-txt',
  },

  // Skills (7)
  {
    name: 'brainstorming',
    description: 'Explore options when requirements are fuzzy or multiple approaches exist',
    type: 'skill',
    category: 'Planning',
    usage: '/brainstorming',
  },
  {
    name: 'brainstorm-synthesis',
    description: 'M-of-N synthesis for hard architectural decisions',
    type: 'skill',
    category: 'Planning',
    usage: '/brainstorm-synthesis',
  },
  {
    name: 'systematic-debugging',
    description: 'Find root cause before fixing - understand why before how',
    type: 'skill',
    category: 'Debugging',
    usage: '/systematic-debugging',
  },
  {
    name: 'research',
    description: 'Web research for current APIs, versions, and documentation',
    type: 'skill',
    category: 'Research',
    usage: '/research [topic]',
  },
  {
    name: 'playwright-browser',
    description: 'Automate browsers, test pages, take screenshots, check UI',
    type: 'skill',
    category: 'Testing',
    usage: '/playwright-browser',
  },
  {
    name: 'skill-creator',
    description: 'Create and edit SKILL.md files for new reusable techniques',
    type: 'skill',
    category: 'Meta',
    usage: '/skill-creator',
  },
  {
    name: 'youtube-transcript-analyzer',
    description: 'Analyze YouTube videos, extract insights from tutorials and talks',
    type: 'skill',
    category: 'Research',
    usage: '/youtube-transcript-analyzer [url]',
  },

  // Agents (24)
  {
    name: 'security-reviewer',
    description: 'Injection flaws, authentication, OWASP vulnerabilities',
    type: 'agent',
    category: 'Security',
    color: 'red',
  },
  {
    name: 'logic-reviewer',
    description: 'Logic bugs, edge cases, off-by-one errors, race conditions',
    type: 'agent',
    category: 'Bugs/Correctness',
    color: 'orange',
  },
  {
    name: 'error-handling-reviewer',
    description: 'Silent failures, try-catch patterns, actionable error feedback',
    type: 'agent',
    category: 'Bugs/Correctness',
    color: 'orange',
  },
  {
    name: 'robustness-reviewer',
    description: 'Production readiness, fragile code, resilience, reliability',
    type: 'agent',
    category: 'Bugs/Correctness',
    color: 'orange',
  },
  {
    name: 'performance-reviewer',
    description: 'N+1 queries, algorithmic complexity, efficiency problems',
    type: 'agent',
    category: 'Performance',
    color: 'yellow',
  },
  {
    name: 'test-analyzer',
    description: 'Test coverage, test quality, brittle tests, coverage gaps',
    type: 'agent',
    category: 'Testing',
    color: 'green',
  },
  {
    name: 'test-engineer',
    description: 'Write tests, generate coverage, unit/integration tests',
    type: 'agent',
    category: 'Testing',
    color: 'green',
  },
  {
    name: 'test-runner',
    description: 'Run tests, check results, get pass/fail status',
    type: 'agent',
    category: 'Testing',
    color: 'green',
  },
  {
    name: 'observability-reviewer',
    description: 'Logging, error tracking, monitoring, debuggability',
    type: 'agent',
    category: 'Observability',
    color: 'cyan',
  },
  {
    name: 'site-keeper',
    description: 'Monitor production health, triage errors, reliability checks',
    type: 'agent',
    category: 'Observability',
    color: 'cyan',
  },
  {
    name: 'style-reviewer',
    description: 'Code style, naming conventions, project patterns, consistency',
    type: 'agent',
    category: 'Style',
    color: 'blue',
  },
  {
    name: 'comment-analyzer',
    description: 'Review comments, docstrings, documentation accuracy',
    type: 'agent',
    category: 'Style',
    color: 'blue',
  },
  {
    name: 'ux-designer',
    description: 'User interfaces, user-facing content, error messages, polish',
    type: 'agent',
    category: 'Design/UX',
    color: 'purple',
  },
  {
    name: 'empathy-reviewer',
    description: 'UX review, user experience, user-facing features',
    type: 'agent',
    category: 'Design/UX',
    color: 'purple',
  },
  {
    name: 'design-reviewer',
    description: 'Frontend design, UI quality, visual consistency, responsive',
    type: 'agent',
    category: 'Design/UX',
    color: 'purple',
  },
  {
    name: 'mobile-ux-reviewer',
    description: 'Mobile UX, responsive design, touch interactions',
    type: 'agent',
    category: 'Design/UX',
    color: 'purple',
  },
  {
    name: 'seo-specialist',
    description: 'SEO audit, search rankings, structured data, Core Web Vitals',
    type: 'agent',
    category: 'Design/UX',
    color: 'purple',
  },
  {
    name: 'architecture-auditor',
    description: 'Architecture review, design patterns, dependency audit',
    type: 'agent',
    category: 'Architecture',
    color: 'magenta',
  },
  {
    name: 'simplifier',
    description: 'Simplify code, reduce complexity, eliminate redundancy',
    type: 'agent',
    category: 'Architecture',
    color: 'magenta',
  },
  {
    name: 'debugger',
    description: 'Debug errors, investigate failures, find root causes',
    type: 'agent',
    category: 'Architecture',
    color: 'magenta',
  },
  {
    name: 'prompt-engineer',
    description: 'Write prompts, agent instructions, LLM-to-LLM communication',
    type: 'agent',
    category: 'Architecture',
    color: 'magenta',
  },
  {
    name: 'git-writer',
    description: 'Commit messages, PR descriptions, branch naming',
    type: 'agent',
    category: 'Architecture',
    color: 'magenta',
  },
  {
    name: 'library-advisor',
    description: 'Choose libraries, evaluate packages, build vs buy decisions',
    type: 'agent',
    category: 'Architecture',
    color: 'magenta',
  },
  {
    name: 'autonomous-developer',
    description: 'Complete tasks autonomously, deliver PR-ready code',
    type: 'agent',
    category: 'Architecture',
    color: 'magenta',
  },
];

// Category groupings for organized display
export const categories = {
  commands: [
    'Autonomous',
    'Review & Quality',
    'Planning & Research',
    'Environment & Git',
    'Configuration',
    'Content Generation',
  ],
  skills: ['Planning', 'Debugging', 'Testing', 'Research', 'Meta'],
  agents: [
    'Security',
    'Bugs/Correctness',
    'Performance',
    'Testing',
    'Observability',
    'Style',
    'Design/UX',
    'Architecture',
  ],
};

// Helper to get color class for agent categories
export const agentColorMap: Record<string, string> = {
  red: '#ef4444',
  orange: '#f97316',
  yellow: '#eab308',
  green: '#22c55e',
  cyan: '#06b6d4',
  blue: '#3b82f6',
  purple: '#a855f7',
  magenta: '#ec4899',
};

// Get icon for item type
export function getTypeIcon(type: DictionaryItem['type']): string {
  switch (type) {
    case 'command':
      return '/';
    case 'skill':
      return '*';
    case 'agent':
      return '@';
  }
}

// Filter dictionary by search term
export function filterDictionary(items: DictionaryItem[], searchTerm: string): DictionaryItem[] {
  const term = searchTerm.toLowerCase().trim();
  if (!term) return items;

  return items.filter(
    (item) =>
      item.name.toLowerCase().includes(term) ||
      item.description.toLowerCase().includes(term) ||
      item.category.toLowerCase().includes(term)
  );
}

// Group items by category
export function groupByCategory(items: DictionaryItem[]): Record<string, DictionaryItem[]> {
  return items.reduce(
    (acc, item) => {
      if (!acc[item.category]) {
        acc[item.category] = [];
      }
      acc[item.category].push(item);
      return acc;
    },
    {} as Record<string, DictionaryItem[]>
  );
}

// Group items by type
export function groupByType(items: DictionaryItem[]): Record<string, DictionaryItem[]> {
  return items.reduce(
    (acc, item) => {
      if (!acc[item.type]) {
        acc[item.type] = [];
      }
      acc[item.type].push(item);
      return acc;
    },
    {} as Record<string, DictionaryItem[]>
  );
}
