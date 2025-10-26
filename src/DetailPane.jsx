// src/DetailPane.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabase';
import { TreeLinker } from './TreeLinker';
import { SuggestionModal } from './SuggestionModal'; // *** ENSURE THIS IMPORT IS PRESENT ***
// Assuming styles are in index.css

// --- Reusable ListEditor Component ---
const ListEditor = ({ label, items = [], fieldName, onSave }) => {
  const [list, setList] = useState(items || []);
  const [newItem, setNewItem] = useState('');

  useEffect(() => { setList(items || []); }, [items]);

  const handleAddItem = () => {
    if (newItem.trim()) {
      const updatedList = [...list, newItem.trim()];
      setList(updatedList);
      onSave(fieldName, updatedList);
      setNewItem('');
    }
  };

  const handleRemoveItem = (indexToRemove) => {
    const updatedList = list.filter((_, index) => index !== indexToRemove);
    setList(updatedList);
    onSave(fieldName, updatedList);
  };

  return (
    <div className="form-group list-editor">
      <label>{label}</label>
      <ul className="item-list">
        {list.map((item, index) => (
          <li key={`${fieldName}-${index}-${item}`}> {/* Improved key */}
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
          aria-label={`Add new ${label.toLowerCase().replace(':', '')}`}
        />
        <button type="button" onClick={handleAddItem}>Add +</button>
      </div>
    </div>
  );
};

// --- Linked Data Viewer Component ---
const LinkedDataViewer = ({ marketData = [], ontologyData = [] }) => {
 return (
   <div className="linked-data-container">
     <strong>Linked Market Segments ({marketData.length})</strong>
      <div className="tag-list">
        {marketData.length > 0 ? (
         marketData.map(market => (
           <span key={market.id} className="tag market">{market.name || 'Unnamed Market'}</span>
         ))
       ) : (
         <span className="tag-none">No markets linked.</span>
       )}
      </div>

      <strong style={{marginTop: '15px'}}>Linked Technical Functions ({ontologyData.length})</strong>
      <div className="tag-list">
       {ontologyData.length > 0 ? (
         ontologyData.map(tag => (
           <span key={tag.id} className="tag ontology" title={`Full Path: ${tag.path}`}>
             {tag.name || 'Unnamed Function'}
           </span>
         ))
       ) : (
         <span className="tag-none">No functions linked.</span>
       )}
      </div>
   </div>
 );
};

// --- Link Editor Modal Component ---
const LinkEditorModal = ({ initialMarketIds = [], initialOntologyIds = [], onSave, onClose }) => {
  const [selectedMarketIds, setSelectedMarketIds] = useState(initialMarketIds || []);
  const [selectedTagIds, setSelectedTagIds] = useState(initialOntologyIds || []);
  const [isLoading, setIsLoading] = useState(false);

  // Recalculate initial state if props change (modal reopens)
  useEffect(() => {
    setSelectedMarketIds(initialMarketIds || []);
    setSelectedTagIds(initialOntologyIds || []);
  }, [initialMarketIds, initialOntologyIds]);


  const handleSaveClick = async () => {
    setIsLoading(true);
    await onSave(selectedMarketIds, selectedTagIds);
    // Loading state is reset within handleSaveLinks now
    // setIsLoading(false); // Can likely remove this line
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        {/* Put close button inside header for better structure */}
        <div className="modal-header">
             <h2>Edit Application Links 🔗</h2>
             <button onClick={onClose} className="close-button info-close-button" title="Close Link Editor" disabled={isLoading}>&times;</button>
        </div>
        <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div className="TreeLinker-container form-group"> {/* Added form-group for consistency */}
             <label style={{marginBottom: 'var(--space-sm)'}}>Select Markets</label> {/* Added label */}
            <TreeLinker
              // title="Select Markets" // Title removed, using label now
              rpcName="market_segments"
              initialSelection={initialMarketIds}
              onSelectionChange={setSelectedMarketIds}
            />
          </div>
          <div className="TreeLinker-container form-group">
             <label style={{marginBottom: 'var(--space-sm)'}}>Select Technical Functions</label> {/* Added label */}
            <TreeLinker
              // title="Select Technical Functions"
              rpcName="ontology_tags"
              initialSelection={initialOntologyIds}
              onSelectionChange={setSelectedTagIds}
            />
          </div>
        </div>
        <div className="form-actions">
           <button onClick={handleSaveClick} className="btn-primary" disabled={isLoading}>
             {isLoading ? 'Saving...' : 'Save Links'}
            </button>
           <button onClick={onClose} className="btn-secondary" disabled={isLoading}>Cancel</button>
        </div>
      </div>
    </div>
  );
};


// --- MAIN DETAIL PANE COMPONENT ---
export function DetailPane({ selectedItemId, selectedItemType, onClose, onItemUpdated }) {
  const [loading, setLoading] = useState(false);
  const [itemData, setItemData] = useState(null);
  const [saveTimer, setSaveTimer] = useState(null);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [modalLinks, setModalLinks] = useState({ markets: [], ontologies: [] });
  const [isSavingLinks, setIsSavingLinks] = useState(false);

  // *** State for Suggestion Modal ***
  const [showSuggestionModal, setShowSuggestionModal] = useState(false);
  // **********************************

  // Unified fetcher
  const fetchDetails = useCallback(async (id, type) => {
     if (!id || ! type) { setItemData(null); setLoading(false); return; }
     setLoading(true); setItemData(null);
     let data, error;
     let fetchedLinks = { linked_markets: [], linked_ontologies: [] };
     try {
         if (type === 'application') {
           ({ data, error } = await supabase.from('applications').select(`*, application_metrics ( * )`).eq('id', id).maybeSingle());
           if (error) throw error;
           if (data) {
                // Fetch links only AFTER confirming app data exists
                const { data: marketLinks, error: marketLinkError } = await supabase.from('application_market_links').select('market_segments!inner( id, name )').eq('application_id', id); // Use !inner join
                if (marketLinkError) throw marketLinkError;
                const { data: ontologyLinks, error: ontologyLinkError } = await supabase.from('application_ontology_links').select('ontology_tags!inner( id, name, path )').eq('application_id', id); // Use !inner join
                if (ontologyLinkError) throw ontologyLinkError;
                // Inner join means data is guaranteed if links exist, simplify mapping
                fetchedLinks.linked_markets = marketLinks?.map(m => m.market_segments) || [];
                fetchedLinks.linked_ontologies = ontologyLinks?.map(o => o.ontology_tags) || [];
           }
         } else if (type === 'market') {
           ({ data, error } = await supabase.from('market_segments').select(`*, parent_market:parent_id ( id, name )`).eq('id', id).maybeSingle());
           if (error) throw error;
         } else if (type === 'ontology') {
           ({ data, error } = await supabase.from('ontology_tags').select(`*, parent_ontology:parent_id ( id, name, path)`).eq('id', id).maybeSingle());
           if (error) throw error;
         }
         // Combine base data with links IF it's an application
         const finalData = (type === 'application' && data)
            ? { ...data, ...(data.application_metrics || {}), ...fetchedLinks }
            : data;

         setItemData(finalData || null); // Ensure null if data is null/undefined

     } catch (err) {
          console.error(`Error fetching ${type} details for ID ${id}:`, err);
          alert(`Could not load details: ${err.message}. Item may have been deleted or there was a network issue.`);
          setItemData(null);
          onClose(); // Close the pane if the item fetch fails critically
     } finally { setLoading(false); }
  }, [onClose]); // Added onClose dependency

  // Fetch when selection changes
  useEffect(() => {
    if (saveTimer) clearTimeout(saveTimer);
    fetchDetails(selectedItemId, selectedItemType);
  }, [selectedItemId, selectedItemType, fetchDetails, saveTimer]); // Include fetchDetails and saveTimer


  // Unified Change Handler
  const handleChange = (field, value) => {
     if (!itemData || isSavingLinks) return; // Prevent edits while saving links
     const updatedItem = { ...itemData, [field]: value };
     setItemData(updatedItem); // Optimistic UI update
     if (saveTimer) clearTimeout(saveTimer);
     const newTimer = setTimeout(() => { handleSave(field, value); }, 1500); // Pass field/value directly
     setSaveTimer(newTimer);
  };

  // Unified Save Handler - simplified to use current itemData state
  const handleSave = async (field, value) => {
     if (!selectedItemId || !selectedItemType || !itemData) return;

     let error; let tableName = ''; let recordId = selectedItemId;
     let updateData = { [field]: value }; let needsScoreUpdate = false;

     try {
         // Determine table and adjust data based on type/field
         if (selectedItemType === 'application') {
           if (['component_name', 'description', 'status'].includes(field)) { tableName = 'applications'; } // legacy_name shouldn't be edited
           else if (['technical_feasibility', 'market_access', 'strategic_synergy','potential_price_premium', 'ip_defensibility', 'capital_efficiency','market_potential'].includes(field)) {
             tableName = 'application_metrics';
              // Convert value to number for metrics
              updateData = { [field]: value === '' || value === null ? null : Number(value) };
              // Check if it's a score-affecting metric
             if (['strategic_synergy', 'ip_defensibility', 'potential_price_premium', 'capital_efficiency', 'market_access'].includes(field)){ needsScoreUpdate = true; }
           } else { throw new Error(`Unknown/Readonly application field: ${field}`); }

         } else if (selectedItemType === 'market') {
           tableName = 'market_segments';
           if (field === 'market_size_b' || field === 'cagr') { updateData = { [field]: value === '' || value === null ? null : Number(value) }; }
           else if (field === 'key_players' || field === 'untapped_opportunities'){ updateData = { [field]: value || [] }; } // Use ListEditor's array
           else if (['name'].includes(field)){ updateData = { [field]: value }; }
           else { throw new Error(`Unknown/Readonly market field: ${field}`); }

         } else if (selectedItemType === 'ontology') {
           tableName = 'ontology_tags';
           if (['name'].includes(field)) { // Only allow editing name for now
             updateData = { [field]: value };
           } else { throw new Error(`Unknown/Readonly ontology field: ${field}`); }
         } else { throw new Error(`Unknown item type: ${selectedItemType}`); }

         console.log(`Saving to ${tableName}, ID: ${recordId}, Data:`, updateData);
         ({ error } = await supabase.from(tableName).update(updateData)
           .eq(tableName === 'application_metrics' ? 'application_id' : 'id', recordId));
         if (error) throw error;

         console.log(`Saved: ${field} to ${tableName}`);

         // Trigger score update if needed (only for applications)
         if (needsScoreUpdate && selectedItemType === 'application') {
            console.log(`Triggering score update for app ${recordId}...`);
            const { error: scoreError } = await supabase.rpc('calculate_priority_score', { app_id: recordId });
            // Log score error but don't block UI flow
            if (scoreError) console.error("Score calculation RPC failed:", scoreError);
            else console.log("Score recalculation triggered successfully.");
            // Score update will be reflected on next fetch triggered by onItemUpdated
         }
         onItemUpdated(); // Notify parent AFTER successful save/score trigger

     } catch (err) {
         console.error(`Save failed for ${tableName} ID ${recordId}:`, err);
         alert(`Save failed: ${err.message}`);
         // Revert local state by re-fetching
         fetchDetails(selectedItemId, selectedItemType);
     }
  };


  // --- Link Editing Logic ---
  const openLinkEditor = () => {
    if (selectedItemType === 'application' && itemData) {
      setModalLinks({
        markets: itemData.linked_markets?.map(m => m.id) || [],
        ontologies: itemData.linked_ontologies?.map(o => o.id) || [],
      });
      setShowLinkModal(true);
    }
  };

  const handleSaveLinks = async (newMarketIds, newOntologyIds) => {
    if (!itemData || selectedItemType !== 'application' || isSavingLinks) return;
    setIsSavingLinks(true); // Set loading state FOR LINKS

    const originalMarketIds = itemData.linked_markets?.map(m => m.id) || [];
    const originalOntologyIds = itemData.linked_ontologies?.map(o => o.id) || [];

    const marketsToAdd = newMarketIds.filter(id => !originalMarketIds.includes(id));
    const marketsToRemove = originalMarketIds.filter(id => !newMarketIds.includes(id));
    const tagsToAdd = newOntologyIds.filter(id => !originalOntologyIds.includes(id));
    const tagsToRemove = originalOntologyIds.filter(id => !newOntologyIds.includes(id));

    if (marketsToAdd.length === 0 && marketsToRemove.length === 0 && tagsToAdd.length === 0 && tagsToRemove.length === 0) {
        console.log("No link changes detected.");
        setShowLinkModal(false);
        setIsSavingLinks(false);
        return;
    }

    console.log("Updating links:", { marketsToAdd, marketsToRemove, tagsToAdd, tagsToRemove });
    try {
        const { error } = await supabase.rpc('update_application_links', {
          p_app_id: itemData.id, p_markets_to_add: marketsToAdd, p_markets_to_remove: marketsToRemove,
          p_tags_to_add: tagsToAdd, p_tags_to_remove: tagsToRemove
        });
        if (error) throw error;

        console.log("Links updated successfully.");
        setShowLinkModal(false);
        // Re-fetch details immediately to update this pane's view
        fetchDetails(itemData.id, 'application');
        // Notify App.jsx AFTER details are re-fetched locally
        onItemUpdated();

    } catch (error) {
         alert(`Error updating links: ${error.message}`);
         console.error("Link update failed:", error);
    } finally {
        setIsSavingLinks(false); // Clear link saving state
    }
  };

  // --- RENDER LOGIC ---
  if (loading && !itemData) {
    return <div className="detail-pane-message">Loading details...</div>;
  }
  // Show message only if NO item ID is selected
  if (!selectedItemId) {
    return (
      <div className="detail-pane-message instructions">
        Select an application, market segment, or technical function from the left panes to view or edit details here. 🧐
      </div>
    );
  }
  // Show slightly different message if ID is selected but data hasn't loaded (or failed)
   if (!itemData) {
     return <div className="detail-pane-message">Loading or item not found...</div>;
   }


  // Determine item name for suggestion context (use optional chaining)
  const currentItemName = itemData?.name || itemData?.component_name || 'Selected Item';

  // --- Action Buttons Component ---
  // Placed inside main component to access state easily
  const ActionButtons = () => (
      <div className="detail-pane-actions" style={{display: 'flex', gap: 'var(--space-sm)'}}> {/* Added flex styles */}
           {/* Suggest Button */}
           <button
              onClick={() => setShowSuggestionModal(true)}
              className="btn-primary" /* <-- Use .btn-primary */
              title="Suggest an edit, merge, or correction for Adam to review"
              disabled={loading || isSavingLinks}
              /* Added inline style to override button defaults */
              style={{
                width: 'auto',
                padding: '10px 16px',
                fontSize: '13px',
                letterSpacing: '0.06em',
                margin: 0,
                lineHeight: '1.2'
              }}
           >
              Suggest Change... 📝
           </button>
           
           {/* Close Button */}
           <button
              onClick={onClose}
              className="btn-secondary" /* <-- Use .btn-secondary */
              title="Close Details"
              disabled={loading || isSavingLinks}
              /* Added inline style to override button defaults */
              style={{
                width: 'auto',
                padding: '10px 16px',
                fontSize: '13px',
                letterSpacing: '0.06em',
                margin: 0,
                lineHeight: '1.2'
              }}
           >
              {/* Added requested text */}
              Close Details <span style={{fontSize: '1.4em', verticalAlign: 'middle', marginLeft: '4px'}}>&times;</span>
           </button>
      </div>
  );

  // --- MAIN RENDER SWITCH ---
  return (
    <> {/* Fragment needed for adjacent Detail Content and Modals */}
        {/* Render based on selectedItemType */}
        {selectedItemType === 'application' && (
            <div key={`app-${selectedItemId}`} className="detail-pane application-detail">
                <ActionButtons />
                <h2>Application Details 💡</h2>
                {/* --- Form Fields --- */}
                <div className="form-group">
                  <label htmlFor={`appName-${selectedItemId}`}>B2B Component Name</label>
                  <input id={`appName-${selectedItemId}`} type="text" value={itemData.component_name || ''} onChange={(e) => handleChange('component_name', e.target.value)} disabled={loading || isSavingLinks}/>
                </div>
                <div className="form-group">
                  <label>Legacy Name (Read Only)</label>
                  <input type="text" value={itemData.legacy_name || 'N/A'} readOnly disabled />
                </div>
                <div className="form-group">
                  <label htmlFor={`appDesc-${selectedItemId}`}>Description</label>
                  <textarea id={`appDesc-${selectedItemId}`} value={itemData.description || ''} onChange={(e) => handleChange('description', e.target.value)} rows={5} disabled={loading || isSavingLinks}/>
                </div>
                <div className="form-group">
                  <label htmlFor={`appStatus-${selectedItemId}`}>Status</label>
                  <select id={`appStatus-${selectedItemId}`} value={itemData.status || 'proposed'} onChange={(e) => handleChange('status', e.target.value)} disabled={loading || isSavingLinks}>
                    <option value="proposed">Proposed</option> <option value="in_review">In Review</option>
                    <option value="active_r&d">Active R&D</option> <option value="backlog">Backlog</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
                {/* --- Scoring Section --- */}
                <h3 className="section-header" title="Metrics score THIS application based on Kevin's IP-Venture model.">Application Prioritization Metrics 📈</h3>
                <p className="score-explanation">Score <strong>this application's potential</strong>. 'Calculated Priority Score' updates automatically.</p>
                <p className="score-display">Calculated Priority Score: <strong>{itemData.priority_score?.toFixed(1) ?? 'N/A'}</strong></p>
                {/* Sliders */}
                <div className="form-group slider-group" title="[Weight: 30%] Leverage unique fractal turbostratic advantage? (1=Any graphene, 10=Only AGM)">
                  <label>Strategic Synergy ({itemData.strategic_synergy ?? '5'})</label>
                  <input type="range" min="1" max="10" value={itemData.strategic_synergy || 5} onChange={(e) => handleChange('strategic_synergy', Number(e.target.value))} disabled={loading || isSavingLinks}/>
                </div>
                 <div className="form-group slider-group" title="[Weight: 25%] Patent strength? Covalent bonding? (1=Weak/Easy copy, 10=Strong/Unique)">
                  <label>IP Defensibility ({itemData.ip_defensibility ?? '5'})</label>
                  <input type="range" min="1" max="10" value={itemData.ip_defensibility || 5} onChange={(e) => handleChange('ip_defensibility', Number(e.target.value))} disabled={loading || isSavingLinks}/>
                </div>
                <div className="form-group slider-group" title="[Weight: 20%] Potential product price premium? ($0.10 -> $10+?) (1=Low, 10=High)">
                  <label>Potential Price Premium ({itemData.potential_price_premium ?? '5'})</label>
                  <input type="range" min="1" max="10" value={itemData.potential_price_premium || 5} onChange={(e) => handleChange('potential_price_premium', Number(e.target.value))} disabled={loading || isSavingLinks}/>
                </div>
                <div className="form-group slider-group" title="[Weight: 15%] Ease/cost of prototype & launch via contract manufacturers? (1=High Capital, 10=Low Capital)">
                  <label>Capital Efficiency ({itemData.capital_efficiency ?? '5'})</label>
                  <input type="range" min="1" max="10" value={itemData.capital_efficiency || 5} onChange={(e) => handleChange('capital_efficiency', Number(e.target.value))} disabled={loading || isSavingLinks}/>
                </div>
                <div className="form-group slider-group supporting-metric" title="[Weight: 10%] Market entry ease? JV partner potential? (1=High Barriers, 10=Existing Partners)">
                  <label>Market Access ({itemData.market_access ?? '5'})</label>
                  <input type="range" min="1" max="10" value={itemData.market_access || 5} onChange={(e) => handleChange('market_access', Number(e.target.value))} disabled={loading || isSavingLinks}/>
                </div>
                <div className="form-group slider-group supporting-metric" title="[Weight: 0% - Info Only] Science/manufacturing difficulty? (1=Pure Research, 10=Off-the-shelf)">
                  <label>Technical Feasibility ({itemData.technical_feasibility ?? '5'})</label>
                  <input type="range" min="1" max="10" value={itemData.technical_feasibility || 5} onChange={(e) => handleChange('technical_feasibility', Number(e.target.value))} disabled={loading || isSavingLinks}/>
                </div>
                {/* --- Linked Data Section --- */}
                <h3 className="section-header">
                  Linked Data 🔗
                  <button onClick={openLinkEditor} className="edit-links-button" title="Edit Market & Technical Function Links" disabled={loading || isSavingLinks}>
                    Edit Links
                  </button>
                </h3>
                <LinkedDataViewer marketData={itemData.linked_markets} ontologyData={itemData.linked_ontologies}/>
            </div>
        )}

        {selectedItemType === 'market' && (
            <div key={`market-${selectedItemId}`} className="detail-pane market-detail">
                <ActionButtons />
                <h2>Market Segment Details 🗺️</h2>
                {/* --- Form Fields --- */}
                <div className="form-group">
                  <label htmlFor={`marketName-${selectedItemId}`}>Market Segment Name</label>
                  <input id={`marketName-${selectedItemId}`} type="text" value={itemData.name || ''} onChange={(e) => handleChange('name', e.target.value)} disabled={loading}/>
                </div>
                <div className="form-group">
                   <label>Parent Market (Read Only)</label>
                   <input type="text" value={itemData.parent_market?.name || 'Top Level'} readOnly disabled />
                </div>
                <div className="form-group">
                  <label htmlFor={`marketSize-${selectedItemId}`}>Market Size ($B, Est.)</label>
                  <input id={`marketSize-${selectedItemId}`} type="number" step="0.1" value={itemData.market_size_b ?? ''} onChange={(e) => handleChange('market_size_b', e.target.value)} placeholder="e.g., 10.5" disabled={loading}/>
                </div>
                <div className="form-group">
                  <label htmlFor={`marketCagr-${selectedItemId}`}>Projected CAGR (Est.)</label>
                   <input id={`marketCagr-${selectedItemId}`} type="number" step="0.01" value={itemData.cagr ?? ''} onChange={(e) => handleChange('cagr', e.target.value)} placeholder="e.g., 0.15 for 15%" disabled={loading}/>
                  {itemData.cagr !== null && itemData.cagr !== undefined && <span className="cagr-display">({(Number(itemData.cagr) * 100).toFixed(1)}%)</span>}
                </div>
                {/* --- List Editors --- */}
                <ListEditor label="Key Players:" items={itemData.key_players} fieldName="key_players" onSave={(field, value) => handleSave(field, value)}/>
                <ListEditor label="Untapped Opportunities:" items={itemData.untapped_opportunities} fieldName="untapped_opportunities" onSave={(field, value) => handleSave(field, value)}/>
            </div>
        )}

        {selectedItemType === 'ontology' && (
            <div key={`ontology-${selectedItemId}`} className="detail-pane ontology-detail">
                <ActionButtons />
                <h2>Technical Function Details 🔬</h2>
                {/* --- Form Fields --- */}
                <div className="form-group">
                  <label htmlFor={`tagName-${selectedItemId}`}>Function Name</label>
                  <input id={`tagName-${selectedItemId}`} type="text" value={itemData.name || ''} onChange={(e) => handleChange('name', e.target.value)} disabled={loading}/>
                </div>
                <div className="form-group">
                   <label title="Unique identifier showing position in hierarchy. Changing this is high-risk.">Full Path (Read Only)</label>
                   <input type="text" value={itemData.path || 'N/A'} readOnly disabled />
                </div>
                <div className="form-group">
                   <label>Parent Function (Read Only)</label>
                   <input type="text" value={itemData.parent_ontology?.name || 'Top Level'} readOnly disabled />
                </div>
                {/* Add description field here later if needed */}
            </div>
        )}

        {/* Render Link Editor Modal only when needed */}
        {showLinkModal && selectedItemType === 'application' && (
          <LinkEditorModal
            initialMarketIds={modalLinks.markets}
            initialOntologyIds={modalLinks.ontologies}
            onSave={handleSaveLinks}
            onClose={() => setShowLinkModal(false)}
          />
        )}

        {/* Render Suggestion Modal only when needed */}
         {showSuggestionModal && selectedItemId && selectedItemType && (
             <SuggestionModal
                 itemType={selectedItemType}
                 itemId={selectedItemId}
                 itemName={currentItemName}
                 onClose={() => setShowSuggestionModal(false)}
             />
         )}
    </> // End Fragment
  );
}