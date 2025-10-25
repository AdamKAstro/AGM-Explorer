// src/DetailPane.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabase';
import { TreeLinker } from './TreeLinker'; // Import TreeLinker
// ** NOTE: Remove import for './DetailPane.css'; if you put styles in index.css **

// Reusable component for displaying/editing list-based fields
const ListEditor = ({ label, items = [], fieldName, onSave }) => {
  const [list, setList] = useState(items || []);
  const [newItem, setNewItem] = useState('');

  // Update local state if props change externally
  useEffect(() => {
    setList(items || []);
  }, [items]);

  const handleAddItem = () => {
    if (newItem.trim()) {
      const updatedList = [...list, newItem.trim()];
      setList(updatedList);
      onSave(fieldName, updatedList); // Save immediately
      setNewItem('');
    }
  };

  const handleRemoveItem = (indexToRemove) => {
    const updatedList = list.filter((_, index) => index !== indexToRemove);
    setList(updatedList);
    onSave(fieldName, updatedList); // Save immediately
  };

  return (
    <div className="form-group list-editor">
      <label>{label}</label>
      <ul className="item-list">
        {list.map((item, index) => (
          <li key={index}>
            {item}
            <button onClick={() => handleRemoveItem(index)} title="Remove">&times;</button>
          </li>
        ))}
        {list.length === 0 && <li className="empty-list">No items yet.</li>}
      </ul>
      <div className="add-item-form">
        <input
          type="text"
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          placeholder={`Add new ${label.toLowerCase().replace(':', '')}...`}
        />
        <button type="button" onClick={handleAddItem}>Add +</button>
      </div>
    </div>
  );
};


// Linked Data Viewer (simplified)
const LinkedDataViewer = ({ marketData = [], ontologyData = [] }) => {
 return (
   <div className="linked-data-container">
     <strong>Linked Market Segments ({marketData.length})</strong>
      <div className="tag-list">
        {marketData.length > 0 ? (
         marketData.map(market => (
           <span key={market.id} className="tag market">{market.name}</span>
         ))
       ) : (
         <span className="tag-none">No markets linked.</span>
       )}
      </div>

      <strong style={{marginTop: '15px'}}>Linked Ontology Tags ({ontologyData.length})</strong>
      <div className="tag-list">
       {ontologyData.length > 0 ? (
         ontologyData.map(tag => (
           <span key={tag.id} className="tag ontology" title={`Full Path: ${tag.path}`}>
             {tag.name}
           </span>
         ))
       ) : (
         <span className="tag-none">No ontology tags linked.</span>
       )}
      </div>
   </div>
 );
};

// --- Link Editor Modal Component ---
const LinkEditorModal = ({ initialMarketIds = [], initialOntologyIds = [], onSave, onClose }) => {
  const [selectedMarketIds, setSelectedMarketIds] = useState(initialMarketIds || []);
  const [selectedTagIds, setSelectedTagIds] = useState(initialOntologyIds || []);

  const handleSaveClick = () => {
    onSave(selectedMarketIds, selectedTagIds);
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-content">
        <h2>Edit Application Links 🔗</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', margin: '20px 0' }}>
          {/* Added container div with class */}
          <div className="TreeLinker-container">
            <TreeLinker
              title="Select Markets"
              rpcName="market_segments"
              initialSelection={initialMarketIds}
              onSelectionChange={setSelectedMarketIds}
            />
          </div>
          {/* Added container div with class */}
          <div className="TreeLinker-container">
            <TreeLinker
              title="Select Ontologies"
              rpcName="ontology_tags"
              initialSelection={initialOntologyIds}
              onSelectionChange={setSelectedTagIds}
            />
          </div>
        </div>
        <div className="modal-actions">
           <button onClick={handleSaveClick} className="save-button">Save Links</button>
           <button onClick={onClose} className="cancel-button">Cancel</button>
        </div>
      </div>
    </div>
  );
};


// --- MAIN DETAIL PANE COMPONENT ---
export function DetailPane({ selectedItemId, selectedItemType, onClose, onItemUpdated }) {
  const [loading, setLoading] = useState(false);
  const [itemData, setItemData] = useState(null); // Holds app OR market data
  const [saveTimer, setSaveTimer] = useState(null);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [modalLinks, setModalLinks] = useState({ markets: [], ontologies: [] });


  // Unified fetcher for App or Market details
  const fetchDetails = useCallback(async (id, type) => {
    if (!id || ! type) {
        setItemData(null);
        setLoading(false);
        return;
    }
    setLoading(true);
    setItemData(null); // Clear previous data
    let data, error;
    let fetchedLinks = { linked_markets: [], linked_ontologies: [] }; // Store links separately

    try {
        if (type === 'application') {
          // Fetch application core data + metrics in one go
          ({ data, error } = await supabase
            .from('applications')
            .select(`*, application_metrics ( * )`) // Select app + metrics
            .eq('id', id)
            .single());

            if (error) throw error; // Throw error to be caught below

            // Fetch links separately ONLY if app data loaded
            if (data) {
                 const { data: marketLinks, error: marketLinkError } = await supabase
                   .from('application_market_links')
                   .select('market_segments ( id, name )') // Only fetch needed fields
                   .eq('application_id', id);
                 if (marketLinkError) throw marketLinkError;

                 const { data: ontologyLinks, error: ontologyLinkError } = await supabase
                   .from('application_ontology_links')
                   .select('ontology_tags ( id, name, path )') // Fetch needed fields
                   .eq('application_id', id);
                 if (ontologyLinkError) throw ontologyLinkError;

                 fetchedLinks.linked_markets = marketLinks?.map(m => m.market_segments).filter(Boolean) || [];
                 fetchedLinks.linked_ontologies = ontologyLinks?.map(o => o.ontology_tags).filter(Boolean) || [];
            }


        } else if (type === 'market') {
          ({ data, error } = await supabase
            .from('market_segments')
            .select(`*, parent_market:parent_id ( id, name )`) // Fetch market + parent ID and name
            .eq('id', id)
            .single());
            if (error) throw error;

        } else if (type === 'ontology') { // Added Ontology Fetch
             ({ data, error } = await supabase
             .from('ontology_tags')
             .select(`*, parent_ontology:parent_id ( id, name, path)`) // Fetch tag + parent ID and name
             .eq('id', id)
             .single());
             if (error) throw error;
        }

        if (data) {
          // Flatten metrics if it's an application
          const baseData = type === 'application' ? { ...data, ...(data.application_metrics || {}) } : data;
          // Combine base data with fetched links
          setItemData({ ...baseData, ...fetchedLinks });
        } else {
             setItemData(null); // Ensure null if no data
        }

    } catch (err) {
         console.error(`Error fetching ${type} details for ID ${id}:`, err);
         alert(`Could not load details: ${err.message}`);
         setItemData(null); // Clear item data on error
    } finally {
        setLoading(false);
    }
  }, []); // Removed itemData from dependencies

  // Fetch when selection changes
  useEffect(() => {
    // Clear save timer when selection changes
    if (saveTimer) clearTimeout(saveTimer);
    fetchDetails(selectedItemId, selectedItemType);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedItemId, selectedItemType, fetchDetails]); // Keep fetchDetails dependency if needed for useCallback


  // Unified Change Handler
  const handleChange = (field, value) => {
    if (!itemData) return;

    // Prevent direct mutation
    const updatedItem = { ...itemData, [field]: value };
    setItemData(updatedItem);

    // Debounced Auto-Save
    if (saveTimer) clearTimeout(saveTimer);
    const newTimer = setTimeout(() => {
      handleSave(updatedItem, field, value);
    }, 1500); // Auto-save after 1.5s
    setSaveTimer(newTimer);
  };

  // Unified Save Handler
  const handleSave = async (updatedItem, field, value) => {
    if (!selectedItemId || !selectedItemType) return; // Guard against saving nothing

    let error;
    let tableName = '';
    let recordId = selectedItemId; // Use selectedItemId directly
    let updateData = { [field]: value };
    let needsScoreUpdate = false;

    // Determine target table and adjust data/ID if necessary
    if (selectedItemType === 'application') {
      if (['component_name', 'description', 'status', 'legacy_name'].includes(field)) {
        tableName = 'applications';
      } else if ([
          'technical_feasibility', 'market_access', 'strategic_synergy',
          'potential_price_premium', 'ip_defensibility', 'capital_efficiency',
          'market_potential', 'priority_score' // Include priority_score although it's calculated
        ].includes(field)) {
        tableName = 'application_metrics';
        // Ensure we use application_id for the metrics table condition
        // recordId remains selectedItemId which IS the application_id here
      } else {
         console.warn(`Attempted to save unknown application field: ${field}`);
         return; // Don't save if field is not recognized
      }
       // Check if it's a score-affecting metric
       if (['strategic_synergy', 'ip_defensibility', 'potential_price_premium', 'capital_efficiency', 'market_access'].includes(field)){
           needsScoreUpdate = true;
       }

    } else if (selectedItemType === 'market') {
      tableName = 'market_segments';
      if (field === 'market_size_b' || field === 'cagr') {
          // Handle empty string -> null, otherwise convert to number
          updateData = { [field]: value === '' || value === null ? null : Number(value) } ;
      } else if (field === 'key_players' || field === 'untapped_opportunities'){
          // ListEditor provides the correct array format
          updateData = { [field]: value };
      } else if (['name'].includes(field)){
          updateData = { [field]: value }; // Standard text update
      } else {
         console.warn(`Attempted to save unknown market field: ${field}`);
         return;
      }
    } else if (selectedItemType === 'ontology') { // Handle Ontology Save
       tableName = 'ontology_tags';
       if (['name', 'path'].includes(field)) { // Only allow editing name and path for now
            updateData = { [field]: value };
            if (field === 'path') {
                // Add a warning or confirmation here in a real app
                console.warn("Changing ontology path can have wide effects, proceed with caution.");
            }
       } else {
           console.warn(`Attempted to save unknown ontology field: ${field}`);
           return;
       }
    }

    if (!tableName) {
       console.error("Save failed: Could not determine table name.", { selectedItemType, field });
       alert("Save failed: Internal error.");
       return;
    }

    console.log(`Attempting to save to ${tableName}, ID: ${recordId}, Data:`, updateData);

    // Perform the update
    ({ error } = await supabase
      .from(tableName)
      .update(updateData)
      .eq(tableName === 'application_metrics' ? 'application_id' : 'id', recordId) // Use correct ID column
     );


    if (error) {
      console.error(`Save failed for ${tableName} ID ${recordId}:`, error)
      alert(`Save failed: ${error.message}`);
      // Optional: Revert local state if save fails by re-fetching
      fetchDetails(selectedItemId, selectedItemType);
    } else {
      console.log(`Saved: ${field} to ${tableName}`);

      // Trigger score update if needed (only for applications)
      if (needsScoreUpdate && selectedItemType === 'application') {
         console.log(`Triggering score update for app ${recordId}...`);
         const { error: scoreError } = await supabase.rpc('calculate_priority_score', {
           app_id: recordId
         });
         if (scoreError) {
           console.error("Score calculation failed:", scoreError);
         } else {
           console.log("Score recalculation triggered.");
           // Re-fetch details needed to show new score immediately
           // Using onItemUpdated causes App.jsx to refetch, which is safer
           // fetchDetails(recordId, 'application'); // This could cause race conditions with rapid edits
         }
      }
      // Notify parent to refetch list data (e.g., scores in table, counts in nav)
      onItemUpdated();
    }
  };

  // --- Link Editing Logic ---
  const openLinkEditor = () => {
    if (selectedItemType === 'application' && itemData) {
      // Pass current link IDs to the modal
      setModalLinks({
        markets: itemData.linked_markets?.map(m => m.id) || [],
        ontologies: itemData.linked_ontologies?.map(o => o.id) || [],
      });
      setShowLinkModal(true);
    }
  };

  const handleSaveLinks = async (newMarketIds, newOntologyIds) => {
    if (!itemData || selectedItemType !== 'application') return;

    const originalMarketIds = itemData.linked_markets?.map(m => m.id) || [];
    const originalOntologyIds = itemData.linked_ontologies?.map(o => o.id) || [];

    // Calculate differences
    const marketsToAdd = newMarketIds.filter(id => !originalMarketIds.includes(id));
    const marketsToRemove = originalMarketIds.filter(id => !newMarketIds.includes(id));
    const tagsToAdd = newOntologyIds.filter(id => !originalOntologyIds.includes(id));
    const tagsToRemove = originalOntologyIds.filter(id => !newOntologyIds.includes(id));

    // Only call RPC if there are changes
    if (marketsToAdd.length === 0 && marketsToRemove.length === 0 && tagsToAdd.length === 0 && tagsToRemove.length === 0) {
        console.log("No link changes detected.");
        setShowLinkModal(false);
        return;
    }

    console.log("Updating links:", { marketsToAdd, marketsToRemove, tagsToAdd, tagsToRemove });

    // Call the RPC function
    const { error } = await supabase.rpc('update_application_links', {
      p_app_id: itemData.id,
      p_markets_to_add: marketsToAdd,
      p_markets_to_remove: marketsToRemove,
      p_tags_to_add: tagsToAdd,
      p_tags_to_remove: tagsToRemove
    });

    if (error) {
      alert(`Error updating links: ${error.message}`);
    } else {
      console.log("Links updated successfully.");
      setShowLinkModal(false); // Close modal on success
      // Re-fetch details to update the displayed links IN THIS PANE
      fetchDetails(itemData.id, 'application');
      // Also notify App.jsx to refetch lists (e.g., market counts might change)
      onItemUpdated();
    }
  };

  // --- RENDER LOGIC ---
  if (loading) {
    return <div className="detail-pane-message">Loading details...</div>;
  }
  if (!itemData) {
    return (
      <div className="detail-pane-message instructions">
        Select an application, market, or ontology tag from the left panes to see details here. 🧐
      </div>
    );
  }

  // Close Button (common to all views)
  const CloseButton = () => (
     <button onClick={onClose} className="close-button" title="Close Details">
        &times;
      </button>
  );

  // --- APPLICATION DETAIL VIEW ---
  if (selectedItemType === 'application') {
    const app = itemData; // Rename for clarity
    return (
      <div className="detail-pane application-detail">
        <CloseButton />
        <h2>Application Details 💡</h2>

        <div className="form-group">
          <label>B2B Component Name</label>
          <input
            type="text"
            value={app.component_name || ''}
            onChange={(e) => handleChange('component_name', e.target.value)}
          />
        </div>

        <div className="form-group">
           <label>Legacy Name (Read Only)</label>
           <input type="text" value={app.legacy_name || 'N/A'} readOnly disabled />
        </div>


        <div className="form-group">
          <label>Description</label>
          <textarea
            value={app.description || ''}
            onChange={(e) => handleChange('description', e.target.value)}
            rows={5}
          />
        </div>

        <div className="form-group">
          <label>Status</label>
          <select value={app.status || 'proposed'} onChange={(e) => handleChange('status', e.target.value)}>
            <option value="proposed">Proposed</option>
            <option value="in_review">In Review</option>
            <option value="active_r&d">Active R&D</option>
            <option value="backlog">Backlog</option>
            <option value="archived">Archived</option>
          </select>
        </div>

		{/* --- Scoring Section --- */}
        <h3 className="section-header" title="These metrics score THIS SPECIFIC application based on Kevin's IP-Venture model."> {/* Added Tooltip */}
            Application Prioritization Metrics 📈 {/* Renamed Header */}
        </h3>
        {/* Added Explanatory Paragraph */}
        <p className="score-explanation">
            Use the sliders below to score <strong>this application's potential</strong>. The 'Calculated Priority Score' is automatically generated based on these inputs using AGM's strategic weighting.
        </p>
         <p className="score-display">
            Calculated Priority Score: <strong>{app.priority_score?.toFixed(1) ?? 'N/A'}</strong>
         </p>

        {/* Sliders as defined before */}
         <div className="form-group slider-group" title="[Weight: 30%] How uniquely does this leverage our fractal turbostratic advantage? (1 = Any graphene works, 10 = Only AGM material works)">
           <label>Strategic Synergy ({app.strategic_synergy ?? 'N/A'})</label>
           <input type="range" min="1" max="10" value={app.strategic_synergy || 5} onChange={(e) => handleChange('strategic_synergy', Number(e.target.value))}/>
         </div>
          <div className="form-group slider-group" title="[Weight: 25%] How strong is the potential patent? Relies on covalent bonding? (1 = Weak/Easy to copy, 10 = Strong/Unique)">
           <label>IP Defensibility ({app.ip_defensibility ?? 'N/A'})</label>
           <input type="range" min="1" max="10" value={app.ip_defensibility || 5} onChange={(e) => handleChange('ip_defensibility', Number(e.target.value))}/>
         </div>
         <div className="form-group slider-group" title="[Weight: 20%] How much more could the end product sell for with our graphene? ($0.10 -> $10+?) (1 = Low Premium, 10 = High Premium)">
           <label>Potential Price Premium ({app.potential_price_premium ?? 'N/A'})</label>
           <input type="range" min="1" max="10" value={app.potential_price_premium || 5} onChange={(e) => handleChange('potential_price_premium', Number(e.target.value))}/>
         </div>
         <div className="form-group slider-group" title="[Weight: 15%] How easy/cheap to prototype & launch via contract manufacturers? (1 = High Capital Needed, 10 = Low Capital / Easy)">
           <label>Capital Efficiency ({app.capital_efficiency ?? 'N/A'})</label>
           <input type="range" min="1" max="10" value={app.capital_efficiency || 5} onChange={(e) => handleChange('capital_efficiency', Number(e.target.value))}/>
         </div>
         <div className="form-group slider-group supporting-metric" title="[Weight: 10%] How easy is market entry? Focus on JV partner potential. (1 = High Barriers, 10 = Existing Partners)">
           <label>Market Access ({app.market_access ?? 'N/A'})</label>
           <input type="range" min="1" max="10" value={app.market_access || 5} onChange={(e) => handleChange('market_access', Number(e.target.value))}/>
         </div>
         <div className="form-group slider-group supporting-metric" title="[Weight: 0% - Info Only] How hard is the science/manufacturing? (1 = Pure Research, 10 = Off-the-shelf)">
           <label>Technical Feasibility ({app.technical_feasibility ?? 'N/A'})</label>
           <input type="range" min="1" max="10" value={app.technical_feasibility || 5} onChange={(e) => handleChange('technical_feasibility', Number(e.target.value))}/>
         </div>

        {/* --- Linked Data Section --- */}
        <h3 className="section-header">
           Linked Data 🔗
           {/* Add Edit Links Button */}
           <button onClick={openLinkEditor} className="edit-links-button" title="Edit Market & Ontology Links">
             Edit Links
           </button>
        </h3>
        <LinkedDataViewer marketData={app.linked_markets} ontologyData={app.linked_ontologies}/>

        {/* Add Link Editor Modal */}
        {showLinkModal && (
          <LinkEditorModal
            initialMarketIds={modalLinks.markets}
            initialOntologyIds={modalLinks.ontologies}
            onSave={handleSaveLinks}
            onClose={() => setShowLinkModal(false)}
          />
        )}
      </div>
    );
  }

  // --- MARKET DETAIL VIEW ---
  else if (selectedItemType === 'market') {
    const market = itemData; // Rename for clarity
    return (
      <div className="detail-pane market-detail">
        <CloseButton />
        <h2>Market Segment Details 🗺️</h2>

         <div className="form-group">
           <label>Market Segment Name</label>
           <input
             type="text"
             value={market.name || ''}
             onChange={(e) => handleChange('name', e.target.value)}
           />
         </div>

         <div className="form-group">
            <label>Parent Market (Read Only)</label>
            <input type="text" value={market.parent_market?.name || 'Top Level'} readOnly disabled />
         </div>

         <div className="form-group">
           <label>Market Size ($B, Est.)</label>
           <input
             type="number" // Use number input
             step="0.1"    // Allow decimals
             value={market.market_size_b ?? ''} // Handle null
             onChange={(e) => handleChange('market_size_b', e.target.value)}
             placeholder="e.g., 10.5"
           />
         </div>

         <div className="form-group">
           <label>Projected CAGR (Est.)</label>
            <input
             type="number"
             step="0.01" // Allow percentage decimals
             value={market.cagr ?? ''} // Handle null
             onChange={(e) => handleChange('cagr', e.target.value)}
             placeholder="e.g., 0.15 for 15%"
           />
           {/* Display formatted CAGR next to input */}
           {market.cagr !== null && market.cagr !== undefined && <span className="cagr-display">({(Number(market.cagr) * 100).toFixed(1)}%)</span>}
         </div>

         {/* Use ListEditor for Key Players and Opportunities */}
         <ListEditor
            label="Key Players:"
            items={market.key_players}
            fieldName="key_players"
            onSave={(field, value) => handleSave(market, field, value)} // Pass market data to save handler
         />

          <ListEditor
            label="Untapped Opportunities:"
            items={market.untapped_opportunities}
            fieldName="untapped_opportunities"
            onSave={(field, value) => handleSave(market, field, value)} // Pass market data to save handler
         />

      </div>
    );
  }

  // --- ONTOLOGY DETAIL VIEW (NEW) ---
   else if (selectedItemType === 'ontology') {
    const tag = itemData; // Rename for clarity
    return (
      <div className="detail-pane ontology-detail">
        <CloseButton />
        <h2>Ontology Tag Details 🔬</h2>

         <div className="form-group">
           <label>Tag Name</label>
           <input
             type="text"
             value={tag.name || ''}
             onChange={(e) => handleChange('name', e.target.value)}
           />
         </div>

         <div className="form-group">
            <label>Full Path (Read Only - Use caution if enabling edit later)</label>
            <input type="text" value={tag.path || 'N/A'} readOnly disabled />
         </div>

         <div className="form-group">
            <label>Parent Ontology (Read Only)</label>
            <input type="text" value={tag.parent_ontology?.name || 'Top Level'} readOnly disabled />
         </div>

         {/* Add more fields here later if needed (e.g., description for ontology tags) */}

      </div>
    );
  }

  // Fallback if type is unknown
  return <div className="detail-pane-message">Unknown item type selected.</div>;
}