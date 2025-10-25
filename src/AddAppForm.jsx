// src/AddAppForm.jsx
import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { TreeLinker } from './TreeLinker';
// Import the ontology matcher utility
import { cacheOntologyTags, findOntologySuggestions } from './ontologyMatcher'; // Ensure this file exists and is populated

// Main Add Application Form component
export function AddAppForm({ onFinished, preSelectedMarketId = null, preSelectedOntologyId = null }) {
  // --- State Variables ---
  // Core form fields
  const [componentName, setComponentName] = useState('');
  const [description, setDescription] = useState('');
  const [submitter, setSubmitter] = useState('AGM Team'); // Default or get from user auth

  // State for the TreeLinker components
  const [selectedMarketIds, setSelectedMarketIds] = useState(preSelectedMarketId ? [preSelectedMarketId] : []);
  const [selectedTagIds, setSelectedTagIds] = useState(preSelectedOntologyId ? [preSelectedOntologyId] : []);

  // State for "AGM Brain" helpers
  const [similarApps, setSimilarApps] = useState([]); // Stores results from name similarity check
  const [ontologySuggestions, setOntologySuggestions] = useState([]); // Stores tag suggestions based on keywords
  const [similarVentures, setSimilarVentures] = useState([]); // Stores results from link overlap check
  const [showVentureConfirm, setShowVentureConfirm] = useState(false); // Controls the strategy alert modal

  // Loading/Submitting state flags
  const [isCheckingVentures, setIsCheckingVentures] = useState(false); // Loading for pre-submit check
  const [isSubmitting, setIsSubmitting] = useState(false); // Loading for final submission

  // --- Effects ---

  // Cache Ontology Tags on component mount for keyword suggestions
  useEffect(() => {
    cacheOntologyTags(supabase); // Call the caching function from the matcher utility
  }, []); // Empty dependency array ensures it runs only once

  // Debounced Duplicate Application Name Check (Helper 1a)
  useEffect(() => {
    // Only run check if name is reasonably long
    if (componentName.trim().length < 4) {
      setSimilarApps([]); // Clear previous suggestions if name is too short
      return; // Exit early
    }
    // Set up a timer to delay the check
    const debounceTimer = setTimeout(async () => {
      console.log(`Checking name similarity for: "${componentName}"`);
      // Call the Supabase RPC function to get similar names
      const { data, error } = await supabase.rpc('get_similar_apps', { query_name: componentName });
      if (error) {
          console.error("Error checking similar app names:", error);
          setSimilarApps([]); // Clear suggestions on error
      } else {
          setSimilarApps(data || []); // Update state with results (or empty array)
      }
    }, 400); // 400ms delay after user stops typing

    // Cleanup function: Clear the timer if component unmounts or name changes again
    return () => clearTimeout(debounceTimer);
  }, [componentName]); // Dependency array: Rerun effect only when componentName changes

  // Debounced Ontology Tag Suggestions based on Name and Description (Helper 1b)
  useEffect(() => {
    const textToAnalyze = `${componentName} ${description}`.trim();
    // Only run if there's enough text to analyze
    if (textToAnalyze.length < 5) {
      setOntologySuggestions([]); // Clear suggestions if input is too short
      return; // Exit early
    }
    // Set up a timer to delay suggestion generation
    const debounceTimer = setTimeout(() => {
        console.log("Finding ontology suggestions for:", textToAnalyze);
        // Call the suggestion function from the matcher utility
        const suggestions = findOntologySuggestions(textToAnalyze);
        setOntologySuggestions(suggestions); // Update state with suggestions
    }, 500); // 500ms delay

    // Cleanup function: Clear the timer
    return () => clearTimeout(debounceTimer);
  }, [componentName, description]); // Dependency array: Rerun effect if name or description changes


  // --- Event Handlers ---

  // Handler for the main form submission (triggers pre-check first)
  const handlePreSubmitCheck = async (e) => {
     e.preventDefault(); // Prevent standard HTML form submission
     // Prevent multiple submissions or checks running concurrently
     if (isSubmitting || isCheckingVentures) return;

     // Basic client-side validation
     if (!componentName.trim()) {
         alert("Please enter the B2B Component Name.");
         return;
     }
     if (!description.trim()) {
          alert("Please enter a Description.");
          return;
     }
      if (selectedMarketIds.length === 0) {
          alert("Please link to at least one Market Segment.");
          return;
      }
       if (selectedTagIds.length === 0) {
           alert("Please link to at least one Technical Function (Ontology Tag).");
           return;
       }

     // Start the pre-check loading state
     setIsCheckingVentures(true);
     setSimilarVentures([]); // Clear previous check results

     console.log("Checking for similar ventures based on links:", { selectedMarketIds, selectedTagIds });
     // Call the Supabase RPC to find ventures with overlapping links
     const { data, error } = await supabase.rpc('find_similar_ventures', {
        p_market_ids: selectedMarketIds,
        p_tag_ids: selectedTagIds
     });

     setIsCheckingVentures(false); // End the pre-check loading state

     if (error) {
         console.error("Error checking similar ventures via RPC:", error);
         // Decide how to handle this - For robustness, let's allow submission but warn the user.
         const proceed = window.confirm("Warning: Could not automatically check for similar ventures due to an error. Proceed with submission anyway?");
         if (proceed) {
             await performSubmit(); // Proceed if user confirms
         }
     } else if (data && data.length > 0) {
         // Found potentially overlapping ventures - show the confirmation modal
         console.log("Found similar ventures:", data);
         setSimilarVentures(data);
         setShowVentureConfirm(true); // Open the modal
     } else {
         // No overlaps found - proceed directly to final submission
         console.log("No significant link overlaps found. Proceeding to submit.");
         await performSubmit();
     }
  };

  // Function to perform the final data submission to the database
  const performSubmit = async () => {
     // Prevent multiple submissions
     if (isSubmitting) return;
     setIsSubmitting(true); // Start final submission loading state
     setShowVentureConfirm(false); // Ensure confirmation modal is closed

     console.log("Submitting new venture:", { componentName, description, submitter, selectedMarketIds, selectedTagIds });
     // Call the Supabase RPC to create the application, metrics, and links in one transaction
     const { data: newAppId, error } = await supabase.rpc('create_new_application', {
        app_name: componentName,
        app_desc: description,
        submitter: submitter || 'AGM Team', // Use default if submitter is empty
        market_ids: selectedMarketIds,
        tag_ids: selectedTagIds
     });

     setIsSubmitting(false); // End final submission loading state

     if (error) {
        console.error("Error creating new venture:", error);
        alert(`Error: ${error.message}`); // Show specific error to user
     } else {
        alert(`New IP Venture "${componentName}" created successfully!`); // Confirmation message
        onFinished(); // Call the callback provided by App.jsx to close form and refetch data
     }
  };


  // --- JSX Rendering ---
  return (
    // Use React Fragment <> to allow adjacent elements (form and modal)
    <>
      {/* Main Form Element */}
      {/* Add class for potential styling hooks */}
      <form onSubmit={handlePreSubmitCheck} className="add-app-form" style={{ padding: '20px' /* Remove redundant styles if using container */ }}>
        <h2 style={{marginTop: 0}}>+ Add New IP Venture</h2>

        {/* B2B Component Name Input */}
        <div className="form-group">
          <label htmlFor="componentNameInput">B2B Component Name *</label>
          <input
            id="componentNameInput" // Use unique ID for label association
            type="text"
            value={componentName}
            onChange={e => setComponentName(e.target.value)}
            required
            placeholder="Focus on B2B part (e.g., 'Conductive Coating for...', 'Composite Casing for...')"
            title="Enter the specific B2B component or material system AGM provides. Avoid end-product names (e.g., 'Smart Watch'). This name must be unique."
          />
        </div>

        {/* Similar App Name Warning (Helper 1a) */}
        {similarApps.length > 0 && (
          <div className="warning-box">
            <strong>⚠️ Possible Name Duplicate Found:</strong>
            <ul>
              {similarApps.map(app => (
                // Use unique key, app.name might not be unique if similarity score differs
                <li key={`${app.name}-${app.similarity}`}>{app.name} (Similarity: {app.similarity.toFixed(2)})</li>
              ))}
            </ul>
          </div>
        )}

        {/* Description Textarea */}
        <div className="form-group">
          <label htmlFor="descriptionInput">Description *</label>
          <textarea
            id="descriptionInput"
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={4} // Slightly smaller default height
            required
            placeholder="Explain application, AGM graphene benefit (why us?), potential patent angle (e.g., covalent bonding). Keywords trigger suggestions."
            title="Provide detail on the opportunity and strategic fit. Keywords like 'conductive', 'strength', 'barrier' trigger suggestions."
          />
        </div>

        {/* Ontology Suggestions Box (Helper 1b) */}
        {ontologySuggestions.length > 0 && (
           <div className="suggestion-box">
             <strong>🤖 AGM Brain Suggests Linking To Functions:</strong>
             <ul>
               {ontologySuggestions.slice(0, 5).map(tag => ( // Show top 5 suggestions
                 <li key={tag.id}>
                    {tag.name} <small>({tag.path})</small>
                    {/* Potential: Add button to auto-check this tag in linker below */}
                 </li>
               ))}
                {ontologySuggestions.length > 5 && <li>... and more (see linker below)</li>}
             </ul>
             <small>Based on keywords. Please verify & select ALL relevant functions in the linker below.</small>
           </div>
         )}

        {/* Submitter Input */}
        <div className="form-group">
          <label htmlFor="submitterInput">Submitted By</label>
          <input
            id="submitterInput"
            type="text"
            value={submitter}
            onChange={e => setSubmitter(e.target.value)}
            placeholder="Your name or team (e.g., Kevin B.)"
            title="Identifies who initially proposed this venture idea."
          />
        </div>

        {/* Market and Ontology Linkers using TreeLinker Component */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', margin: '20px 0' }}>
          {/* Market Linker */}
          <div className="TreeLinker-container" title="Select ALL relevant market segments where this IP could be applied. Helps identify total addressable market and potential partners.">
            <TreeLinker
              title="Link to Markets *"
              rpcName="market_segments" // Tells TreeLinker which table to fetch
              // Pass pre-selected ID if provided by App.jsx
              initialSelection={preSelectedMarketId ? [preSelectedMarketId] : []}
              // Callback to update selectedMarketIds state in this form
              onSelectionChange={setSelectedMarketIds}
            />
          </div>
          {/* Ontology (Technical Function) Linker */}
          <div className="TreeLinker-container" title="Select ALL core technical functions/properties involved. Helps find similar ventures and assess strategic fit (Synergy score).">
            <TreeLinker
              title="Link to Technical Functions *"
              rpcName="ontology_tags" // Tells TreeLinker which table to fetch
              // Pass pre-selected ID if provided (optional)
              initialSelection={preSelectedOntologyId ? [preSelectedOntologyId] : []}
              // Callback to update selectedTagIds state in this form
              onSelectionChange={setSelectedTagIds}
            />
          </div>
        </div>

        {/* Submit Button */}
        <button type="submit" disabled={isSubmitting || isCheckingVentures} style={{fontSize: '1em', padding: '10px 15px', cursor: 'pointer'}}>
          {/* Dynamically change button text based on state */}
          {isCheckingVentures ? 'Checking for overlaps...' : (isSubmitting ? 'Submitting...' : 'Submit New Venture')}
        </button>
      </form>

      {/* Strategy Alert Confirmation Modal (Helper 2) */}
      {showVentureConfirm && (
          <div className="modal-backdrop"> {/* Re-use modal styles */}
             <div className="modal-content" style={{maxWidth: '600px'}}>
                 <h2>Strategy Alert! ⚠️</h2>
                 <p>This new venture seems very similar to existing ones based on its Market & Technical Function links:</p>
                 {/* List of similar ventures found */}
                 <ul style={{ maxHeight: '200px', overflowY: 'auto', border:'1px solid #eee', padding:'10px', background:'#f8f9fa', marginBottom:'15px'}}>
                    {(similarVentures || []).map(v => (
                        <li key={v.app_id}>{v.component_name} (Overlap: {v.overlap_score ? v.overlap_score.toFixed(2) : 'N/A'})</li>
                    ))}
                 </ul>
                 <p><strong>Are you sure this is a distinct IP opportunity and not an improvement or variation of an existing venture?</strong></p>
                 {/* Modal Action Buttons */}
                 <div className="modal-actions">
                     {/* Button to proceed with submission */}
                     <button onClick={performSubmit} className="save-button" disabled={isSubmitting}>
                        {isSubmitting ? 'Submitting...' : 'Yes, Proceed Anyway'}
                     </button>
                     {/* Button to cancel submission and close modal */}
                     <button onClick={() => setShowVentureConfirm(false)} className="cancel-button">
                        Cancel
                     </button>
                 </div>
             </div>
          </div>
      )}

      {/* Embedded styles for warning/suggestion boxes (can move to CSS file) */}
      <style jsx global>{`
        .warning-box, .suggestion-box {
            color: #856404; /* Dark yellow text */
            background-color: #fff3cd; /* Light yellow background */
            border: 1px solid #ffeeba; /* Yellow border */
            padding: 10px 15px;
            margin-bottom: 15px;
            border-radius: 4px;
            font-size: 0.9em;
        }
        .warning-box ul, .suggestion-box ul {
            margin-top: 5px;
            margin-bottom: 5px;
            padding-left: 20px; /* Indent list items */
        }
        .warning-box strong { color: #721c24; } /* Darker red for warning emphasis */
        .suggestion-box strong { color: #004085; } /* Darker blue for suggestion emphasis */
        .suggestion-box small { color: #6c757d; display: block; margin-top: 5px;} /* Gray text for notes */
      `}</style>
    </>
  );
}