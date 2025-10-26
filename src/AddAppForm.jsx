// src/AddAppForm.jsx
import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { TreeLinker } from './TreeLinker';
// Import the ontology matcher utility
import { cacheOntologyTags, findOntologySuggestions } from './ontologyMatcher'; // Ensure this file exists and is populated

// Main Add Application Form component
export function AddAppForm({ onFinished, preSelectedMarketId = null, preSelectedOntologyId = null }) {
  // --- State Variables ---
  const [componentName, setComponentName] = useState('');
  const [description, setDescription] = useState('');
  const [submitter, setSubmitter] = useState('AGM Team'); // Default or get from user auth

  // Initialize linkers with pre-selected IDs if provided
  const [selectedMarketIds, setSelectedMarketIds] = useState(preSelectedMarketId ? [preSelectedMarketId] : []);
  const [selectedTagIds, setSelectedTagIds] = useState(preSelectedOntologyId ? [preSelectedOntologyId] : []);

  const [similarApps, setSimilarApps] = useState([]); // Stores results from name similarity check
  const [ontologySuggestions, setOntologySuggestions] = useState([]); // Stores tag suggestions based on keywords
  const [similarVentures, setSimilarVentures] = useState([]); // Stores results from link overlap check
  const [showVentureConfirm, setShowVentureConfirm] = useState(false); // Controls the strategy alert modal
  const [isCheckingVentures, setIsCheckingVentures] = useState(false); // Loading for pre-submit check
  const [isSubmitting, setIsSubmitting] = useState(false); // Loading for final submission

  // --- Effects ---
  // Cache Ontology Tags on mount for keyword suggestions
  useEffect(() => {
    cacheOntologyTags(supabase);
  }, []);

  // Debounced Duplicate Application Name Check (Helper 1a)
  useEffect(() => {
    if (componentName.trim().length < 4) {
      setSimilarApps([]); return;
    }
    const debounceTimer = setTimeout(async () => {
      console.log(`Checking name similarity for: "${componentName}"`);
      const { data, error } = await supabase.rpc('get_similar_apps', { query_name: componentName });
      if (error) console.error("Error checking similar app names:", error);
      setSimilarApps(data || []);
    }, 400);
    return () => clearTimeout(debounceTimer);
  }, [componentName]);

  // Debounced Ontology Tag Suggestions based on Name and Description (Helper 1b)
  useEffect(() => {
    const textToAnalyze = `${componentName} ${description}`.trim();
    if (textToAnalyze.length < 5) {
      setOntologySuggestions([]); return;
    }
     const debounceTimer = setTimeout(() => {
        console.log("Finding ontology suggestions for:", textToAnalyze);
        const suggestions = findOntologySuggestions(textToAnalyze);
        setOntologySuggestions(suggestions);
     }, 500);
     return () => clearTimeout(debounceTimer);
  }, [componentName, description]);

  // --- Event Handlers ---
  // Handler for the main form submission (triggers pre-check first)
  const handlePreSubmitCheck = async (e) => {
     e.preventDefault();
     if (isSubmitting || isCheckingVentures) return;
     if (!componentName.trim()) { alert("Please enter the B2B Component Name."); return; }
     if (!description.trim()) { alert("Please enter a Description."); return; }
     if (selectedMarketIds.length === 0) { alert("Please link to at least one Market Segment."); return; }
     if (selectedTagIds.length === 0) { alert("Please link to at least one Technical Function."); return; }

     setIsCheckingVentures(true);
     setSimilarVentures([]);
     console.log("Checking for similar ventures based on links:", { selectedMarketIds, selectedTagIds });

     try {
        const { data, error } = await supabase.rpc('find_similar_ventures', {
           p_market_ids: selectedMarketIds, p_tag_ids: selectedTagIds
        });
        if (error) throw error; // Let catch block handle it

        if (data && data.length > 0) {
           console.log("Found similar ventures:", data);
           setSimilarVentures(data);
           setShowVentureConfirm(true); // Show confirmation modal
        } else {
           console.log("No significant link overlaps found. Proceeding to submit.");
           await performSubmit(); // No overlaps, submit directly
        }
     } catch (error) {
          console.error("Error checking similar ventures via RPC:", error);
          const proceed = window.confirm(`Warning: Could not automatically check for similar ventures due to an error (${error.message}). Proceed with submission anyway?`);
          if (proceed) await performSubmit();
     } finally {
          setIsCheckingVentures(false);
     }
  };

  // Function to perform the final data submission to the database
  const performSubmit = async () => {
     if (isSubmitting) return;
     setIsSubmitting(true);
     setShowVentureConfirm(false);
     console.log("Submitting new venture:", { componentName, description, submitter, selectedMarketIds, selectedTagIds });

     try {
         const { data: newAppId, error } = await supabase.rpc('create_new_application', {
            app_name: componentName,
            app_desc: description,
            submitter: submitter || 'AGM Team',
            market_ids: selectedMarketIds,
            tag_ids: selectedTagIds
         });
         if (error) throw error; // Let catch block handle it

         alert(`New IP Venture "${componentName}" created successfully!`);
         onFinished(newAppId); // Pass the new ID back to App.jsx

     } catch (error) {
         console.error("Error creating new venture:", error);
         alert(`Error: ${error.message}`);
     } finally {
         setIsSubmitting(false);
     }
  };

  // --- JSX Rendering ---
  return (
    <> {/* Fragment needed for adjacent form and modal */}
      {/* Add class for styling, use form-container styles from index.css */}
      <form onSubmit={handlePreSubmitCheck} className="add-app-form form-container" style={{ margin: 0 /* Reset margin if container adds it */ }}>
        <h2 style={{marginTop: 0, marginBottom: 'var(--space-lg)'}}>+ Add New IP Venture</h2>

        {/* B2B Component Name */}
        <div className="form-group">
          <label htmlFor="componentNameInputAdd">B2B Component Name *</label>
          <input
            id="componentNameInputAdd"
            type="text"
            value={componentName}
            onChange={e => setComponentName(e.target.value)}
            required
            placeholder="Focus on B2B part (e.g., 'Conductive Coating for...', 'Composite Casing for...')"
            title="Enter the specific B2B component or material system AGM provides. Avoid end-product names (e.g., 'Smart Watch'). This name must be unique."
          />
        </div>

        {/* Similar App Name Warning */}
        {similarApps.length > 0 && (
          <div className="warning-box">
            <strong>⚠️ Possible Name Duplicate Found:</strong>
            <ul>
              {similarApps.map(app => (
                <li key={`${app.name}-${app.similarity}`}>{app.name} (Similarity: {app.similarity.toFixed(2)})</li>
              ))}
            </ul>
          </div>
        )}

        {/* Description */}
        <div className="form-group">
          <label htmlFor="descriptionInputAdd">Description *</label>
          <textarea
            id="descriptionInputAdd"
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={4}
            required
            placeholder="Explain application, AGM graphene benefit (why us?), potential patent angle (e.g., covalent bonding). Keywords trigger suggestions."
            title="Provide detail on the opportunity and strategic fit. Keywords like 'conductive', 'strength', 'barrier' trigger suggestions."
          />
        </div>

        {/* Ontology Suggestions */}
        {ontologySuggestions.length > 0 && (
           <div className="suggestion-box">
             <strong>🤖 AGM Brain Suggests Linking To Functions:</strong>
             <ul>
               {ontologySuggestions.slice(0, 5).map(tag => (
                 <li key={tag.id}>
                    {tag.name} <small>({tag.path})</small>
                 </li>
               ))}
                {ontologySuggestions.length > 5 && <li>... and more (see linker below)</li>}
             </ul>
             <small>Based on keywords. Please verify & select ALL relevant functions in the linker below.</small>
           </div>
         )}

        {/* Submitter */}
        <div className="form-group">
          <label htmlFor="submitterInputAdd">Submitted By</label>
          <input
            id="submitterInputAdd"
            type="text"
            value={submitter}
            onChange={e => setSubmitter(e.target.value)}
            placeholder="Your name or team (e.g., Kevin B.)"
            title="Identifies who initially proposed this venture idea."
          />
        </div>

        {/* Linkers - Using Grid Layout */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', /* Responsive columns */ gap: 'var(--space-lg)', margin: 'var(--space-lg) 0' }}>
          {/* Market Linker */}
          {/* Add wrapper div with class for styling */}
          <div className="TreeLinker-container form-group" title="Select ALL relevant market segments where this IP could be applied. Helps identify total addressable market and potential partners.">
            {/* Add label consistent with other form groups */}
            <label>Link to Markets *</label>
            <TreeLinker
              // title="Link to Markets *" // Title prop removed, using label instead
              rpcName="market_segments"
              initialSelection={selectedMarketIds} // Use state directly
              onSelectionChange={setSelectedMarketIds}
            />
          </div>
          {/* Ontology Linker */}
          <div className="TreeLinker-container form-group" title="Select ALL core technical functions/properties involved. Helps find similar ventures and assess strategic fit (Synergy score).">
             <label>Link to Technical Functions *</label>
            <TreeLinker
              // title="Link to Technical Functions *"
              rpcName="ontology_tags"
              initialSelection={selectedTagIds} // Use state directly
              onSelectionChange={setSelectedTagIds}
            />
          </div>
        </div>

        {/* Submit Button - Use Editorial Style */}
        <div className="form-actions" style={{justifyContent: 'flex-start'}}> {/* Align button left */}
            <button type="submit" className="btn-primary" disabled={isSubmitting || isCheckingVentures}>
              {isCheckingVentures ? 'Checking...' : (isSubmitting ? 'Submitting...' : 'Submit New Venture')}
            </button>
             {/* Optional: Add a cancel button */}
             <button type="button" className="btn-secondary" onClick={onFinished}>
                Cancel
             </button>
        </div>
      </form>

      {/* Strategy Alert Confirmation Modal */}
      {showVentureConfirm && (
          <div className="modal-overlay"> {/* Re-use modal styles */}
             <div className="modal-content" style={{maxWidth: '600px'}}>
                 <h2>Strategy Alert! ⚠️</h2>
                 <p>This new venture seems very similar to existing ones based on its Market & Technical Function links:</p>
                 <ul style={{ maxHeight: '200px', overflowY: 'auto', border:'1px solid #eee', padding:'10px', background:'#f8f9fa', marginBottom:'15px'}}>
                    {(similarVentures || []).map(v => (
                        <li key={v.app_id}>{v.component_name} (Overlap Score: {v.overlap_score ? v.overlap_score.toFixed(2) : 'N/A'})</li>
                    ))}
                 </ul>
                 <p><strong>Are you sure this is a distinct IP opportunity and not an improvement or variation of an existing venture?</strong></p>
                 <div className="form-actions">
                     <button onClick={performSubmit} className="btn-primary" disabled={isSubmitting}>
                        {isSubmitting ? 'Submitting...' : 'Yes, Proceed Anyway'}
                     </button>
                     <button onClick={() => setShowVentureConfirm(false)} className="btn-secondary">
                        Cancel
                     </button>
                 </div>
             </div>
          </div>
      )}

      {/* No need for embedded styles if using index.css */}
    </>
  );
}