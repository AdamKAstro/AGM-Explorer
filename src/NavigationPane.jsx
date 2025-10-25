// NavigationPane.jsx - Updated with formatting enhancement
import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { InfoModal } from './InfoModal';

// Helper function to format item names from database
const formatItemName = (name) => {
  if (!name) return '';
  
  // Special cases for acronyms that should stay uppercase
  const acronyms = ['6g', '5g', '4g', '3g', 'iot', 'bci', 'ai', 'ml', 'api', 'sdk', 'led', 'oled', 'rfid', 'gps', 'uv', 'ir', 'emf', 'rf', 'dc', 'ac'];
  const lowerName = name.toLowerCase();
  
  // Check if entire name is an acronym
  if (acronyms.includes(lowerName)) {
    return name.toUpperCase();
  }
  
  // Handle underscores and format to title case
  let formatted = name
    .replace(/_/g, ' ')  // Replace underscores with spaces
    .replace(/-/g, ' ')  // Replace hyphens with spaces  
    .split(' ')
    .map(word => {
      // Check each word for acronyms
      if (acronyms.includes(word.toLowerCase())) {
        return word.toUpperCase();
      }
      
      // Keep certain words lowercase (unless at start)
      const lowercaseWords = ['and', 'of', 'the', 'in', 'for', 'with', 'to', 'a', 'an'];
      if (lowercaseWords.includes(word.toLowerCase()) && formatted.indexOf(word) !== 0) {
        return word.toLowerCase();
      }
      
      // Title case for regular words
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
  
  // Special formatting for known categories (your specific database terms)
  const specialCases = {
    'antimicrobial coatings': 'Antimicrobial Coatings',
    'carbon capture utilization': 'Carbon Capture & Utilization',
    'consumer goods': 'Consumer Goods', 
    'industrial manufacturing': 'Industrial Manufacturing',
    'membrane separations': 'Membrane Separations',
    'smart materials': 'Smart Materials',
    'host guest systems': 'Host-Guest Systems',
    'self healing': 'Self-Healing Materials',
    'ion selective channels': 'Ion-Selective Channels',
    'wearable diagnostics': 'Wearable Diagnostics',
    'drug delivery': 'Drug Delivery Systems',
    'building materials': 'Building Materials',
    'smart concrete': 'Smart Concrete',
    'energy storage': 'Energy Storage',
    'renewable energy': 'Renewable Energy',
    'synthetic biology': 'Synthetic Biology',
    'aerospace defense': 'Aerospace & Defense',
    'barrier additive': 'Barrier Additives',
    'electrical additive': 'Electrical Additives',
    'additive manufacturing': 'Additive Manufacturing',
    'biotech': 'Biotechnology',
    'specialty': 'Specialty Applications',
    'niche': 'Niche Markets',
    'separations': 'Separation Technologies',
    'switches': 'Molecular Switches',
    'actuators': 'Smart Actuators',
    'sustainable': 'Sustainable Textiles',
    'composites': 'Composite Materials',
    'concrete': 'Concrete Enhancement',
    'implants': 'Medical Implants',
    'hydrogen': 'Hydrogen Technology',
    'filtration': 'Filtration Systems',
    'environmental': 'Environmental Solutions',
    'electronics': 'Electronics & Semiconductors',
    'construction': 'Construction & Infrastructure',
    'automotive': 'Automotive Industry',
    'agriculture': 'Agriculture & AgTech',
    'antennas': 'Antenna Systems',
    'acoustics': 'Acoustic Materials',
    'dampening': 'Vibration Dampening',
    'metamaterials': 'Acoustic Metamaterials',
    'catalysis': 'Catalytic Systems',
    'defense': 'Defense Applications',
    'marine': 'Marine Applications',
    'medical': 'Medical & Healthcare',
    'quantum': 'Quantum Technologies',
    'textiles': 'Advanced Textiles',
  };
  
  const formattedLower = formatted.toLowerCase();
  if (specialCases[formattedLower]) {
    return specialCases[formattedLower];
  }
  
  // Final cleanup - fix "And" to "&" for certain terms
  formatted = formatted
    .replace(' And ', ' & ')
    .replace(' and ', ' & ');
  
  return formatted;
};

// Helper function to build a tree from a flat list, sorted alphabetically
const buildTree = (list, parentId = null) => {
  if (!list) return [];
  const children = list.filter(item => item.parent_id === parentId);
  // Sort children alphabetically by formatted name for consistent display
  children.sort((a, b) => formatItemName(a.name).localeCompare(formatItemName(b.name)));
  return children.map(child => ({
    ...child,
    children: buildTree(list, child.id),
  }));
};

// Recursive component to render the tree items
const TreeItem = ({ item, onFilterChange, currentFilter, type }) => {
  const [isOpen, setIsOpen] = useState(false);
  const filterId = { type, id: item.id };
  const isActive = currentFilter && currentFilter.id === item.id && currentFilter.type === type;
  
  // Format the name for display
  const displayName = formatItemName(item.name);
  const itemTooltip = `Click to filter and show ${item.application_count} app(s) linked to "${displayName}".`;

  // Determine if this item or any of its descendants is the active filter
  const containsActiveFilter = (node, filter) => {
    if (!filter || !filter.id) return false;
    if (filter.id === node.id && filter.type === type) {
      return true;
    }
    return node.children.some(child => containsActiveFilter(child, filter));
  };

  // Automatically open parent nodes if a child (or the node itself) is selected
  useEffect(() => {
    if (containsActiveFilter(item, currentFilter)) {
      setIsOpen(true);
    }
  }, [currentFilter, item, type]);

  return (
    <div className="tree-item" data-level={item.level}>
      <div
        className={`tree-label ${isActive ? 'active' : ''}`}
        onClick={() => onFilterChange(filterId)}
        title={itemTooltip}
        data-original-name={item.name}
        data-display-name={displayName}
      >
        {/* Formatted Item Name and Count */}
        <span className="tree-label-text">
          {displayName} <span className="app-count">({item.application_count ?? 0})</span>
        </span>

        {/* Expand/Collapse Arrow */}
        {item.children && item.children.length > 0 && (
          <span
            onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
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
  const [showInfoModal, setShowInfoModal] = useState(false);

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
        setMarketTree([]);
      } else {
        setMarketTree(buildTree(markets || []));
      }

      // 2. Fetch Ontology (Technical Functions)
      const { data: tags, error: tagError } = await supabase.rpc(
        'get_hierarchical_tree_with_counts',
        { table_name: 'ontology_tags' }
      );
      if (tagError) {
        console.error('Error fetching ontology tags:', tagError);
        setOntologyTree([]);
      } else {
        setOntologyTree(buildTree(tags || []));
      }
    };
    fetchTrees();
  }, []);

  // Debounce search input to avoid excessive updates
  useEffect(() => {
    const handler = setTimeout(() => {
      onSearchChange(searchText);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchText, onSearchChange]);

  // Handler to clear search text and any active filters
  const clearFilters = () => {
    setSearchText('');
    onSearchChange('');
    onFilterChange({ type: null, id: null });
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
        <li><strong>🗺️ Gap Analysis:</strong> Find <strong>new IP ventures</strong> by spotting technical functions we haven't yet applied to valuable markets ($0.10 graphene → $10 product!).</li>
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
        type="search"
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
      </h3>
      {marketTree.length > 0 ? marketTree.map(item => (
        <TreeItem
          key={'market-' + item.id}
          item={item}
          onFilterChange={onFilterChange}
          currentFilter={currentFilter}
          type="market"
        />
      )) : <p className="loading-or-empty">Loading markets...</p>}

      {/* Technical Function Tree */}
      <h3
        className="nav-header"
        style={{ marginTop: '20px' }}
        title="Filter by core material science or engineering function."
      >
        By Technical Function 🔬
        <span className="info-icon" onClick={() => setShowInfoModal(true)} title="What is this?">
          ℹ
        </span>
      </h3>
      {ontologyTree.length > 0 ? ontologyTree.map(item => (
        <TreeItem
          key={'ontology-' + item.id}
          item={item}
          onFilterChange={onFilterChange}
          currentFilter={currentFilter}
          type="ontology"
        />
      )) : <p className="loading-or-empty">Loading functions...</p>}

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