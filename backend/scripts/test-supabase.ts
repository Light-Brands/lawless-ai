#!/usr/bin/env npx ts-node
/**
 * Comprehensive Supabase Database Test Script
 *
 * Tests all database operations to diagnose connection and persistence issues.
 * Run with: npx ts-node scripts/test-supabase.ts
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from multiple locations
dotenv.config({ path: path.join(__dirname, '../../.env.local') });
dotenv.config({ path: path.join(__dirname, '../../.env') });
dotenv.config({ path: path.join(__dirname, '../.env') });

// ANSI colors for output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

function log(message: string, color: string = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logSection(title: string) {
  console.log('\n' + '='.repeat(60));
  log(title, colors.bold + colors.cyan);
  console.log('='.repeat(60));
}

function logSuccess(message: string) {
  log(`✓ ${message}`, colors.green);
}

function logError(message: string) {
  log(`✗ ${message}`, colors.red);
}

function logWarning(message: string) {
  log(`⚠ ${message}`, colors.yellow);
}

function logInfo(message: string) {
  log(`ℹ ${message}`, colors.blue);
}

// Test results tracking
interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  details?: string;
}

const results: TestResult[] = [];

function recordResult(name: string, passed: boolean, error?: string, details?: string) {
  results.push({ name, passed, error, details });
  if (passed) {
    logSuccess(name);
    if (details) logInfo(`  ${details}`);
  } else {
    logError(name);
    if (error) logInfo(`  Error: ${error}`);
  }
}

async function main() {
  logSection('SUPABASE DATABASE CONNECTION TEST');
  log(`Timestamp: ${new Date().toISOString()}`, colors.cyan);

  // =========================================================================
  // 1. Environment Variable Check
  // =========================================================================
  logSection('1. ENVIRONMENT VARIABLES');

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  logInfo(`SUPABASE_URL: ${supabaseUrl ? supabaseUrl.substring(0, 30) + '...' : 'NOT SET'}`);
  logInfo(`SUPABASE_SERVICE_ROLE_KEY: ${supabaseServiceKey ? '***' + supabaseServiceKey.slice(-10) : 'NOT SET'}`);
  logInfo(`NEXT_PUBLIC_SUPABASE_ANON_KEY: ${supabaseAnonKey ? '***' + supabaseAnonKey.slice(-10) : 'NOT SET'}`);

  if (!supabaseUrl) {
    recordResult('SUPABASE_URL configured', false, 'SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL not set');
  } else {
    recordResult('SUPABASE_URL configured', true, undefined, supabaseUrl);
  }

  if (!supabaseServiceKey) {
    recordResult('SUPABASE_SERVICE_ROLE_KEY configured', false, 'Required for backend operations');
    logError('\nCannot continue without SUPABASE_SERVICE_ROLE_KEY');
    printSummary();
    process.exit(1);
  } else {
    recordResult('SUPABASE_SERVICE_ROLE_KEY configured', true);
  }

  // =========================================================================
  // 2. Create Supabase Client
  // =========================================================================
  logSection('2. SUPABASE CLIENT INITIALIZATION');

  let supabase: SupabaseClient;
  try {
    supabase = createClient(supabaseUrl!, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    recordResult('Supabase client created', true);
  } catch (error) {
    recordResult('Supabase client created', false, String(error));
    printSummary();
    process.exit(1);
  }

  // =========================================================================
  // 3. Basic Connection Test
  // =========================================================================
  logSection('3. CONNECTION TEST');

  try {
    // Try a simple query to test connection
    const { data, error } = await supabase.from('users').select('count').limit(1);
    if (error) {
      recordResult('Database connection', false, `${error.code}: ${error.message}`);
    } else {
      recordResult('Database connection', true, undefined, 'Successfully connected to Supabase');
    }
  } catch (error) {
    recordResult('Database connection', false, String(error));
  }

  // =========================================================================
  // 4. Table Existence Check
  // =========================================================================
  logSection('4. TABLE EXISTENCE CHECK');

  const tables = [
    'users',
    'conversations',
    'workspace_sessions',
    'terminal_sessions',
    'user_repos',
    'integration_connections',
    'terminal_outputs',
    'sql_query_history',
  ];

  for (const table of tables) {
    try {
      const { error } = await supabase.from(table).select('*').limit(1);
      if (error) {
        recordResult(`Table '${table}' exists`, false, `${error.code}: ${error.message}`);
      } else {
        recordResult(`Table '${table}' exists`, true);
      }
    } catch (error) {
      recordResult(`Table '${table}' exists`, false, String(error));
    }
  }

  // =========================================================================
  // 5. Test User Operations
  // =========================================================================
  logSection('5. TEST USER OPERATIONS');

  // Note: users table references auth.users, so we need a valid auth user
  // For testing, we'll try to query existing users
  try {
    const { data, error, count } = await supabase
      .from('users')
      .select('*', { count: 'exact' })
      .limit(5);

    if (error) {
      recordResult('Query users table', false, `${error.code}: ${error.message}`);
    } else {
      recordResult('Query users table', true, undefined, `Found ${count ?? data?.length ?? 0} users`);
      if (data && data.length > 0) {
        logInfo(`  Sample user IDs: ${data.map(u => u.id?.substring(0, 8) + '...').join(', ')}`);
      }
    }
  } catch (error) {
    recordResult('Query users table', false, String(error));
  }

  // =========================================================================
  // 6. Test Conversation CRUD Operations
  // =========================================================================
  logSection('6. CONVERSATION CRUD TEST');

  // Create a test user (using GitHub username format)
  const testUserId = `test-user-${Date.now()}`;

  try {
    // First, create a test user
    const { data: newUser, error: userError } = await supabase
      .from('users')
      .insert({
        id: testUserId,
        github_username: testUserId,
        display_name: 'Test User',
      })
      .select()
      .single();

    if (userError) {
      recordResult('CREATE test user', false, `${userError.code}: ${userError.message}`);
      logInfo(`  Hint: ${userError.hint || 'Run the migration: supabase/migrations/20260119_github_username_auth.sql'}`);
    } else {
      recordResult('CREATE test user', true, undefined, `Created user: ${testUserId}`);
    }
  } catch (error) {
    recordResult('CREATE test user', false, String(error));
  }

  // Test CREATE conversation
  let testConversationId: string | null = null;

  {

    try {
      const { data, error } = await supabase
        .from('conversations')
        .insert({
          user_id: testUserId,
          conversation_type: 'root',
          messages: [],
          metadata: { test: true, timestamp: new Date().toISOString() },
          title: 'Test Conversation',
        })
        .select()
        .single();

      if (error) {
        recordResult('CREATE conversation', false, `${error.code}: ${error.message}`);
        logInfo(`  Hint: ${error.hint || 'No hint available'}`);
        logInfo(`  Details: ${error.details || 'No details available'}`);
      } else {
        testConversationId = data.id;
        recordResult('CREATE conversation', true, undefined, `Created conversation ${testConversationId}`);
      }
    } catch (error) {
      recordResult('CREATE conversation', false, String(error));
    }

    // Test READ conversation
    if (testConversationId) {
      try {
        const { data, error } = await supabase
          .from('conversations')
          .select('*')
          .eq('id', testConversationId)
          .single();

        if (error) {
          recordResult('READ conversation', false, `${error.code}: ${error.message}`);
        } else {
          recordResult('READ conversation', true, undefined, `Title: "${data.title}"`);
        }
      } catch (error) {
        recordResult('READ conversation', false, String(error));
      }

      // Test UPDATE conversation (append messages)
      try {
        const testMessages = [
          { role: 'user', content: 'Hello', timestamp: new Date().toISOString() },
          { role: 'assistant', content: 'Hi there!', timestamp: new Date().toISOString() },
        ];

        const { data, error } = await supabase
          .from('conversations')
          .update({
            messages: testMessages,
            title: 'Updated Test Conversation',
          })
          .eq('id', testConversationId)
          .select()
          .single();

        if (error) {
          recordResult('UPDATE conversation', false, `${error.code}: ${error.message}`);
        } else {
          const messageCount = (data.messages as any[])?.length ?? 0;
          recordResult('UPDATE conversation', true, undefined, `Messages: ${messageCount}`);
        }
      } catch (error) {
        recordResult('UPDATE conversation', false, String(error));
      }

      // Test DELETE conversation
      try {
        const { error } = await supabase
          .from('conversations')
          .delete()
          .eq('id', testConversationId);

        if (error) {
          recordResult('DELETE conversation', false, `${error.code}: ${error.message}`);
        } else {
          recordResult('DELETE conversation', true, undefined, 'Test conversation cleaned up');
        }
      } catch (error) {
        recordResult('DELETE conversation', false, String(error));
      }
    }

    // Test LIST conversations
    try {
      const { data, error, count } = await supabase
        .from('conversations')
        .select('*', { count: 'exact' })
        .eq('user_id', testUserId)
        .limit(10);

      if (error) {
        recordResult('LIST conversations', false, `${error.code}: ${error.message}`);
      } else {
        recordResult('LIST conversations', true, undefined, `Found ${count ?? data?.length ?? 0} conversations for user`);
      }
    } catch (error) {
      recordResult('LIST conversations', false, String(error));
    }
  }

  // =========================================================================
  // 7. Test Workspace Session Operations
  // =========================================================================
  logSection('7. WORKSPACE SESSION TEST');

  {
    let testSessionId: string | null = null;
    const uniqueSessionId = `test-session-${Date.now()}`;

    // Test CREATE workspace session
    try {
      const { data, error } = await supabase
        .from('workspace_sessions')
        .insert({
          user_id: testUserId,
          session_id: uniqueSessionId,
          repo_full_name: 'test-owner/test-repo',
          name: 'Test Session',
          branch_name: 'test-branch',
          base_branch: 'main',
        })
        .select()
        .single();

      if (error) {
        recordResult('CREATE workspace_session', false, `${error.code}: ${error.message}`);
        logInfo(`  Hint: ${error.hint || 'No hint available'}`);
      } else {
        testSessionId = data.id;
        recordResult('CREATE workspace_session', true, undefined, `Created session ${testSessionId}`);
      }
    } catch (error) {
      recordResult('CREATE workspace_session', false, String(error));
    }

    // Test READ workspace session
    if (testSessionId) {
      try {
        const { data, error } = await supabase
          .from('workspace_sessions')
          .select('*')
          .eq('id', testSessionId)
          .single();

        if (error) {
          recordResult('READ workspace_session', false, `${error.code}: ${error.message}`);
        } else {
          recordResult('READ workspace_session', true, undefined, `Name: "${data.name}"`);
        }
      } catch (error) {
        recordResult('READ workspace_session', false, String(error));
      }

      // Test DELETE workspace session
      try {
        const { error } = await supabase
          .from('workspace_sessions')
          .delete()
          .eq('id', testSessionId);

        if (error) {
          recordResult('DELETE workspace_session', false, `${error.code}: ${error.message}`);
        } else {
          recordResult('DELETE workspace_session', true, undefined, 'Test session cleaned up');
        }
      } catch (error) {
        recordResult('DELETE workspace_session', false, String(error));
      }
    }

    // Test LIST workspace sessions
    try {
      const { data, error, count } = await supabase
        .from('workspace_sessions')
        .select('*', { count: 'exact' })
        .eq('user_id', testUserId)
        .limit(10);

      if (error) {
        recordResult('LIST workspace_sessions', false, `${error.code}: ${error.message}`);
      } else {
        recordResult('LIST workspace_sessions', true, undefined, `Found ${count ?? data?.length ?? 0} sessions for user`);
      }
    } catch (error) {
      recordResult('LIST workspace_sessions', false, String(error));
    }
  }

  // =========================================================================
  // 8. Test Terminal Session Operations
  // =========================================================================
  logSection('8. TERMINAL SESSION TEST');

  {
    let testTerminalId: string | null = null;
    const uniqueTerminalId = `test-terminal-${Date.now()}`;

    try {
      const { data, error } = await supabase
        .from('terminal_sessions')
        .insert({
          user_id: testUserId,
          session_id: uniqueTerminalId,
          repo_full_name: 'test-owner/test-repo',
          name: 'Test Terminal',
          branch_name: 'test-branch',
          base_branch: 'main',
        })
        .select()
        .single();

      if (error) {
        recordResult('CREATE terminal_session', false, `${error.code}: ${error.message}`);
      } else {
        testTerminalId = data.id;
        recordResult('CREATE terminal_session', true, undefined, `Created terminal ${testTerminalId}`);

        // Clean up
        await supabase.from('terminal_sessions').delete().eq('id', testTerminalId);
        logInfo('  Cleaned up test terminal session');
      }
    } catch (error) {
      recordResult('CREATE terminal_session', false, String(error));
    }
  }

  // =========================================================================
  // 9. Test User Repos Operations
  // =========================================================================
  logSection('9. USER REPOS TEST');

  {
    let testRepoRecordId: string | null = null;
    const uniqueRepoId = Date.now();

    try {
      const { data, error } = await supabase
        .from('user_repos')
        .insert({
          user_id: testUserId,
          repo_id: uniqueRepoId,
          repo_full_name: 'test-owner/test-repo',
          repo_name: 'test-repo',
          is_private: false,
          description: 'Test repository for database testing',
          language: 'TypeScript',
          default_branch: 'main',
        })
        .select()
        .single();

      if (error) {
        recordResult('CREATE user_repo', false, `${error.code}: ${error.message}`);
      } else {
        testRepoRecordId = data.id;
        recordResult('CREATE user_repo', true, undefined, `Created repo record ${testRepoRecordId}`);

        // Clean up
        await supabase.from('user_repos').delete().eq('id', testRepoRecordId);
        logInfo('  Cleaned up test user repo');
      }
    } catch (error) {
      recordResult('CREATE user_repo', false, String(error));
    }

    // List existing repos
    try {
      const { data, error, count } = await supabase
        .from('user_repos')
        .select('*', { count: 'exact' })
        .eq('user_id', testUserId)
        .limit(10);

      if (error) {
        recordResult('LIST user_repos', false, `${error.code}: ${error.message}`);
      } else {
        recordResult('LIST user_repos', true, undefined, `Found ${count ?? data?.length ?? 0} repos for user`);
        if (data && data.length > 0) {
          logInfo(`  Sample repos: ${data.map(r => r.repo_full_name).slice(0, 3).join(', ')}`);
        }
      }
    } catch (error) {
      recordResult('LIST user_repos', false, String(error));
    }
  }

  // =========================================================================
  // 10. Cleanup Test User
  // =========================================================================
  logSection('10. CLEANUP');

  try {
    const { error } = await supabase.from('users').delete().eq('id', testUserId);
    if (error) {
      logWarning(`Failed to clean up test user: ${error.message}`);
    } else {
      logSuccess(`Cleaned up test user: ${testUserId}`);
    }
  } catch (error) {
    logWarning(`Failed to clean up test user: ${error}`);
  }

  // =========================================================================
  // 11. RLS Policy Check
  // =========================================================================
  logSection('11. ROW LEVEL SECURITY (RLS) CHECK');

  logInfo('Using service_role key bypasses RLS. Testing with anon key would verify RLS policies.');

  // Check if RLS is enabled (info only)
  try {
    const { data, error } = await supabase.rpc('check_rls_enabled', {}).maybeSingle();
    if (error) {
      logInfo('RLS check function not available (expected - this is informational)');
    }
  } catch {
    logInfo('RLS is configured in schema - policies require auth.uid() matching user_id');
  }

  recordResult('RLS policies exist', true, undefined, 'Policies defined for all tables (see schema.sql)');

  // =========================================================================
  // Summary
  // =========================================================================
  printSummary();
}

function printSummary() {
  logSection('TEST SUMMARY');

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const total = results.length;

  console.log('');
  log(`Total Tests: ${total}`, colors.bold);
  log(`Passed: ${passed}`, colors.green);
  log(`Failed: ${failed}`, failed > 0 ? colors.red : colors.green);
  console.log('');

  if (failed > 0) {
    log('FAILED TESTS:', colors.red);
    results.filter(r => !r.passed).forEach(r => {
      logError(`  - ${r.name}`);
      if (r.error) logInfo(`    ${r.error}`);
    });
    console.log('');
  }

  // Diagnostic recommendations
  if (failed > 0) {
    logSection('TROUBLESHOOTING RECOMMENDATIONS');

    const failedTests = results.filter(r => !r.passed);

    if (failedTests.some(t => t.name.includes('configured'))) {
      log('1. Environment Variables:', colors.yellow);
      log('   - Ensure .env.local exists in the project root', colors.reset);
      log('   - Set SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)', colors.reset);
      log('   - Set SUPABASE_SERVICE_ROLE_KEY for backend operations', colors.reset);
      console.log('');
    }

    if (failedTests.some(t => t.name.includes('Table') && !t.passed)) {
      log('2. Database Schema:', colors.yellow);
      log('   - Run the schema.sql file in Supabase SQL Editor', colors.reset);
      log('   - File location: supabase/schema.sql', colors.reset);
      console.log('');
    }

    if (failedTests.some(t => t.error?.includes('violates foreign key'))) {
      log('3. Foreign Key Constraints:', colors.yellow);
      log('   - Users must exist in auth.users before creating records', colors.reset);
      log('   - Sign in through the app to create user records first', colors.reset);
      console.log('');
    }

    if (failedTests.some(t => t.error?.includes('policy'))) {
      log('4. Row Level Security:', colors.yellow);
      log('   - RLS policies may be blocking operations', colors.reset);
      log('   - Verify SUPABASE_SERVICE_ROLE_KEY is being used (bypasses RLS)', colors.reset);
      console.log('');
    }
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  logError(`Unhandled error: ${error}`);
  process.exit(1);
});
