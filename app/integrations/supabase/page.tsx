'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import TableTree from './components/TableTree';
import TableBrowser from './components/TableBrowser';
import SQLEditorPanel from './components/SQLEditorPanel';
import RowEditor from './components/RowEditor';
import AddColumnModal, { ColumnDefinition } from './components/AddColumnModal';
import ConfirmationModal from '@/app/components/ConfirmationModal';
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
  table_name: string;
  table_schema: string;
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

const TrashIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18"/>
    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
  </svg>
);

function SupabasePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
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
  const [activeView, setActiveView] = useState<'tables' | 'sql'>('tables');
  const [showRowEditor, setShowRowEditor] = useState(false);
  const [editingRow, setEditingRow] = useState<Record<string, any> | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showAddColumnModal, setShowAddColumnModal] = useState(false);

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

      // Select project from URL param, or first project by default
      if (projectsData.projects?.length > 0) {
        const projectRef = searchParams.get('project');
        const targetProject = projectRef
          ? projectsData.projects.find((p: Project) => p.ref === projectRef) || projectsData.projects[0]
          : projectsData.projects[0];
        setSelectedProject(targetProject);
        await loadTables(targetProject.ref);
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
    await loadTableData(table.table_name);
  }, [selectedProject]);

  const handleInsertRow = useCallback(async (row: Record<string, any>) => {
    if (!selectedProject || !selectedTable) return;

    try {
      const res = await fetch(
        `/api/integrations/supabase/projects/${selectedProject.ref}/tables/${selectedTable.table_name}/rows`,
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
      await loadTableData(selectedTable.table_name);
    } catch (err) {
      throw err;
    }
  }, [selectedProject, selectedTable]);

  const handleUpdateRow = useCallback(async (row: Record<string, any>, filter: Record<string, any>) => {
    if (!selectedProject || !selectedTable) return;

    try {
      const res = await fetch(
        `/api/integrations/supabase/projects/${selectedProject.ref}/tables/${selectedTable.table_name}/rows`,
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
      await loadTableData(selectedTable.table_name);
    } catch (err) {
      throw err;
    }
  }, [selectedProject, selectedTable]);

  const handleDeleteRow = useCallback(async (filter: Record<string, any>) => {
    if (!selectedProject || !selectedTable) return;

    if (!confirm('Are you sure you want to delete this row?')) return;

    try {
      const res = await fetch(
        `/api/integrations/supabase/projects/${selectedProject.ref}/tables/${selectedTable.table_name}/rows`,
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

      await loadTableData(selectedTable.table_name);
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
      await loadTableData(selectedTable.table_name);
    }
  }, [selectedTable, selectedProject]);

  const handleAddColumn = useCallback(async (column: ColumnDefinition) => {
    if (!selectedProject || !selectedTable) return;

    try {
      // Build the ALTER TABLE ADD COLUMN SQL statement
      let sql = `ALTER TABLE "${selectedTable.table_schema}"."${selectedTable.table_name}" ADD COLUMN "${column.name}" ${column.type}`;

      if (!column.nullable) {
        sql += ' NOT NULL';
      }

      if (column.defaultValue) {
        sql += ` DEFAULT ${column.defaultValue}`;
      }

      const res = await fetch(
        `/api/integrations/supabase/projects/${selectedProject.ref}/sql`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: sql }),
        }
      );

      const data = await res.json();

      if (data.error) {
        alert(`Failed to add column: ${data.error}${data.hint ? `\n\nHint: ${data.hint}` : ''}`);
        return;
      }

      setShowAddColumnModal(false);
      // Reload table data to show new column
      await loadTableData(selectedTable.table_name);
      // Also reload tables list to update column info
      await loadTables(selectedProject.ref);
    } catch (err) {
      alert('Failed to add column');
    }
  }, [selectedProject, selectedTable]);

  async function handleDeleteProject() {
    if (!selectedProject) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/integrations/supabase/projects/${selectedProject.ref}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        // Remove from local state
        setProjects(prev => prev.filter(p => p.id !== selectedProject.id));

        // Select next project or clear
        const remaining = projects.filter(p => p.id !== selectedProject.id);
        if (remaining.length > 0) {
          setSelectedProject(remaining[0]);
          await loadTables(remaining[0].ref);
        } else {
          setSelectedProject(null);
          setTables([]);
          setTableData(null);
        }
      } else {
        const data = await res.json();
        alert(`Failed to delete database: ${data.error || 'Unknown error'}`);
      }
    } catch (err) {
      alert('Failed to delete database');
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  }

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
                  <span className="supabase-table-name">/ {selectedTable.table_name}</span>
                )}
              </>
            )}
          </div>

          {user && (
            <div className="supabase-header-right">
              <div className="supabase-view-tabs">
                <button
                  className={`supabase-view-tab ${activeView === 'tables' ? 'active' : ''}`}
                  onClick={() => setActiveView('tables')}
                >
                  Table Editor
                </button>
                <button
                  className={`supabase-view-tab ${activeView === 'sql' ? 'active' : ''}`}
                  onClick={() => setActiveView('sql')}
                >
                  <SQLIcon />
                  SQL Editor
                </button>
              </div>
              <div className="supabase-header-divider" />
              {activeView === 'tables' && (
                <button onClick={handleRefresh} className="supabase-action-btn" title="Refresh">
                  <RefreshIcon />
                </button>
              )}
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
        {activeView === 'tables' ? (
          <div className="supabase-content">
            {/* Tables sidebar */}
            <aside className="supabase-sidebar">
              <div className="supabase-sidebar-header">
                <span className="supabase-sidebar-title">Tables</span>
                <span className="supabase-sidebar-count">{tables.length}</span>
              </div>
              {projects.length > 0 && (
                <div className="supabase-project-select-wrapper">
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
                  <button
                    className="supabase-project-delete-btn"
                    onClick={() => setShowDeleteModal(true)}
                    title="Delete database"
                  >
                    <TrashIcon />
                  </button>
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
                onAddColumn={() => setShowAddColumnModal(true)}
                onPageChange={(offset) => loadTableData(selectedTable?.table_name || '', offset)}
              />
            </div>
          </div>
        ) : (
          <div className="supabase-sql-view">
            {selectedProject && (
              <SQLEditorPanel
                projectRef={selectedProject.ref}
                tables={tables}
              />
            )}
          </div>
        )}
      </main>

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

      {/* Delete Database Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteModal}
        title="Delete Supabase Database"
        message={`This will permanently delete the database "${selectedProject?.name}" and all its data. This action cannot be undone.`}
        confirmText={selectedProject?.name || ''}
        confirmLabel="Delete Database"
        variant="danger"
        requireTypedConfirmation={true}
        onConfirm={handleDeleteProject}
        onCancel={() => setShowDeleteModal(false)}
        isLoading={isDeleting}
      />

      {/* Add Column Modal */}
      {selectedTable && (
        <AddColumnModal
          isOpen={showAddColumnModal}
          tableName={selectedTable.table_name}
          onClose={() => setShowAddColumnModal(false)}
          onAdd={handleAddColumn}
        />
      )}
    </div>
  );
}

export default function SupabasePage() {
  return (
    <Suspense fallback={<div className="integration-page"><div className="loading">Loading...</div></div>}>
      <SupabasePageContent />
    </Suspense>
  );
}
