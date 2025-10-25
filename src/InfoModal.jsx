// src/InfoModal.jsx
import React from 'react';
//import './Modal.css'; // We'll create this CSS file

export function InfoModal({ title, content, onClose }) {
  return (
    <div className="modal-backdrop info-modal-backdrop">
      <div className="modal-content info-modal-content">
        <h2>{title} <span style={{fontSize: '0.8em', fontWeight:'normal'}}>ℹ️</span></h2>
        <button onClick={onClose} className="close-button info-close-button" title="Close Info">&times;</button>
        <div className="info-modal-body">
          {content}
        </div>
        <div className="modal-actions info-modal-actions">
           <button onClick={onClose} className="cancel-button">Close</button>
        </div>
      </div>
    </div>
  );
}