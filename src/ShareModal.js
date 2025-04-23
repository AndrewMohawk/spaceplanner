import React, { useState } from 'react';
import './ShareModal.css';

function ShareModal({ onClose, onShare, layoutData, floorplanImage }) {
  const [includeScale, setIncludeScale] = useState(true);
  const [includeFurniture, setIncludeFurniture] = useState(true);
  const [title, setTitle] = useState('My Floor Plan');
  const [isGenerating, setIsGenerating] = useState(false);
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    setIsGenerating(true);
    
    try {
      // Call the parent's onShare function with configuration options
      await onShare({
        includeScale,
        includeFurniture,
        title
      });
      
      // Close modal after successful share
      onClose();
    } catch (error) {
      console.error('Error sharing layout:', error);
      alert('Failed to share layout. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content share-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Share Floor Plan</h2>
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="share-title">Title:</label>
            <input
              id="share-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>
          
          <div className="share-options">
            <div className="form-group checkbox-group">
              <label>
                <input 
                  type="checkbox" 
                  checked={includeScale} 
                  onChange={(e) => setIncludeScale(e.target.checked)}
                />
                Include Scale Information
              </label>
            </div>
            
            <div className="form-group checkbox-group">
              <label>
                <input 
                  type="checkbox" 
                  checked={includeFurniture} 
                  onChange={(e) => setIncludeFurniture(e.target.checked)}
                />
                Include Furniture List
              </label>
            </div>
          </div>
          
          <div className="modal-actions">
            <button 
              type="submit" 
              className="share-button"
              disabled={isGenerating}
            >
              {isGenerating ? 'Generating...' : 'Generate Shareable Image'}
            </button>
            <button type="button" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ShareModal; 