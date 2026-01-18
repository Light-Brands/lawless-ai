'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import TableTree from './components/TableTree';
import TableBrowser from './components/TableBrowser';
import SQLEditor from './components/SQLEditor';
import RowEditor from './components/RowEditor';
import '../integrations.css';

interface User {
  login: string;
  name: string;
  avatar: string;
}

interface Project {
  id: string;
  ref: string;
  name: string;
  url?: string;
}

interface Table {
  name: string;
  schema: string;
}

interface Column {
  name: string;
  type: string;
}

interface TableData {
  table: {
    name: string;
    columns: Column[];
    rowCount: number;
  };
  rows: Record<string, any>[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
  };
}

const LightningIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
  </svg>
);

const BackIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m12 19-7-7 7-7"/>
    <path d="M19 12H5"/>
  </svg>
);

const HomeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
    <polyline points="9 22 9 12 15 12 15 22"/>
  </svg>
);

const LogoutIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
    <polyline points="16 17 21 12 16 7"/>
    <line x1="21" x2="9" y1="12" y2="12"/>
  </svg>
);

const RefreshIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
    <path d="M3 3v5h5"/>
    <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/>
    <path d="M16 16h5v5"/>
  </svg>
);

const SQLIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m18 16 4-4-4-4"/>
    <path d="m6 8-4 4 4 4"/>
    <path d="m14.5 4-5 16"/>
  </svg>
);

export default function SupabasePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [tableData, setTableData] = useState<TableData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tablesLoading, setTablesLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSQLEditor, setShowSQLEditor] = useState(false);
  const [showRowEditor, setShowRowEditor] = useState(false);
  const [editingRow, setEditingRow] = useState<Record<string, any> | null>(null);

  useEffect(() => {
    checkAuthAndLoadData();
  }, []);

  async function checkAuthAndLoadData() {
    try {
      const authRes = await fetch('/api/auth/status');
      const authData = await authRes.json();

      if (!authData.authenticated) {
        router.push('/');
        return;
      }

      setUser(authData.user);

      if (!authData.supabase?.connected) {
        router.push('/integrations');
        return;
      }

      // Load projects
      const projectsRes = await fetch('/api/integrations/supabase/projects');
      const projectsData = await projectsRes.json();

      if (projectsData.error) {
        setError(projectsData.error);
        return;
      }

      setProjects(projectsData.projects || []);

      // Select first project by default
      if (projectsData.projects?.length > 0) {
        setSelectedProject(projectsData.projects[0]);
        await loadTables(projectsData.projects[0].ref);
      }
    } catch (err) {
      setError('Failed to load Supabase data');
    } finally {
      setLoading(false);
    }
  }

  async function loadTables(projectRef: string) {
    setTablesLoading(true);
    try {
      const res = await fetch(`/api/integrations/supabase/projects/${projectRef}/tables`);
      const data = await res.json();

      if (data.error) {
        setError(data.error);
        return;
      }

      setTables(data.tables || []);
    } catch (err) {
      setError('Failed to load tables');
    } finally {
      setTablesLoading(false);
    }
  }

  async function loadTableData(tableName: string, offset = 0) {
    if (!selectedProject) return;

    setDataLoading(true);
    try {
      const res = await fetch(
        `/api/integrations/supabase/projects/${selectedProject.ref}/tables/${tableName}?limit=50&offset=${offset}`
      );
      const data = await res.json();

      if (data.error) {
        setError(data.error);
        return;
      }

      setTableData(data);
    } catch (err) {
      setError('Failed to load table data');
    } finally {
      setDataLoading(false);
    }
  }

  const handleSelectProject = useCallback(async (project: Project) => {
    setSelectedProject(project);
    setSelectedTable(null);
    setTableData(null);
    await loadTables(project.ref);
  }, []);

  const handleSelectTable = useCallback(async (table: Table) => {
    setSelectedTable(table);
    await loadTableData(table.name);
  }, [selectedProject]);

  const handleInsertRow = useCallback(async (row: Record<string, any>) => {
    if (!selectedProject || !selectedTable) return;

    try {
      const res = await fetch(
        `/api/integrations/supabase/projects/${selectedProject.ref}/tables/${selectedTable.name}/rows`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(row),
        }
      );

      const data = await res.json();

      if (data.error) {
        throw new Error(data.error);
      }

      setShowRowEditor(false);
      await loadTableData(selectedTable.name);
    } catch (err) {
      throw err;
    }
  }, [selectedProject, selectedTable]);

  const handleUpdateRow = useCallback(async (row: Record<string, any>, filter: Record<string, any>) => {
    if (!selectedProject || !selectedTable) return;

    try {
      const res = await fetch(
        `/api/integrations/supabase/projects/${selectedProject.ref}/tables/${selectedTable.name}/rows`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: row, filter }),
        }
      );

      const data = await res.json();

      if (data.error) {
        throw new Error(data.error);
      }

      setShowRowEditor(false);
      setEditingRow(null);
      await loadTableData(selectedTable.name);
    } catch (err) {
      throw err;
    }
  }, [selectedProject, selectedTable]);

  const handleDeleteRow = useCallback(async (filter: Record<string, any>) => {
    if (!selectedProject || !selectedTable) return;

    if (!confirm('Are you sure you want to delete this row?')) return;

    try {
      const res = await fetch(
        `/api/integrations/supabase/projects/${selectedProject.ref}/tables/${selectedTable.name}/rows`,
        {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filter }),
        }
      );

      const data = await res.json();

      if (data.error) {
        alert(`Delete failed: ${data.error}`);
        return;
      }

      await loadTableData(selectedTable.name);
    } catch (err) {
      alert('Failed to delete row');
    }
  }, [selectedProject, selectedTable]);

  const handleEditRow = useCallback((row: Record<string, any>) => {
    setEditingRow(row);
    setShowRowEditor(true);
  }, []);

  const handleRefresh = useCallback(async () => {
    if (selectedTable) {
      await loadTableData(selectedTable.name);
    }
  }, [selectedTable, selectedProject]);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
  }

  if (loading) {
    return (
      <div className="supabase-page">
        <div className="supabase-loading">
          <div className="supabase-loading-spinner"></div>
          <p>Loading Supabase...</p>
        </div>
      </div>
    );
  }

  if (error && !projects.length) {
    return (
      <div className="supabase-page">
        <div className="supabase-error">
          <h2>Error</h2>
          <p>{error}</p>
          <Link href="/integrations" className="supabase-back-btn">
            Back to Integrations
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="supabase-page">
      <div className="supabase-ambient"></div>

      {/* Header */}
      <header className="supabase-header">
        <div className="supabase-header-content">
          <div className="supabase-header-left">
            <Link href="/integrations" className="supabase-back-link">
              <BackIcon />
              <span>Back</span>
            </Link>
            <div className="supabase-header-divider"></div>
            <Link href="/" className="supabase-logo">
              <div className="supabase-logo-icon">
                <LightningIcon />
              </div>
              <span className="supabase-logo-text">Lawless AI</span>
            </Link>
          </div>

          <div className="supabase-header-center">
            <div className="supabase-service-badge">
              <svg viewBox="0 0 109 113" width="16" height="16" fill="none">
                <path d="M63.7076 110.284C60.8481 113.885 55.0502 111.912 54.9813 107.314L53.9738 40.0627L99.1935 40.0627C107.384 40.0627 111.952 49.5228 106.859 55.9374L63.7076 110.284Z" fill="#3ECF8E"/>
                <path d="M45.317 2.07103C48.1765 -1.53037 53.9745 0.442937 54.0434 5.041L54.4849 72.2922H9.83113C1.64038 72.2922 -2.92775 62.8321 2.1655 56.4175L45.317 2.07103Z" fill="#3ECF8E"/>
              </svg>
              <span>Supabase</span>
            </div>
            {selectedProject && (
              <>
                <span className="supabase-project-name">{selectedProject.name}</span>
                {selectedTable && (
                  <span className="supabase-table-name">/ {selectedTable.name}</span>
                )}
              </>
            )}
          </div>

          {user && (
            <div className="supabase-header-right">
              <button
                onClick={() => setShowSQLEditor(true)}
                className="supabase-action-btn"
                title="SQL Editor"
              >
                <SQLIcon />
              </button>
              <button onClick={handleRefresh} className="supabase-action-btn" title="Refresh">
                <RefreshIcon />
              </button>
              <Link href="/" className="supabase-nav-btn">
                <HomeIcon />
              </Link>
              <div className="supabase-user">
                <img src={user.avatar} alt={user.login} className="supabase-avatar" />
              </div>
              <button onClick={handleLogout} className="supabase-logout-btn">
                <LogoutIcon />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main content */}
      <main className="supabase-main">
        <div className="supabase-content">
          {/* Tables sidebar */}
          <aside className="supabase-sidebar">
            <div className="supabase-sidebar-header">
              <span className="supabase-sidebar-title">Tables</span>
              <span className="supabase-sidebar-count">{tables.length}</span>
            </div>
            {projects.length > 1 && (
              <div className="supabase-project-select">
                <select
                  value={selectedProject?.id || ''}
                  onChange={(e) => {
                    const project = projects.find(p => p.id === e.target.value);
                    if (project) handleSelectProject(project);
                  }}
                >
                  {projects.map(project => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <TableTree
              tables={tables}
              selectedTable={selectedTable}
              loading={tablesLoading}
              onSelectTable={handleSelectTable}
            />
          </aside>

          {/* Main panel */}
          <div className="supabase-main-panel">
            <TableBrowser
              tableData={tableData}
              loading={dataLoading}
              selectedTable={selectedTable}
              onEditRow={handleEditRow}
              onDeleteRow={handleDeleteRow}
              onAddRow={() => {
                setEditingRow(null);
                setShowRowEditor(true);
              }}
              onPageChange={(offset) => loadTableData(selectedTable?.name || '', offset)}
            />
          </div>
        </div>
      </main>

      {/* SQL Editor Modal */}
      {showSQLEditor && selectedProject && (
        <SQLEditor
          projectRef={selectedProject.ref}
          onClose={() => setShowSQLEditor(false)}
        />
      )}

      {/* Row Editor Modal */}
      {showRowEditor && tableData && (
        <RowEditor
          columns={tableData.table.columns}
          row={editingRow}
          onSave={editingRow
            ? (row) => {
                // Use the first column as the filter key (usually 'id')
                const filterKey = tableData.table.columns[0]?.name || 'id';
                return handleUpdateRow(row, { [filterKey]: editingRow[filterKey] });
              }
            : handleInsertRow
          }
          onClose={() => {
            setShowRowEditor(false);
            setEditingRow(null);
          }}
        />
      )}
    </div>
  );
}
