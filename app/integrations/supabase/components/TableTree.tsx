'use client';

interface Table {
  table_name: string;
  table_schema: string;
}

interface TableTreeProps {
  tables: Table[];
  selectedTable: Table | null;
  loading: boolean;
  onSelectTable: (table: Table) => void;
}

const TableIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3v18"/>
    <rect width="18" height="18" x="3" y="3" rx="2"/>
    <path d="M3 9h18"/>
    <path d="M3 15h18"/>
  </svg>
);

export default function TableTree({ tables, selectedTable, loading, onSelectTable }: TableTreeProps) {
  if (loading) {
    return (
      <div className="table-tree-loading">
        <div className="table-tree-spinner"></div>
        <span>Loading tables...</span>
      </div>
    );
  }

  if (!tables.length) {
    return (
      <div className="table-tree-empty">
        <span>No tables found</span>
      </div>
    );
  }

  return (
    <div className="table-tree">
      <ul className="table-tree-list">
        {tables.map((table) => (
          <li key={table.table_name}>
            <button
              className={`table-tree-item ${selectedTable?.table_name === table.table_name ? 'selected' : ''}`}
              onClick={() => onSelectTable(table)}
            >
              <TableIcon />
              <span className="table-tree-item-name">{table.table_name}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
