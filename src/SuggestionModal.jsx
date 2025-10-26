// src/SuggestionModal.jsx
import React, { useState } from 'react';
import { supabase } from './supabase';
// Assuming modal styles are in index.css

export function SuggestionModal({ itemType, itemId, itemName, onClose }) {
  const [suggestionText, setSuggestionText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!suggestionText.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const { error } = await supabase.rpc('submit_suggestion', {
        p_target_type: itemType,
        p_target_id: itemId,
        p_target_name: itemName,
        p_suggestion_text: suggestionText,
      });

      if (error) throw error;

      setSuccessMsg("Suggestion submitted successfully! Adam will review it.");
      setSuggestionText(''); // Clear text area

      // ** MODIFICATION: **
      // We no longer automatically close. We let the user see the
      // success message and click "Done".
      // setTimeout(onClose, 2000); 

    } catch (err) {
      console.error("Error submitting suggestion:", err);
      setErrorMsg(`Failed to submit suggestion: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Construct context string
  const contextString = `${itemType ? itemType.charAt(0).toUpperCase() + itemType.slice(1) : 'Item'}: ${itemName || 'N/A'} (ID: ${itemId || 'N/A'})`;

  return (
    // Use the CSS classes you defined in index.css
    <div className="modal-overlay">
      <div className="modal-content" style={{maxWidth: '600px'}}>
        <div className="modal-header">
          <h2>Suggest a Change 📝</h2>
          <button onClick={onClose} className="modal-close" title="Close">&times;</button>
        </div>

        <div className="modal-body">
          <p style={{fontFamily: 'var(--font-serif)', fontStyle: 'italic', color: 'var(--text-secondary)', marginTop: '-1.5rem', marginBottom: '1rem'}}>
            Regarding: {contextString}
          </p>
          
          {/* Show EITHER the form OR the success message */}

          {!successMsg ? (
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="suggestionText">Your Suggestion:</label>
                <textarea
                  id="suggestionText"
                  rows={5}
                  value={suggestionText}
                  onChange={(e) => setSuggestionText(e.target.value)}
                  placeholder="e.g., 'Typo in name', 'Merge with application XYZ', 'Link to Polymers market', 'Update market size based on [source]...'"
                  required
                />
              </div>

              {errorMsg && <p className="error-message">{errorMsg}</p>}

              <div className="form-actions">
                <button type="submit" className="btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Submitting...' : 'Submit Suggestion'}
                </button>
                <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
              </div>
            </form>
          ) : (
            <div>
              {/* This will now be visible thanks to the CSS we added */}
              <p className="success-message">{successMsg}</p>
              
              <div className="form-actions" style={{justifyContent: 'flex-end'}}>
                <button type="button" onClick={onClose} className="btn-primary">
                  Done
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}