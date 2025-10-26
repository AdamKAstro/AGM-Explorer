// src/ApplicationTable.jsx
import React, { useMemo, useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  getSortedRowModel,
} from '@tanstack/react-table';

// A helper to truncate text
const truncate = (str, n) => {
  return (str?.length > n) ? str.substr(0, n - 1) + '...' : str;
};

// Helper to get status badge class from your CSS
const getStatusClass = (status) => {
  switch (status) {
    case 'active_r&d':
      return 'active'; // Uses .status-badge.active (green)
    case 'in_review':
    case 'proposed':
      return 'pending'; // Uses .status-badge.pending (gold)
    case 'backlog':
    case 'archived':
      return 'inactive'; // Uses .status-badge.inactive (gray)
    default:
      return '';
  }
};

export function ApplicationTable({ data, loading, selectedAppId, onAppSelected }) {
  
  const columns = useMemo(() => [
    {
      accessorKey: 'component_name',
      header: 'Application',
      cell: info => <strong>{info.getValue()}</strong>, // This is styled by CSS .data-table td:first-child
      size: 250,
    },
    {
      accessorKey: 'description',
      header: 'Description',
      cell: info => <span title={info.getValue()}>{truncate(info.getValue(), 100)}</span>,
      size: 300,
    },
    {
      accessorKey: 'priority_score',
      header: 'Score', // CSS will add sort arrow
      cell: info => {
        const score = info.getValue();
        const scoreNum = Number(score);
        // Use classes from your CSS file
        let scoreClass = 'number-cell';
        if (scoreNum > 25) scoreClass += ' high-value';
        else if (scoreNum < 15) scoreClass += ' low-value';
        
        // Match formatting in DetailPane
        return <span className={scoreClass}>{score?.toFixed(1) || 'N/A'}</span>;
      },
      size: 80,
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: info => {
        const status = info.getValue();
        // Use the .status-badge class from your CSS
        return (
          <span className={`status-badge ${getStatusClass(status)}`}>
            {/* Format status text nicely from snake_case */}
            {status ? status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'N/A'}
          </span>
        );
      },
      size: 100,
    },
  ], []);

  // Set default sort to match your original file
  const [sorting, setSorting] = useState([{ id: 'priority_score', desc: true }]);

  const table = useReactTable({
    data: data || [], 
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });
  
  // Helper for column header tooltips
  const getHeaderTooltip = (id) => {
    switch(id) {
      case 'component_name': return "The application name. Click any row to see full details.";
      case 'description': return "A brief description. Hover to see full text.";
      case 'priority_score': return "Calculated Priority Score. Click to sort.";
      case 'status': return "The current stage of this application idea. Click to sort.";
      default: return "Click to sort";
    }
  };

  // Helper function to get header classes from your CSS
  const getHeaderClasses = (header) => {
    let classes = 'sortable'; // Add .sortable class
    const sortState = header.column.getIsSorted();
    if (sortState === 'asc') {
      classes += ' sorted-asc'; // Add .sorted-asc class
    } else if (sortState === 'desc') {
      classes += ' sorted-desc'; // Add .sorted-desc class
    }
    return classes;
  };

  return (
    // Use the .table-area class from CSS, remove inline style
    <div className="table-area"> 
      {loading ? (
        // Use the .loading-or-empty class from CSS
        <div className="loading-or-empty">Loading applications...</div>
      ) : (
        // Use the .data-table class from CSS
        <table className="data-table">
          <thead>
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                  <th 
                    key={header.id} 
                    style={{ width: `${header.getSize()}px` }} // Keep explicit width
                    onClick={header.column.getToggleSortingHandler()}
                    title={getHeaderTooltip(header.id)}
                    className={getHeaderClasses(header)} // Add sortable classes
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {/* The sort arrows are now handled by your CSS file */}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map(row => (
              <tr 
                key={row.id} 
                onClick={() => onAppSelected(row.original.id)}
                // This class will be styled by our CSS addition
                className={row.original.id === selectedAppId ? 'selected-row' : ''}
              >
                {row.getVisibleCells().map(cell => (
                  <td key={cell.id} style={{ width: `${cell.column.getSize()}px` }}> {/* Keep explicit width */}
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}