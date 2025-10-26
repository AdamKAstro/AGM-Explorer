// src/InfoModal.jsx
import React from 'react';
// Your index.css has all the styles

export function InfoModal({ title, content, onClose }) {
  return (
    <div className="modal-overlay"> {/* Corrected: Use modal-overlay */}
      <div className="modal-content">
        
        {/* Added modal-header for proper structure */}
        <div className="modal-header">
          <h2>{title} ℹ️</h2>
          <button onClick={onClose} className="modal-close" title="Close Info">&times;</button> {/* Corrected: Use modal-close */}
        </div>
        
        {/* Corrected: Use modal-body */}
        <div className="modal-body">
          {content}
        </div>
        
        {/* Corrected: Use form-actions and btn-secondary */}
        <div className="form-actions" style={{ justifyContent: 'flex-end' }}>
           <button onClick={onClose} className="btn-secondary">Close</button>
        </div>
      </div>
    </div>
  );
}