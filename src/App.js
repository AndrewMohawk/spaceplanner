import React, { useState, useCallback, useEffect, useRef } from 'react';
import Toolbar from './Toolbar';
import FloorPlanCanvas from './FloorPlanCanvas';
import EditFurnitureModal from './EditFurnitureModal'; // Import the modal
import ShareModal from './ShareModal'; // Import the share modal
import {
    saveScaleForImage,
    getScaleForImage,
    saveCustomFurnitureTemplates,
    loadCustomFurnitureTemplates
} from './localStorageUtils';
import './App.css';

// Default furniture items (dimensions in inches) - Keep these hardcoded as the base
const DEFAULT_FURNITURE_TEMPLATES = [
  { id: 'couch-1', name: 'Sofa (3-seat)', width: 84, height: 38, isDefault: true, color: '#4A7AFF', opacity: 0.7 },
  { id: 'chair-1', name: 'Armchair', width: 35, height: 35, isDefault: true, color: '#749AF5', opacity: 0.7 },
  { id: 'bed-q', name: 'Bed (Queen)', width: 60, height: 80, isDefault: true, color: '#F57AB8', opacity: 0.7 },
  { id: 'bed-k', name: 'Bed (King)', width: 76, height: 80, isDefault: true, color: '#E54999', opacity: 0.7 },
  { id: 'desk-1', name: 'Desk', width: 48, height: 24, isDefault: true, color: '#B07D45', opacity: 0.7 },
  { id: 'table-dr', name: 'Dining Table (6)', width: 60, height: 36, isDefault: true, color: '#8B5E3C', opacity: 0.7 },
  { id: 'bookshelf-1', name: 'Bookshelf', width: 36, height: 12, isDefault: true, color: '#7A5230', opacity: 0.7 },
  { id: 'chair-desk', name: 'Desk Chair', width: 24, height: 24, isDefault: true, color: '#9BBCF9', opacity: 0.7 },
  { id: 'tv-cabinet', name: 'TV Cabinet', width: 60, height: 18, isDefault: true, color: '#6B4226', opacity: 0.7 },
  { id: 'bedside-table', name: 'Bedside Table', width: 20, height: 20, isDefault: true, color: '#A67C52', opacity: 0.7 },
];

// Utility function to generate a random color
const getRandomColor = () => {
  const colors = ['#4A7AFF', '#749AF5', '#F57AB8', '#E54999', '#B07D45', '#8B5E3C', '#7A5230', '#9BBCF9', '#6B4226', '#A67C52'];
  return colors[Math.floor(Math.random() * colors.length)];
};

// Helper function to parse dimension strings (e.g., "10'", "5'6", "7.5'", "72") into inches
// Copied from Toolbar.js to ensure consistent parsing
function parseDimensionString(input) {
  if (!input) return null;
  
  // Remove all whitespace
  input = input.replace(/\s+/g, '');
  
  // Check if the input is a simple number (interpreted as inches)
  if (/^\d+(\.\d+)?$/.test(input)) {
    return parseFloat(input);
  }
  
  // Check for feet and inches notation: e.g., 5'6", 5'6, 5', etc.
  const feetInchesPattern = /^(\d+(?:\.\d+)?)'(?:(\d+(?:\.\d+)?)(?:"))?$/;
  const feetInchesMatch = input.match(feetInchesPattern);
  
  if (feetInchesMatch) {
    const feet = parseFloat(feetInchesMatch[1]) || 0;
    const inches = parseFloat(feetInchesMatch[2] || '0');
    return feet * 12 + inches;
  }
  
  // Check for inches notation with double quote: e.g., 5", 5.5"
  const inchesPattern = /^(\d+(?:\.\d+)?)"$/;
  const inchesMatch = input.match(inchesPattern);
  
  if (inchesMatch) {
    return parseFloat(inchesMatch[1]);
  }
  
  // Return null for invalid input
  return null;
}

// New ScaleInstructionModal component
const ScaleInstructionModal = ({ onClose, onStartScale, dontShowAgain, onDontShowAgainChange }) => {
  return (
    <div className="modal-backdrop">
      <div className="scale-instruction-modal">
        <h2>Set Scale for Your Floor Plan</h2>
        
        <div className="scale-instructions">
          <p>To accurately place furniture, we need to know the scale of your floor plan.</p>
          
          <ol>
            <li>You'll need to mark a known distance on your floor plan.</li>
            <li>Click on the first point of a wall or feature where you know the real-world length.</li>
            <li>Click on the second point to complete the line.</li>
            <li>Enter the actual real-world length (e.g., 10' or 120").</li>
          </ol>
          
          <p className="scale-tip">Tip: Use a wall with a known length for the most accurate results.</p>
        </div>
        
        <div className="scale-modal-footer">
          <label className="dont-show-again">
            <input 
              type="checkbox" 
              checked={dontShowAgain} 
              onChange={onDontShowAgainChange}
            />
            Don't show this again
          </label>
          
          <div className="scale-modal-buttons">
            <button className="secondary-button" onClick={onClose}>
              Cancel
            </button>
            <button className="primary-button" onClick={onStartScale}>
              Start Setting Scale
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Helper function to calculate distance (between points in original image pixel space)
const getDistance = (p1, p2) => {
  if (!p1 || !p2) return 0;
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
};

// Helper function to generate a hash from file content
// This provides a content-based identifier for floorplan images,
// ensuring that identical images can be recognized even if filenames differ.
// The hash is based on the actual file content rather than just the filename.
const generateFileHash = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        // Use SubtleCrypto API to create SHA-256 hash of file content
        const arrayBuffer = event.target.result;
        crypto.subtle.digest('SHA-256', arrayBuffer)
          .then(hashBuffer => {
            // Convert hash to hex string
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
            resolve(hashHex);
          });
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = (error) => reject(error);
    reader.readAsArrayBuffer(file);
  });
};

// Helper function to trigger JSON download using Blob and Object URL
function downloadJson(data, filename) {
  let objectUrl = null;
  try {
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (error) {
      console.error("Error creating download link:", error);
      alert("Failed to initiate download.");
  } finally {
      if (objectUrl) {
          setTimeout(() => URL.revokeObjectURL(objectUrl), 100);
      }
  }
}

// Empty state component that shows when no floor plan is loaded
const EmptyState = ({ onUpload }) => (
  <div className="empty-state">
    <div className="logo-container">
      <img src="/spaceplanner-logo.png" alt="SpacePlanner Logo" className="app-logo" />
    </div>
    <p>Upload a floor plan image to get started arranging furniture</p>
    <button className="upload-button" onClick={onUpload}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
        <polyline points="17 8 12 3 7 8"></polyline>
        <line x1="12" y1="3" x2="12" y2="15"></line>
      </svg>
      Upload Floor Plan Image
    </button>
  </div>
);

// Footer component with social links and bubbles animation
const Footer = () => {
  const textRef = useRef(null);
  
  useEffect(() => {
    if (!textRef.current) return;
    
    // Function to create a bubble
    const createBubble = () => {
      const bubble = document.createElement('div');
      bubble.className = 'bubble';
      
      // Random position
      const left = 10 + Math.random() * 80; // between 10% and 90%
      bubble.style.left = `${left}%`;
      
      // Random size (5-10px)
      const size = 5 + Math.random() * 5;
      bubble.style.width = `${size}px`;
      bubble.style.height = `${size}px`;
      
      // Random animation duration (3-5s)
      const duration = 3 + Math.random() * 2;
      bubble.style.animationDuration = `${duration}s`;
      
      // Add bubble to DOM
      textRef.current.appendChild(bubble);
      
      // Remove bubble after animation completes
      setTimeout(() => {
        if (textRef.current && textRef.current.contains(bubble)) {
          textRef.current.removeChild(bubble);
        }
      }, duration * 1000);
    };
    
    // Create bubbles at random intervals
    const bubbleInterval = setInterval(() => {
      createBubble();
    }, 500);
    
    // Clean up
    return () => clearInterval(bubbleInterval);
  }, []);
  
  return (
    <div className="footer">
      <div className="footer-content">
        <span className="footer-text" ref={textRef}>
          <strong>Vibed'</strong> by <span className="footer-name">AndrewMohawk</span>
        </span>
        <div className="social-links">
          <a href="https://twitter.com/AndrewMohawk" target="_blank" rel="noopener noreferrer" title="Twitter/X" className="twitter-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z"></path>
            </svg>
          </a>
          <a href="https://github.com/AndrewMohawk" target="_blank" rel="noopener noreferrer" title="GitHub" className="github-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path>
            </svg>
          </a>
          <a href="mailto:spaceplanner@andrewmohawk.com" title="Email" className="email-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
              <polyline points="22,6 12,13 2,6"></polyline>
            </svg>
          </a>
        </div>
      </div>
    </div>
  );
};

function App() {
  const [floorplanImage, setFloorplanImage] = useState(null); // Can be File or URL string
  const [floorplanImageId, setFloorplanImageId] = useState(null);
  const [isSettingScale, setIsSettingScale] = useState(false);
  const [scaleState, setScaleState] = useState({ points: [], pixelLength: 0 });
  const [scaleInput, setScaleInput] = useState('');
  const [pixelsPerInch, setPixelsPerInch] = useState(null);
  const [furniture, setFurniture] = useState([]);
  const [selectedFurnitureId, setSelectedFurnitureId] = useState(null);
  const [availableFurnitureTemplates, setAvailableFurnitureTemplates] = useState([
      ...DEFAULT_FURNITURE_TEMPLATES
  ]);
  const [pendingScaleConfirmation, setPendingScaleConfirmation] = useState(null);
  const importFileRef = useRef(null);
  const uploadInputRef = useRef(null);
  const stageRef = useRef(null);
  const floorplanCanvasRef = useRef(null);
  
  // Status message state
  const [statusMessage, setStatusMessage] = useState('');
  
  // Scale instruction modal state
  const [showScaleInstructionModal, setShowScaleInstructionModal] = useState(false);
  const [dontShowScaleInstructions, setDontShowScaleInstructions] = useState(
    localStorage.getItem('dontShowScaleInstructions') === 'true'
  );
  
  // State for Edit Modal
  const [editingItemId, setEditingItemId] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  // State for Copy/Paste
  const [copiedItemData, setCopiedItemData] = useState(null);
  // State for Share button enablement
  const canShare = floorplanImage instanceof File && pixelsPerInch !== null;

  // State for Share Modal
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  // Load custom furniture templates on initial mount
  useEffect(() => {
    const loadedCustomTemplates = loadCustomFurnitureTemplates();
    // Ensure loaded templates also have default color/opacity if missing
    const customWithDefaults = loadedCustomTemplates.map(t => ({
        ...t,
        color: t.color || '#AAAAAA', // Default grey for custom
        opacity: t.opacity !== undefined ? t.opacity : 0.7,
      isCustom: true
    }));
    setAvailableFurnitureTemplates([
        ...DEFAULT_FURNITURE_TEMPLATES,
        ...customWithDefaults
    ]);
  }, []);

  // Update custom templates when floorplanImageId changes
  useEffect(() => {
    if (floorplanImageId) {
      const allCustomTemplates = loadCustomFurnitureTemplates();
      // Filter to include only global templates and those specific to the current image
      const filteredCustomTemplates = allCustomTemplates.filter(template => 
        template.isGlobal || template.imageId === floorplanImageId
      );
      
      // Ensure templates have default properties
      const customWithDefaults = filteredCustomTemplates.map(t => ({
        ...t,
        color: t.color || '#AAAAAA',
        opacity: t.opacity !== undefined ? t.opacity : 0.7,
        isCustom: true
      }));
      
      setAvailableFurnitureTemplates([
        ...DEFAULT_FURNITURE_TEMPLATES,
        ...customWithDefaults
      ]);
    }
  }, [floorplanImageId]);

  // Effect to show confirmation dialog when pendingScaleConfirmation is set
  useEffect(() => {
    if (pendingScaleConfirmation) {
      const { identifier, scale } = pendingScaleConfirmation;
      const imageName = identifier.split('|')[0] || 'this image';
      const useExisting = window.confirm(
        `A scale (${scale.toFixed(2)} px/inch) was previously saved for ${imageName}. Do you want to use it?`
      );
      if (useExisting) {
        setPixelsPerInch(scale);
        setScaleState({ points: [], pixelLength: 0 });
        setScaleInput('');
      } else {
        setPixelsPerInch(null);
        // Show scale instructions if not dismissed previously
        if (!dontShowScaleInstructions) {
          setShowScaleInstructionModal(true);
        } else {
          setIsSettingScale(true);
        }
      }
      setPendingScaleConfirmation(null);
    }
  }, [pendingScaleConfirmation, dontShowScaleInstructions]);

  // Define handleDeleteFurniture BEFORE the useEffect that uses it
  const handleDeleteFurniture = useCallback((idToDelete) => {
    setFurniture(prev => prev.filter(item => item.id !== idToDelete));
    setSelectedFurnitureId(prevSelectedId => (prevSelectedId === idToDelete ? null : prevSelectedId));
  }, []);

  // Effect for handling keyboard delete
  useEffect(() => {
    const handleKeyDown = (event) => {
      const targetTagName = event.target.tagName;
      const isInputFocused = targetTagName === 'INPUT' || targetTagName === 'TEXTAREA';

      // Prevent delete if modal is open
      if (isEditModalOpen) return;

      if (!isInputFocused && selectedFurnitureId && (event.key === 'Delete' || event.key === 'Backspace')) {
        event.preventDefault();
        handleDeleteFurniture(selectedFurnitureId);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
    // Add isEditModalOpen to dependencies
  }, [selectedFurnitureId, handleDeleteFurniture, isEditModalOpen]);

  // --- Copy / Paste Logic ---
  const handleCopyItem = useCallback(() => {
      if (!selectedFurnitureId) return;
      const itemToCopy = furniture.find(item => item.id === selectedFurnitureId);
      if (itemToCopy) {
          setCopiedItemData({ ...itemToCopy }); // Store a copy of the item's data
          console.log("Copied item:", itemToCopy.name);
          // Optionally provide user feedback (e.g., brief message)
      }
  }, [selectedFurnitureId, furniture]);

  const handlePasteItem = useCallback(() => {
      if (!copiedItemData || pixelsPerInch === null) return;

      // Create a new unique ID
      const templatePrefix = copiedItemData.id.substring(0, copiedItemData.id.lastIndexOf('-')) || 'paste';
      const uniqueId = `${templatePrefix}-${Date.now()}`;

      const newItem = {
          ...copiedItemData, // Copy all properties (name, w, h, color, opacity, rotation)
          id: uniqueId,
          // Offset the pasted item slightly
          x: copiedItemData.x + (20 / pixelsPerInch),
          y: copiedItemData.y + (20 / pixelsPerInch),
      };
      setFurniture(prev => [...prev, newItem]);
      setSelectedFurnitureId(uniqueId); // Select the newly pasted item
      console.log("Pasted item:", newItem.name);
  }, [copiedItemData, pixelsPerInch]);

  // Effect for handling Copy/Paste keyboard shortcuts
  useEffect(() => {
      const handleKeyDown = (event) => {
          const targetTagName = event.target.tagName;
          const isInputFocused = targetTagName === 'INPUT' || targetTagName === 'TEXTAREA';

          // Prevent copy/paste if modal is open
          if (isEditModalOpen) return;

          // Check for Ctrl+C or Cmd+C
          if ((event.ctrlKey || event.metaKey) && event.key === 'c') {
              if (!isInputFocused && selectedFurnitureId) {
                  event.preventDefault();
                  handleCopyItem();
              }
          }

          // Check for Ctrl+V or Cmd+V
          if ((event.ctrlKey || event.metaKey) && event.key === 'v') {
              if (!isInputFocused && copiedItemData) {
                  event.preventDefault();
                  handlePasteItem();
              }
          }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => {
          window.removeEventListener('keydown', handleKeyDown);
      };
      // Add dependencies
  }, [selectedFurnitureId, copiedItemData, handleCopyItem, handlePasteItem, isEditModalOpen]);


  const handleImageUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    // Check if this is a JSON file
    if (file.name.endsWith('.json') || file.name.endsWith('.floorplan')) {
      // Handle as a layout import
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const importedData = JSON.parse(e.target.result);
          if (!importedData || typeof importedData !== 'object' || !importedData.imageId || typeof importedData.pixelsPerInch !== 'number' || !Array.isArray(importedData.furniture)) {
            throw new Error("Invalid JSON layout file format.");
          }
          
          // If we already have an image loaded, check if it matches
          if (floorplanImage && importedData.imageId !== floorplanImageId) {
            const currentImageName = floorplanImageId?.split('|')[0] || 'current image';
            const importedImageName = importedData.imageId.split('|')[0] || 'imported layout';
            alert(`Import failed: Layout is for "${importedImageName}", but current image is "${currentImageName}". Upload the correct image first or clear the current image.`);
            if (uploadInputRef.current) uploadInputRef.current.value = "";
            return;
          }

          // Ensure imported items have default color/opacity if missing from older exports
          const furnitureWithDefaults = importedData.furniture.map(item => ({
            ...item,
            color: item.color || '#AAAAAA', // Default grey if missing
            opacity: item.opacity !== undefined ? item.opacity : 0.7, // Default opacity if missing
          }));

          // Extract custom templates from imported furniture
          addCustomTemplatesFromImport(furnitureWithDefaults, importedData.imageId);

          setPixelsPerInch(importedData.pixelsPerInch);
          setFurniture(furnitureWithDefaults);
          
          // If importing over empty state, set the image ID but warn user
          if (!floorplanImageId) {
            setFloorplanImageId(importedData.imageId);
            setFloorplanImage(null);
            alert("Layout data imported successfully. Please upload the corresponding floor plan image.");
          } else {
            alert("Layout imported successfully!");
          }
          
          setSelectedFurnitureId(null);
          setIsSettingScale(false);
          setScaleState({ points: [], pixelLength: 0 });
          setScaleInput('');
          setPendingScaleConfirmation(null);
          setCopiedItemData(null); // Clear clipboard on import
        } catch (error) {
          console.error("Error importing layout:", error);
          alert(`Failed to import layout: ${error.message}`);
        } finally {
          if (uploadInputRef.current) uploadInputRef.current.value = "";
        }
      };
      reader.onerror = (e) => {
        console.error("Error reading file:", e);
        alert("Failed to read the selected file.");
        if (uploadInputRef.current) uploadInputRef.current.value = "";
      };
      reader.readAsText(file);
      return;
    }
    
    // Handle as an image upload - Use hash instead of filename
    // Show loading indicator or message
    setFloorplanImage(null);
    setFloorplanImageId("loading...");
    
    generateFileHash(file).then(hash => {
      // Use hash + file size as the identifier
      const identifier = `${hash}|${file.name}`;
      setFloorplanImage(file); // Store the File object
      setFloorplanImageId(identifier);
      setPixelsPerInch(null);
      setScaleState({ points: [], pixelLength: 0 });
      setScaleInput('');
      setFurniture([]);
      setSelectedFurnitureId(null);
      setPendingScaleConfirmation(null);
      setCopiedItemData(null); // Clear clipboard on new image

      const existingScale = getScaleForImage(identifier);
      if (existingScale !== null) {
        setPendingScaleConfirmation({ identifier, scale: existingScale });
      } else {
        // Show scale instructions if not dismissed previously
        if (!dontShowScaleInstructions) {
          setShowScaleInstructionModal(true);
        } else {
          setIsSettingScale(true);
        }
      }
    }).catch(error => {
      console.error("Error generating file hash:", error);
      // Fallback to using filename and size as before
      const identifier = `${file.name}|${file.size}`;
      setFloorplanImage(file);
      setFloorplanImageId(identifier);
      setPixelsPerInch(null);
      setScaleState({ points: [], pixelLength: 0 });
      setScaleInput('');
      setFurniture([]);
      setSelectedFurnitureId(null);
      setPendingScaleConfirmation(null);
      setCopiedItemData(null);
      
      // Continue with scale checks
      const existingScale = getScaleForImage(identifier);
      if (existingScale !== null) {
        setPendingScaleConfirmation({ identifier, scale: existingScale });
      } else if (!dontShowScaleInstructions) {
        setShowScaleInstructionModal(true);
      } else {
        setIsSettingScale(true);
      }
    });
  };

  const triggerFileUpload = () => {
    if (uploadInputRef.current) {
      uploadInputRef.current.click();
    }
  };

  const handleSetScaleMode = () => {
    if (!floorplanImage) {
        alert("Please upload a floor plan image first.");
        return;
    }
    
    // Show instructions modal if not dismissed previously
    if (!dontShowScaleInstructions) {
      setShowScaleInstructionModal(true);
    } else {
      startSettingScale();
    }
  };
  
  const startSettingScale = () => {
    setIsSettingScale(true);
    setScaleState({ points: [], pixelLength: 0 });
    setScaleInput('');
    setPixelsPerInch(null);
    setSelectedFurnitureId(null);
    setPendingScaleConfirmation(null);
  };
  
  const handleDontShowAgainChange = (e) => {
    const newValue = e.target.checked;
    setDontShowScaleInstructions(newValue);
    localStorage.setItem('dontShowScaleInstructions', newValue);
  };
  
  const handleCloseInstructionModal = () => {
    setShowScaleInstructionModal(false);
  };

  const handleSetScalePoints = (point) => {
    if (!isSettingScale) return;
    setScaleState(prev => {
      const newPoints = [...prev.points, point];
      if (newPoints.length === 1) {
        return { ...prev, points: newPoints };
      } else if (newPoints.length === 2) {
        const pixelLength = getDistance(newPoints[0], newPoints[1]);
        setIsSettingScale(false);
        return { points: newPoints, pixelLength: pixelLength };
      }
      return { points: [], pixelLength: 0 };
    });
  };

  const handleScaleInputChange = (event) => {
    setScaleInput(event.target.value);
  };

  const handleSetScaleConfirm = (realLengthInches) => {
    if (scaleState.pixelLength > 0 && floorplanImageId) {
      const newScale = scaleState.pixelLength / realLengthInches;
      setPixelsPerInch(newScale);
      setScaleInput('');
      setIsSettingScale(false); // Ensure we exit setting scale mode
      saveScaleForImage(floorplanImageId, newScale);
      console.log(`Scale set and saved for ${floorplanImageId}: ${newScale.toFixed(2)} px/inch`);
    } else {
      alert("Could not set scale. Please ensure an image is loaded and the scale line was drawn.");
      setScaleState({ points: [], pixelLength: 0 });
      setScaleInput('');
    }
  };

  // Utility function to convert stage coordinates to image coordinates
  const stageToImagePoint = useCallback((stagePoint) => {
    if (!stageRef.current) {
      console.log('stageToImagePoint: No stage reference');
      return { x: 0, y: 0 };
    }
    
    const stage = stageRef.current.getStage ? stageRef.current.getStage() : stageRef.current;
    const floorplanImage = stage.findOne('.floorplan-image');
    
    if (!floorplanImage) {
      console.log('stageToImagePoint: No floorplan image found');
      return { x: 0, y: 0 };
    }
    
    const imageScaleFactor = floorplanImage.scaleX();
    const imageOffsetX = floorplanImage.x();
    const imageOffsetY = floorplanImage.y();
    
    console.log('Image properties:', {
      scale: imageScaleFactor,
      offset: { x: imageOffsetX, y: imageOffsetY },
      size: { width: floorplanImage.width(), height: floorplanImage.height() }
    });
    
    // Calculate image coordinates from stage coordinates
    const imageX = (stagePoint.x - imageOffsetX) / imageScaleFactor;
    const imageY = (stagePoint.y - imageOffsetY) / imageScaleFactor;
    
    // Ensure we're not returning values outside the image bounds
    const clampedX = Math.max(0, Math.min(imageX, floorplanImage.width()));
    const clampedY = Math.max(0, Math.min(imageY, floorplanImage.height()));
    
    console.log('Stage point to image point conversion:', {
      stagePoint,
      imagePoint: { x: clampedX, y: clampedY }
    });
    
    return {
      x: clampedX,
      y: clampedY
    };
  }, [stageRef]);

  // Adds an instance of a furniture template
  const handleAddFurniture = (template) => {
    try {
      if (!pixelsPerInch) {
        console.error("Scale not set, cannot add furniture");
        setStatusMessage("Please set the scale before adding furniture");
        return;
      }

      console.log("Adding furniture item:", template);
      console.log("Current scale state:", scaleState);
      console.log("pixelsPerInch:", pixelsPerInch);

      // Get center coordinates for placing furniture
      let centerX, centerY;
      try {
        // Check if we have a valid canvas reference
        if (!floorplanCanvasRef.current) {
          throw new Error("Canvas reference not found");
        }
        
        // Get stage dimensions
        const stage = floorplanCanvasRef.current.getStage();
        if (!stage) {
          throw new Error("Stage reference not found");
        }
        
        const stageWidth = stage.width();
        const stageHeight = stage.height();
        console.log("Stage dimensions:", stageWidth, stageHeight);

        // Try to find the floorplan image to determine its center
        const floorplanImage = stage.findOne('.floorplan-image');
        if (floorplanImage) {
          // Use the center of the image
          const imageWidth = floorplanImage.width();
          const imageHeight = floorplanImage.height();
          const imageX = floorplanImage.x();
          const imageY = floorplanImage.y();
          
          console.log("Floorplan image found:", { 
            width: imageWidth, 
            height: imageHeight,
            x: imageX,
            y: imageY
          });
          
          // Use image center
          centerX = imageX + imageWidth / 2;
          centerY = imageY + imageHeight / 2;
          console.log("Using image center:", centerX, centerY);
        } else {
          // Fallback: Use stage center if image not found
          console.log("Floorplan image not found, using stage center");
          centerX = stageWidth / 2;
          centerY = stageHeight / 2;
        }
      } catch (err) {
        console.error("Error determining furniture position:", err);
        // Fallback values if we can't get the stage
        centerX = 100;
        centerY = 100;
      }

      // Ensure valid coordinates
      if (!centerX || !centerY || isNaN(centerX) || isNaN(centerY) || centerX < 10 || centerY < 10) {
        console.error("Invalid center coordinates:", centerX, centerY);
        centerX = 100;
        centerY = 100;
      }
      
      console.log("Final center coordinates:", centerX, centerY);

      // Convert center from Stage coordinates to Image coordinates
      let imagePoint;
      
      try {
        if (floorplanCanvasRef.current && floorplanCanvasRef.current.stageToImagePoint) {
          imagePoint = floorplanCanvasRef.current.stageToImagePoint({ x: centerX, y: centerY });
          console.log("Center point in image coordinates:", imagePoint);
        } else {
          throw new Error("stageToImagePoint method not available");
        }
      } catch (err) {
        console.error("Error converting coordinates:", err);
        // Use fallback coordinates directly
        imagePoint = { x: 100, y: 100 };
      }
      
      // Create new furniture item
      const newItem = {
        id: `${template.id}-${Date.now()}`,
        name: template.name,
        width: template.width,
        height: template.height,
        x: imagePoint.x,
        y: imagePoint.y,
        rotation: 0,
        color: template.color || getRandomColor(),
        opacity: template.opacity !== undefined ? template.opacity : 0.7,
      };

      console.log("Created new furniture item:", newItem);
      
      // Add to list and select the new item
      setFurniture((prev) => {
        const updated = [...prev, newItem];
        console.log("Updated furniture list:", updated);
        return updated;
      });
      
      setSelectedFurnitureId(newItem.id);
      setStatusMessage(`Added ${template.name}`);
    } catch (error) {
      console.error("Error in handleAddFurniture:", error);
      setStatusMessage(`Error adding furniture: ${error.message}`);
    }
  };

  // Adds a *new* custom furniture template
  const handleAddNewCustomFurnitureTemplate = (newTemplateData) => {
      const templateId = `custom-${Date.now()}`;
      const newTemplate = {
          ...newTemplateData, // name, width, height, isGlobal
          id: templateId,
          color: newTemplateData.color || '#AAAAAA', // Default color for new custom items
          opacity: 0.7,     // Default opacity
          isCustom: true,
          isGlobal: newTemplateData.isGlobal,
          imageId: !newTemplateData.isGlobal ? floorplanImageId : null, // Store imageId for local items
      };
      const updatedTemplates = [...availableFurnitureTemplates, newTemplate];
      setAvailableFurnitureTemplates(updatedTemplates);
      const customTemplatesToSave = updatedTemplates.filter(t => t.isCustom);
      saveCustomFurnitureTemplates(customTemplatesToSave);
      handleAddFurniture(newTemplate); // Add instance immediately
  };

  // Updates an existing custom furniture template
  const handleUpdateCustomFurnitureTemplate = (updatedTemplate) => {
    // Update the template in the available templates list
    const updatedTemplates = availableFurnitureTemplates.map(template => 
      template.id === updatedTemplate.id ? updatedTemplate : template
    );
    setAvailableFurnitureTemplates(updatedTemplates);
    
    // Save to local storage
    const customTemplatesToSave = updatedTemplates.filter(t => t.isCustom);
    saveCustomFurnitureTemplates(customTemplatesToSave);
    
    // Also update any placed furniture using this template (color only)
    if (furniture.some(item => item.id.includes(updatedTemplate.id))) {
      setFurniture(prevFurniture => 
        prevFurniture.map(item => {
          // Check if this item was created from the template
          // Template IDs are used as prefixes for placed item IDs
          const isFromTemplate = item.id.includes(updatedTemplate.id);
          if (isFromTemplate) {
            return {
              ...item,
              color: updatedTemplate.color, // Update color to match template
            };
          }
          return item;
        })
      );
    }
    
    console.log(`Updated custom template: ${updatedTemplate.name}`);
  };

 const handleFurnitureMove = useCallback((id, newAttrs) => {
    setFurniture(prev =>
      prev.map(item =>
        item.id === id
          ? { ...item, ...newAttrs }
          : item
      )
    );
 }, []);

  const handleSelectFurniture = (id) => {
      if (isSettingScale) return;
      setSelectedFurnitureId(id);
  };

  // handleDeleteFurniture defined above

  const handleCloneFurniture = useCallback((idToClone) => {
    const itemToClone = furniture.find(item => item.id === idToClone);
    if (itemToClone && pixelsPerInch) {
      const templatePrefix = itemToClone.id.substring(0, itemToClone.id.lastIndexOf('-')) || 'clone';
      const uniqueId = `${templatePrefix}-${Date.now()}`;
      const newItem = {
        ...itemToClone, // Clone all properties including current appearance
        id: uniqueId,
        x: itemToClone.x + (20 / pixelsPerInch),
        y: itemToClone.y + (20 / pixelsPerInch),
      };
      setFurniture(prev => [...prev, newItem]);
      setSelectedFurnitureId(uniqueId);
    }
  }, [furniture, pixelsPerInch]);

  // --- Edit Modal Handlers ---
  const handleOpenEditModal = (itemId) => {
      setEditingItemId(itemId);
      setIsEditModalOpen(true);
  };

  const handleCloseEditModal = () => {
      setIsEditModalOpen(false);
      setEditingItemId(null);
  };

  const handleUpdateFurnitureItem = (itemId, updatedProps) => {
      setFurniture(prev =>
          prev.map(item =>
              item.id === itemId
                  ? { ...item, ...updatedProps } // Merge updated name, color, opacity
                  : item
          )
      );
      handleCloseEditModal(); // Close modal after saving
  };

  // --- Import / Export ---
  const handleExportLayout = () => {
    if (!floorplanImageId || pixelsPerInch === null) {
        alert("Please upload an image and set the scale before exporting.");
        return;
    }
    const layoutData = {
        version: 1,
        imageId: floorplanImageId,
        pixelsPerInch: pixelsPerInch,
        furniture: furniture, // Includes color/opacity now
    };
    
    // Extract filename from the ID (which is now hash|filename)
    let filename;
    const parts = floorplanImageId.split('|');
    if (parts.length > 1) {
        // New format: hash|filename
        filename = parts[1];
    } else {
        // Old format or fallback
        filename = parts[0] || 'layout';
    }
    
    downloadJson(layoutData, `${filename}.floorplan.json`);
  };

  const handleImportLayout = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importedData = JSON.parse(e.target.result);
        if (!importedData || typeof importedData !== 'object' || !importedData.imageId || typeof importedData.pixelsPerInch !== 'number' || !Array.isArray(importedData.furniture)) {
            throw new Error("Invalid file format.");
        }
        // Allow import only if NO image is loaded OR if the IDs match
        if (floorplanImage && importedData.imageId !== floorplanImageId) {
            // Extract the filename from the current and imported IDs
            // The format of IDs has changed to hash|filename, so we extract differently
            const currentImageName = floorplanImageId?.split('|')[1] || floorplanImageId?.split('|')[0] || 'current image';
            const importedImageName = importedData.imageId.split('|')[1] || importedData.imageId.split('|')[0] || 'imported layout';
            alert(`Import failed: Layout is for "${importedImageName}", but current image is "${currentImageName}". Upload the correct image first or clear the current image.`);
            if (importFileRef.current) importFileRef.current.value = "";
            return;
        }

        // Ensure imported items have default color/opacity if missing from older exports
        const furnitureWithDefaults = importedData.furniture.map(item => ({
            ...item,
            color: item.color || '#AAAAAA', // Default grey if missing
            opacity: item.opacity !== undefined ? item.opacity : 0.7, // Default opacity if missing
        }));

        // Extract custom templates from imported furniture
        addCustomTemplatesFromImport(furnitureWithDefaults, importedData.imageId);

        setPixelsPerInch(importedData.pixelsPerInch);
        setFurniture(furnitureWithDefaults);
        // If importing over empty state, maybe try to load image based on ID? Complex.
        // For now, just set the ID if it wasn't set.
        if (!floorplanImageId) {
            setFloorplanImageId(importedData.imageId);
            // We still don't have the image File/URL here for the canvas!
            // Set floorplanImage to null or a placeholder to avoid errors if canvas expects it
            setFloorplanImage(null);
            alert("Layout data imported successfully. Please upload the corresponding floor plan image.");
        }
        setSelectedFurnitureId(null); setIsSettingScale(false); setScaleState({ points: [], pixelLength: 0 });
        setScaleInput(''); setPendingScaleConfirmation(null); setCopiedItemData(null); // Clear clipboard on import
        alert("Layout imported successfully!");
      } catch (error) {
        console.error("Error importing layout:", error); alert(`Failed to import layout: ${error.message}`);
      } finally {
          if (importFileRef.current) importFileRef.current.value = "";
      }
    };
    reader.onerror = (e) => {
        console.error("Error reading file:", e); alert("Failed to read the selected file.");
        if (importFileRef.current) importFileRef.current.value = "";
    };
    reader.readAsText(file);
  };

  // Add new helper function to extract and add custom templates from imported furniture
  const addCustomTemplatesFromImport = (importedFurniture, imageId) => {
    // Get existing custom templates
    const existingCustomTemplates = loadCustomFurnitureTemplates();
    const existingIds = new Set(existingCustomTemplates.map(item => item.id));
    
    // Extract potential custom items from the imported furniture
    const customItems = importedFurniture.filter(item => {
      // Identify custom items - they typically have "custom" in their ID
      // or don't match any of the default templates
      return item.id.includes('custom-') || 
        !DEFAULT_FURNITURE_TEMPLATES.some(defaultItem => item.id.startsWith(defaultItem.id));
    });
    
    if (customItems.length === 0) return; // No custom items to add
    
    // Create template objects for each custom item
    const newCustomTemplates = customItems.map(item => {
      // Check if this exact template already exists
      if (existingIds.has(item.id)) return null;
      
      return {
        id: item.id, 
        name: item.name,
        width: item.width,
        height: item.height,
        color: item.color || '#AAAAAA',
        opacity: item.opacity !== undefined ? item.opacity : 0.7,
        isCustom: true,
        isGlobal: true, // Make imported templates global by default
        imageId: null // Not tied to a specific image
      };
    }).filter(Boolean); // Remove nulls (already existing templates)
    
    if (newCustomTemplates.length === 0) return; // No new templates to add
    
    // Combine with existing templates and save
    const updatedTemplates = [...existingCustomTemplates, ...newCustomTemplates];
    saveCustomFurnitureTemplates(updatedTemplates);
    
    // Update the available templates in the app state
    setAvailableFurnitureTemplates([
      ...DEFAULT_FURNITURE_TEMPLATES,
      ...updatedTemplates
    ]);
    
    console.log(`Added ${newCustomTemplates.length} custom templates from imported layout`);
  };

  const triggerImportFileSelect = () => {
      if (importFileRef.current) importFileRef.current.click();
  };

  // --- Share ---
  const handleShareLayout = () => {
    setIsShareModalOpen(true);
  };

  const handleCloseShareModal = () => {
    setIsShareModalOpen(false);
  };
  
  const handleShareSubmit = async (shareConfig) => {
    try {
      // Get the stage instance using the ref
      const stage = floorplanCanvasRef.current?.getStage();
      if (!stage) {
        throw new Error('Floor plan stage reference not found');
      }

      // Get the current stage content as a data URL
      const stageImageDataUrl = stage.toDataURL({ pixelRatio: 2 }); // Use pixelRatio for higher resolution

      // Create a temporary canvas to compose the final image
      const tempCanvas = document.createElement('canvas');
      const ctx = tempCanvas.getContext('2d');
      
      // Load the stage image onto the temporary canvas
      const stageImage = new Image();
      stageImage.onload = () => {
        // Set initial canvas dimensions based on the stage image
        tempCanvas.width = stageImage.width;
        tempCanvas.height = stageImage.height;
        
        // Calculate padding needed for extra content
        const titlePadding = shareConfig.title ? 60 : 0;
        const furniturePadding = shareConfig.includeFurniture && furniture.length > 0 ? 
          Math.min(40 + furniture.length * 25, 300) : 0;
        const scalePadding = shareConfig.includeScale ? 50 : 0;
        const totalPadding = titlePadding + furniturePadding + scalePadding;
        
        // Resize canvas height to accommodate the additional content
        tempCanvas.height += totalPadding;
        
        // Fill the entire canvas with white background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
        
        // Draw the stage image onto the canvas, below the title padding
        ctx.drawImage(stageImage, 0, titlePadding);
        
        // --- Draw additional content below the stage image --- 
        let currentY = titlePadding + stageImage.height;
        
        // Draw title at the top if requested
        if (shareConfig.title) {
          ctx.font = 'bold 32px Arial';
          ctx.fillStyle = '#333';
          ctx.textAlign = 'center';
          // Draw title within the title padding area
          ctx.fillText(shareConfig.title, tempCanvas.width / 2, 40); 
        }
        
        // Draw scale information if requested
        if (shareConfig.includeScale && pixelsPerInch > 0) {
          currentY += 30; // Add some top margin
          ctx.font = 'bold 18px Arial';
          ctx.fillStyle = '#333';
          ctx.textAlign = 'left';
          ctx.fillText(`Scale: 1 inch = ${pixelsPerInch.toFixed(2)} pixels`, 20, currentY);
          currentY += 20; // Add bottom margin for scale
        }
        
        // Draw furniture list if requested
        if (shareConfig.includeFurniture && furniture.length > 0) {
          currentY += 10; // Add some top margin
          ctx.font = 'bold 20px Arial';
          ctx.fillStyle = '#333';
          ctx.textAlign = 'left';
          ctx.fillText('Furniture List:', 20, currentY);
          currentY += 10; // Space after title
          
          ctx.font = '16px Arial';
          furniture.forEach((item, index) => {
            currentY += 25; // Space for each item
            const itemColor = item.color || '#3182CE';
            
            // Draw colored rectangle as a bullet
            ctx.fillStyle = itemColor;
            ctx.fillRect(25, currentY - 10, 10, 10);
            
            // Draw text with item name and dimensions
            ctx.fillStyle = '#333';
            ctx.fillText(
              `${item.name} (${item.width}″ × ${item.height}″)`, 
              45, 
              currentY
            );
          });
        }
        
        // Convert the composed canvas to a final data URL
        const finalImageUrl = tempCanvas.toDataURL('image/png');
        
        // Create and trigger download
        const link = document.createElement('a');
        link.href = finalImageUrl;
        link.download = `${shareConfig.title || 'floor-plan'}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Success!
        alert('Your floor plan has been saved as an image!');
      };
      
      stageImage.onerror = (err) => {
        console.error('Error loading stage image data:', err);
        throw new Error('Failed to load stage image for sharing.');
      };
      
      // Set the source for the image object
      stageImage.src = stageImageDataUrl;

    } catch (error) {
      console.error('Error sharing layout:', error);
      alert(`Failed to share layout: ${error.message}`);
    }
  };

  // Determine if we show the empty state or the main UI
  const showEmptyState = !floorplanImage;

  return (
    <div className="App">
      {/* Hidden file inputs */}
      <input type="file" ref={importFileRef} onChange={handleImportLayout} accept=".json,.floorplan" style={{ display: 'none' }} aria-hidden="true" />
      <input type="file" ref={uploadInputRef} onChange={handleImageUpload} accept="image/*,.json,.floorplan" style={{ display: 'none' }} aria-hidden="true" />
      
      {showEmptyState ? (
        <>
          <EmptyState onUpload={triggerFileUpload} />
          <Footer />
        </>
      ) : (
        <div className="main-content">
          {/* Only show Toolbar when scale is configured or we're at the initial upload state */}
          {(pixelsPerInch !== null || !floorplanImage) && (
          <Toolbar
            // Furniture Template Props
            availableFurnitureTemplates={availableFurnitureTemplates}
            onAddNewCustomFurnitureTemplate={handleAddNewCustomFurnitureTemplate}
            onAddFurniture={handleAddFurniture}
            onUpdateCustomFurnitureTemplate={handleUpdateCustomFurnitureTemplate}

            // Placed Item Props
            placedFurniture={furniture}
            selectedFurnitureId={selectedFurnitureId}
            onSelectFurniture={handleSelectFurniture}
            onDeleteFurniture={handleDeleteFurniture}
            onCloneFurniture={handleCloneFurniture}
            onOpenEditModal={handleOpenEditModal}

            // Image & Scale Props
            hasImage={!!floorplanImage} // Pass boolean indicating if image is loaded
            isScaleSet={pixelsPerInch !== null} // Pass boolean indicating if scale is set
            onImageUpload={triggerFileUpload} // Changed to use the trigger function instead
            onSetScaleMode={handleSetScaleMode}
            scale={scaleState}
            scaleInput={scaleInput}
            onScaleInputChange={handleScaleInputChange}
            onSetScaleConfirm={handleSetScaleConfirm}
            isSettingScale={isSettingScale}
            pixelsPerInch={pixelsPerInch}

            // Import / Export / Share Handlers
            onExportLayout={handleExportLayout}
            onTriggerImport={triggerImportFileSelect}
            onShareLayout={handleShareLayout} // Pass share handler
            canShare={canShare} // Use the canShare state we defined earlier
          />
          )}
          
          {/* Show scale input when two points are drawn and we're not in setting mode */}
          {floorplanImage && pixelsPerInch === null && (
            <div className="scale-toolbar">
              {/* Scale input when two points are drawn */}
              {scaleState.points.length === 2 && !isSettingScale && (
                <div className="scale-input-container">
                  <input
                    type="text"
                    placeholder="Enter real length (e.g. 10' or 120&quot;)"
                    value={scaleInput}
                    onChange={handleScaleInputChange}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const parsedValue = parseDimensionString(scaleInput);
                        if (!isNaN(parsedValue) && parsedValue > 0) {
                          handleSetScaleConfirm(parsedValue);
                        }
                      }
                    }}
                  />
                  <button 
                    onClick={() => {
                      const parsedValue = parseDimensionString(scaleInput);
                      if (!isNaN(parsedValue) && parsedValue > 0) {
                        handleSetScaleConfirm(parsedValue);
                      }
                    }}
                  >
                    Set Scale
                  </button>
                </div>
              )}
              
              {isSettingScale && (
                <div className="scale-setting-status">
                  Setting Scale: {scaleState.points.length === 0 ? "Click first point" : "Click second point"}
                </div>
              )}
            </div>
          )}

          {floorplanImage && (
          <FloorPlanCanvas
              image={floorplanImage}
            isSettingScale={isSettingScale}
            onSetScalePoints={handleSetScalePoints}
            scale={scaleState}
            pixelsPerInch={pixelsPerInch}
            furniture={furniture}
            onFurnitureMove={handleFurnitureMove}
            selectedFurnitureId={selectedFurnitureId}
            onSelectFurniture={handleSelectFurniture}
            onSetScaleMode={handleSetScaleMode}
            ref={floorplanCanvasRef}
          />
          )}
          
          {/* Footer component */}
          <Footer />
        </div>
      )}

      {/* Only show edit modal if open and editing an item */}
      {isEditModalOpen && editingItemId && (
          <EditFurnitureModal
          item={furniture.find(item => item.id === editingItemId)}
              onClose={handleCloseEditModal}
          onSave={(updatedProps) => handleUpdateFurnitureItem(editingItemId, updatedProps)}
        />
      )}
      
      {/* Scale instruction modal */}
      {showScaleInstructionModal && (
        <ScaleInstructionModal
          onClose={handleCloseInstructionModal}
          onStartScale={() => {
            setShowScaleInstructionModal(false);
            startSettingScale();
          }}
          dontShowAgain={dontShowScaleInstructions}
          onDontShowAgainChange={handleDontShowAgainChange}
          />
      )}

      {isShareModalOpen && (
        <ShareModal
          onClose={handleCloseShareModal}
          onShare={handleShareSubmit}
          layoutData={{
            furnitureItems: furniture,
            pixelsPerInch,
            scale: scaleState
          }}
          floorplanImage={floorplanImage}
        />
      )}
    </div>
  );
}

export default App;
