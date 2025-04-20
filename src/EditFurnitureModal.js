import React, { useState, useEffect } from 'react';
import './EditFurnitureModal.css'; // We'll add styles later

function EditFurnitureModal({ item, onSave, onClose }) {
  const [name, setName] = useState('');
  const [color, setColor] = useState('#6496FF'); // Default color
  const [opacity, setOpacity] = useState(0.7); // Default opacity

  // Populate state when the item prop changes (modal opens)
  useEffect(() => {
    if (item) {
      setName(item.name || '');
      setColor(item.color || '#6496FF'); // Use item's color or default
      setOpacity(item.opacity !== undefined ? item.opacity : 0.7); // Use item's opacity or default
    }
  }, [item]);

  const handleSave = (e) => {
    e.preventDefault(); // Prevent default form submission
    if (!item) return;

    // Basic validation
    if (!name.trim()) {
        alert("Item name cannot be empty.");
        return;
    }
    if (opacity < 0 || opacity > 1) {
        alert("Opacity must be between 0 and 1.");
        return;
    }

    onSave(item.id, {
      name: name.trim(),
      color: color,
      opacity: parseFloat(opacity), // Ensure opacity is a number
    });
  };

  // Handle Escape key press to close modal
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);


  if (!item) {
    return null; // Don't render if no item is provided
  }

  return (
    <div className="modal-backdrop" onClick={onClose}> {/* Close on backdrop click */}
      <div className="modal-content" onClick={(e) => e.stopPropagation()}> {/* Prevent closing when clicking inside modal */}
        <h2>Edit Item: {item.name}</h2>
        <form onSubmit={handleSave}>
          <div className="form-group">
            <label htmlFor="edit-item-name">Name:</label>
            <input
              id="edit-item-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="edit-item-color">Color:</label>
            <input
              id="edit-item-color"
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
            />
             {/* Display hex code */}
             <span className="color-hex">{color}</span>
          </div>
          <div className="form-group">
            <label htmlFor="edit-item-opacity">Opacity (0.0 - 1.0):</label>
            <input
              id="edit-item-opacity"
              type="number"
              min="0"
              max="1"
              step="0.05"
              value={opacity}
              onChange={(e) => setOpacity(e.target.value)}
              required
            />
          </div>
          <div className="modal-actions">
            <button type="submit" className="save-button">Save Changes</button>
            <button type="button" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EditFurnitureModal;
