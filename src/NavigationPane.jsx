// src/NavigationPane.jsx
import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { InfoModal } from './InfoModal'; // Ensure InfoModal.jsx exists
import './Navigation.css'; // Ensure Navigation.css exists and includes hierarchy styles

// Helper function to build a tree from a flat list, sorted alphabetically
const buildTree = (list, parentId = null) => {
  if (!list) return []; // Guard against null list
  const children = list.filter(item => item.parent_id === parentId);
  // Sort children alphabetically by name for consistent display
  children.sort((a, b) => a.name.localeCompare(b.name));
  return children.map(child => ({
    ...child,
    children: buildTree(list, child.id),
  }));
};

// Recursive component to render the tree items
const TreeItem = ({ item, onFilterChange, currentFilter, type }) => {
  const [isOpen, setIsOpen] = useState(false);
  const filterId = { type, id: item.id };
  // Check if this specific item is the active filter
  const isActive = currentFilter && currentFilter.id === item.id && currentFilter.type === type;

  const itemTooltip = `Click to filter and show ${item.application_count} app(s) linked to "${item.name}".`;

  // Determine if this item or any of its descendants is the active filter
  const containsActiveFilter = (node, filter) => {
    if (!filter || !filter.id) return false; // No active filter
    if (filter.id === node.id && filter.type === type) {
      return true;
    }
    // Recursively check children
    return node.children.some(child => containsActiveFilter(child, filter));
  };

  // Automatically open parent nodes if a child (or the node itself) is selected
  useEffect(() => {
    if (containsActiveFilter(item, currentFilter)) {
      setIsOpen(true);
    }
    // Optional: Close if the filter changes and no longer includes this branch
    // else { setIsOpen(false); }
  }, [currentFilter, item, type]); // Rerun when filter or item changes

  return (
    // Add data-level for CSS styling (e.g., uppercase parents)
    <div className="tree-item" data-level={item.level}>
      <div
        className={`tree-label ${isActive ? 'active' : ''}`}
        onClick={() => onFilterChange(filterId)} // Set filter on click
        title={itemTooltip}
      >
        {/* Item Name and Count - Clickable */}
        {item.name} ({item.application_count ?? 0}) {/* Use ?? 0 as fallback */}

        {/* Expand/Collapse Arrow (now at the end) */}
        {item.children && item.children.length > 0 && (
          <span
            onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }} // Stop click from triggering filter
            className="toggle arrow-after"
            title={isOpen ? "Collapse" : "Expand"}
          >
            {isOpen ? '▼' : '►'}
          </span>
        )}
      </div>
      {/* Render children recursively if open */}
      {isOpen && item.children && item.children.length > 0 && (
        <div className="tree-children">
          {item.children.map(child => (
            <TreeItem
              key={child.id}
              item={child}
              onFilterChange={onFilterChange}
              currentFilter={currentFilter}
              type={type}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// Main Navigation Pane component
export function NavigationPane({ onSearchChange, onFilterChange, currentFilter }) {
  const [marketTree, setMarketTree] = useState([]);
  const [ontologyTree, setOntologyTree] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [showInfoModal, setShowInfoModal] = useState(false); // State for info modal

  // Fetch hierarchical data using the RPC function on component mount
  useEffect(() => {
    const fetchTrees = async () => {
      // 1. Fetch Markets
      const { data: markets, error: marketError } = await supabase.rpc(
        'get_hierarchical_tree_with_counts',
        { table_name: 'market_segments' }
      );
      if (marketError) {
          console.error('Error fetching markets:', marketError);
          setMarketTree([]); // Set empty array on error
      } else {
          setMarketTree(buildTree(markets || [])); // Ensure buildTree handles potential null data
      }


      // 2. Fetch Ontology (Technical Functions)
      const { data: tags, error: tagError } = await supabase.rpc(
        'get_hierarchical_tree_with_counts',
        { table_name: 'ontology_tags' }
      );
       if (tagError) {
           console.error('Error fetching ontology tags:', tagError);
           setOntologyTree([]); // Set empty array on error
       } else {
           setOntologyTree(buildTree(tags || [])); // Ensure buildTree handles potential null data
       }
    };
    fetchTrees();
  }, []); // Empty dependency array ensures this runs only once on mount

  // Debounce search input to avoid excessive updates
  useEffect(() => {
    const handler = setTimeout(() => {
      onSearchChange(searchText);
    }, 300); // 300ms delay before triggering search
    // Cleanup function to clear the timeout if the component unmounts or text changes again
    return () => clearTimeout(handler);
  }, [searchText, onSearchChange]);

  // Handler to clear search text and any active filters
  const clearFilters = () => {
    setSearchText(''); // Clear local search state
    onSearchChange(''); // Notify parent (App.jsx)
    onFilterChange({ type: null, id: null }); // Notify parent to clear filters
  };

  // Content for the Technical Functions Info Modal
  const ontologyInfoContent = (
    <>
      <p>
        This list organizes our IP ventures based on the <strong>core material science</strong> or <strong>engineering principle</strong> involved (e.g., making something conductive, strong, heat-resistant). It's our map of AGM's technical capabilities.
      </p>
      <h4>Why This View Matters (Kevin's IP Strategy):</h4>
      <ul>
        <li><strong>💡 IP Focus:</strong> See where our unique 'fractal turbostratic' properties create <strong>clusters</strong> of patentable ideas.</li>
        <li><strong>🗺️ Gap Analysis:</strong> Find <strong>new IP ventures</strong> by spotting technical functions we haven't yet applied to valuable markets ($0.10 graphene -&gt; $10 product!).</li>
        <li><strong>⏳ Efficiency:</strong> Avoid reinventing the wheel by seeing similar technical solutions already explored, even in different markets.</li>
        <li><strong>✨ Understand the "Secret Sauce":</strong> Helps grasp *why* our specific graphene is special for certain applications (links to the 'Strategic Synergy' score).</li>
      </ul>
    </>
  );

  return (
    <div style={{ padding: '15px' }}>
      {/* Search Input */}
      <input
        id="smart-search-input"
        type="search" // Use type="search" for potential browser optimizations/styling
        value={searchText}
        placeholder="Search applications..."
        title="Smart Search: Instantly searches application Names and Descriptions. Results are combined with any active filter below."
        onChange={(e) => setSearchText(e.target.value)}
        style={{ width: '100%', padding: '10px', boxSizing: 'border-box', marginBottom: '15px', borderRadius: '4px', border: '1px solid #ccc' }}
      />
      {/* Clear Filters Button */}
      <button
        onClick={clearFilters}
        style={{ width: '100%', padding: '8px', marginBottom: '20px', cursor: 'pointer', background: '#6c757d', color: 'white', border: 'none', borderRadius: '4px' }}
        title="Clear search text and all filters"
      >
        Clear All Filters
      </button>

      {/* Market Segment Tree */}
      <h3
        className="nav-header"
        title="Filter by high-level market data."
      >
        By Market Segment 🗺️
        {/* Optional: Add Info Icon for Markets here */}
      </h3>
      {marketTree.length > 0 ? marketTree.map(item => (
        <TreeItem
          key={'market-' + item.id} // Add prefix for potential key conflicts
          item={item}
          onFilterChange={onFilterChange}
          currentFilter={currentFilter}
          type="market"
        />
      )) : <p className="loading-or-empty">Loading markets...</p>} {/* Show loading/empty state */}

      {/* Technical Function Tree */}
      <h3
        className="nav-header"
        style={{ marginTop: '20px' }}
        title="Filter by core material science or engineering function."
      >
        By Technical Function 🔬
        {/* Info Icon to open the modal */}
        <span className="info-icon" onClick={() => setShowInfoModal(true)} title="What is this?">
          &#8505; {/* Unicode Information Source symbol */}
        </span>
      </h3>
       {ontologyTree.length > 0 ? ontologyTree.map(item => (
         <TreeItem
           key={'ontology-' + item.id} // Add prefix
           item={item}
           onFilterChange={onFilterChange}
           currentFilter={currentFilter}
           type="ontology"
         />
       )) : <p className="loading-or-empty">Loading functions...</p>} {/* Show loading/empty state */}


      {/* Render the Info Modal when showInfoModal is true */}
      {showInfoModal && (
        <InfoModal
          title="Understanding Technical Functions"
          content={ontologyInfoContent}
          onClose={() => setShowInfoModal(false)}
        />
      )}
    </div>
  );
}