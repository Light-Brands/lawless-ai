'use client';

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

interface Table {
  table_name: string;
  table_schema: string;
}

interface TableBrowserProps {
  tableData: TableData | null;
  loading: boolean;
  selectedTable: Table | null;
  onEditRow: (row: Record<string, any>) => void;
  onDeleteRow: (filter: Record<string, any>) => void;
  onAddRow: () => void;
  onAddColumn: () => void;
  onPageChange: (offset: number) => void;
}

const EditIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
);

const DeleteIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18"/>
    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
  </svg>
);

const PlusIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" x2="12" y1="5" y2="19"/>
    <line x1="5" x2="19" y1="12" y2="12"/>
  </svg>
);

const ChevronLeftIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m15 18-6-6 6-6"/>
  </svg>
);

const ChevronRightIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m9 18 6-6-6-6"/>
  </svg>
);

function formatCellValue(value: any): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function truncateValue(value: string, maxLength = 100): string {
  if (value.length > maxLength) {
    return value.substring(0, maxLength) + '...';
  }
  return value;
}

const ColumnPlusIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" x2="12" y1="5" y2="19"/>
    <line x1="5" x2="19" y1="12" y2="12"/>
  </svg>
);

export default function TableBrowser({
  tableData,
  loading,
  selectedTable,
  onEditRow,
  onDeleteRow,
  onAddRow,
  onAddColumn,
  onPageChange,
}: TableBrowserProps) {
  if (loading) {
    return (
      <div className="table-browser-loading">
        <div className="table-browser-spinner"></div>
        <span>Loading data...</span>
      </div>
    );
  }

  if (!selectedTable) {
    return (
      <div className="table-browser-empty">
        <span>Select a table to view data</span>
      </div>
    );
  }

  if (!tableData || !tableData.rows.length) {
    return (
      <div className="table-browser-empty">
        <span>No data in {selectedTable.table_name}</span>
        <button onClick={onAddRow} className="table-browser-add-btn">
          <PlusIcon />
          <span>Add Row</span>
        </button>
      </div>
    );
  }

  const { table, rows, pagination } = tableData;
  const currentPage = Math.floor(pagination.offset / pagination.limit) + 1;
  const totalPages = Math.ceil(pagination.total / pagination.limit);

  return (
    <div className="table-browser">
      <div className="table-browser-header">
        <div className="table-browser-info">
          <h2>{table.name}</h2>
          <span className="table-browser-count">{pagination.total} rows</span>
        </div>
        <button onClick={onAddRow} className="table-browser-add-btn">
          <PlusIcon />
          <span>Add Row</span>
        </button>
      </div>

      <div className="table-browser-content">
        <div className="table-browser-scroll">
          <table className="table-browser-table">
            <thead>
              <tr>
                {table.columns.map((column) => (
                  <th key={column.name}>
                    <span className="column-name">{column.name}</span>
                    <span className="column-type">{column.type}</span>
                  </th>
                ))}
                <th className="add-column-header">
                  <button
                    onClick={onAddColumn}
                    className="add-column-btn"
                    title="Add Column"
                  >
                    <ColumnPlusIcon />
                  </button>
                </th>
                <th className="actions-column">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => {
                const rowKey = row.id || row[table.columns[0]?.name] || rowIndex;
                const filterKey = table.columns[0]?.name || 'id';
                const filterValue = row[filterKey];

                return (
                  <tr key={rowKey}>
                    {table.columns.map((column) => (
                      <td key={column.name}>
                        <span
                          className={`cell-value ${row[column.name] === null ? 'null-value' : ''}`}
                          title={formatCellValue(row[column.name])}
                        >
                          {truncateValue(formatCellValue(row[column.name]))}
                        </span>
                      </td>
                    ))}
                    <td className="add-column-spacer"></td>
                    <td className="actions-column">
                      <div className="row-actions">
                        <button
                          onClick={() => onEditRow(row)}
                          className="row-action-btn edit"
                          title="Edit"
                        >
                          <EditIcon />
                        </button>
                        <button
                          onClick={() => onDeleteRow({ [filterKey]: filterValue })}
                          className="row-action-btn delete"
                          title="Delete"
                        >
                          <DeleteIcon />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="table-browser-pagination">
          <button
            onClick={() => onPageChange(Math.max(0, pagination.offset - pagination.limit))}
            disabled={pagination.offset === 0}
            className="pagination-btn"
          >
            <ChevronLeftIcon />
          </button>
          <span className="pagination-info">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => onPageChange(pagination.offset + pagination.limit)}
            disabled={pagination.offset + pagination.limit >= pagination.total}
            className="pagination-btn"
          >
            <ChevronRightIcon />
          </button>
        </div>
      )}
    </div>
  );
}
