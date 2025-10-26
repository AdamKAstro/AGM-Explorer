// src/TreeLinker.jsx
import React, { useState } from 'react';
//import './Navigation.css'; // We re-use the same CSS!
import { supabase } from './supabase'; //
// A recursive component to render the tree with checkboxes
const TreeItem = ({ item, selectedIds, onToggle }) => {
  const [isOpen, setIsOpen] = useState(false);
  const isSelected = selectedIds.has(item.id);

  return (
    <div className="tree-item">
      <div className="tree-label">
        {item.children.length > 0 && (
          <span
            onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
            className="toggle"
          >
            {isOpen ? '▼' : '►'}
          </span>
        )}
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggle(item.id)}
          style={{ marginRight: '8px' }}
        />
        <span onClick={() => onToggle(item.id)} style={{ cursor: 'pointer' }}>
          {item.name} ({item.application_count})
        </span>
      </div>
      {isOpen && item.children.length > 0 && (
        <div className="tree-children">
          {item.children.map(child => (
            <TreeItem
              key={child.id}
              item={child}
              selectedIds={selectedIds}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// A helper function to build a tree from a flat list
const buildTree = (list, parentId = null) => {
  const children = list.filter(item => item.parent_id === parentId);
  return children.map(child => ({
    ...child,
    children: buildTree(list, child.id),
  }));
};

// Main component that fetches and renders the tree
export const TreeLinker = ({ title, rpcName, onSelectionChange }) => {
  const [treeData, setTreeData] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Fetch the tree data on mount
  React.useEffect(() => {
    const fetchTree = async () => {
      const { data, error } = await supabase.rpc(
        'get_hierarchical_tree_with_counts',
        { table_name: rpcName }
      );
      if (error) console.error(`Error fetching ${rpcName}:`, error);
      else setTreeData(buildTree(data));
    };
    fetchTree();
  }, [rpcName]);

  const handleToggle = (id) => {
    const newSelection = new Set(selectedIds);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedIds(newSelection);
    // Call the parent form with an array of IDs
    onSelectionChange(Array.from(newSelection));
  };

  return (
    <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid #ccc', padding: '10px', background: '#f9f9f9' }}>
      <h4 style={{ marginTop: 0, borderBottom: '1px solid #eee', paddingBottom: '5px' }}>{title}</h4>
      {treeData.map(item => (
        <TreeItem
          key={item.id}
          item={item}
          selectedIds={selectedIds}
          onToggle={handleToggle}
        />
      ))}
    </div>
  );
};