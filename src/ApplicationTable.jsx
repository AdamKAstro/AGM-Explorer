// src/ApplicationTable.jsx
import React, { useMemo, useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  getSortedRowModel,
} from '@tanstack/react-table';
//import './Table.css'; 

// A helper to truncate text
const truncate = (str, n) => {
  return (str?.length > n) ? str.substr(0, n - 1) + '...' : str;
};

export function ApplicationTable({ data, loading, selectedAppId, onAppSelected }) {
  
  const columns = useMemo(() => [
    {
      accessorKey: 'component_name',
      header: 'Application',
      cell: info => <strong>{info.getValue()}</strong>,
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
      header: 'Score',
      cell: info => info.getValue()?.toFixed(2) || 'N/A',
      size: 80,
    },
    {
      accessorKey: 'status',
      header: 'Status',
      size: 100,
    },
  ], []);

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
      case 'name': return "The application name. Click any row to see full details and edit scoring.";
      case 'description': return "A brief description. Hover over the text to see the full description, or click the row for details.";
      case 'priority_score': return "The 'Priority Score' (0-40). This is auto-calculated based on Market Potential (40%), Feasibility (20%), Market Access (20%), and Synergy (20%). Click to sort.";
      case 'status': return "The current stage of this application idea. Click row to edit in the details pane.";
      default: return "";
    }
  };

  return (
    <div className="table-container" style={{ height: '100%', overflow: 'auto' }}>
      {loading ? (
        <div style={{ padding: '20px' }}>Loading...</div>
      ) : (
        <table>
          <thead>
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                  <th 
                    key={header.id} 
                    style={{ width: `${header.getSize()}px` }} 
                    onClick={header.column.getToggleSortingHandler()}
                    title={getHeaderTooltip(header.id)} // Tooltip added here
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {{ asc: ' 🔼', desc: ' 🔽' }[header.column.getIsSorted()] ?? null}
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
                className={row.original.id === selectedAppId ? 'selected-row' : ''}
              >
                {row.getVisibleCells().map(cell => (
                  <td key={cell.id} style={{ width: `${cell.column.getSize()}px` }}>
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