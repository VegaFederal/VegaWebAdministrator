import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import defaultImage from '../src/assets/add_Photo.png'; // Fallback if no custom image is picked
import React, { useState, useRef, useEffect } from 'react';

export function TaskCard({ task, onDelete, onUpdateTask, shouldFocus }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  });

  const fileInputRef = useRef(null);
  const cardRef = useRef(null);

  const connectedCardRef = (node) => {
    setNodeRef(node);
    cardRef.current = node;
  };

  useEffect(() => {
    if (!shouldFocus || !cardRef.current) return;

    cardRef.current.focus({
      preventScroll: true,
    });

    cardRef.current.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }, [shouldFocus]);

  // UI editing toggles
  const [isEditing, setIsEditing] = useState(false);
  const [isEditingSecond, setIsEditingSecond] = useState(false);
  const [isEditingThird, setIsEditingThird] = useState(false);

  // Field fallbacks
  const text = task.name ?? "Name";
  const secondText = task.title ?? "Title";

  // NEW: Fallback for veteranLogo selector (null, "vetArmy", or "vetNavy")
  const veteranLogo = task.veteranLogo ?? null;

  // CORE CHANGE: Handle both Array and String types for details
  const thirdTextArray = Array.isArray(task.details) ? task.details : (task.details ? [task.details] : ["Questions"]);
  const cardImage = (task.image && task.image !== "") ? task.image : defaultImage;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleUpdate = (key, value) => {
    onUpdateTask(task.id, { ...task, [key]: value });
  };

  const handleCardClick = (event) => {
    const clickedControl = event.target.closest(
      'button, input, textarea, select'
    );

    if (clickedControl) return;

    cardRef.current?.focus({
      preventScroll: true,
    });

    cardRef.current.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });

    
  };

  // Convert multi-line string text back to a clean JSON array
  const handleThirdTextUpdate = (textValue) => {
    const linesArray = textValue.split('\n').map(line => line.trim()).filter(line => line !== "");
    handleUpdate('details', linesArray.length > 0 ? linesArray : ["Questions"]);
  };

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      handleUpdate('image', reader.result);
    };
    reader.readAsDataURL(file);
  };

  const triggerFileInput = (e) => {
    e.stopPropagation();
    fileInputRef.current.click();
  };

  const handleSaveToJson = (e) => {
    e.stopPropagation();

    const exportData = {
      id: task.id,
      status: task.status ?? "1",
      image: cardImage,
      name: text,
      title: secondText,
      details: thirdTextArray,
      veteranLogo: veteranLogo // NEW: Included in the exported JSON file structure
    };

    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
      JSON.stringify([exportData], null, 2)
    )}`;

    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', jsonString);
    downloadAnchor.setAttribute('download', `task-card-${task.id}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div ref={connectedCardRef} tabIndex={-1} {...attributes} onClick={handleCardClick} className="relative rounded-lg bg-neutral-700 p-4 shadow-sm hover:shadow-md transition-shadow" style={style}>
      
      {/* DELETE BUTTON */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete(task.id);
        }}
        className="absolute top-2 right-2 border-0 p-1 text-neutral-400 hover:text-vega-red transition-colors text-sm z-10 cursor-pointer"
        title="Delete task"
      >
        ✕
      </button>

      {/* DRAG HANDLE & IMAGE CONTAINER */}
      <div {...listeners} className="cursor-grab flex flex-col items-center mb-4">
        <div className="rounded-md overflow-hidden border border-neutral-600 mb-2">
          <img src={cardImage} alt="Card graphic" className="w-[200px] h-[200px] object-cover pointer-events-none" />
        </div>

        {/* BUTTON BAR FOR ACTION ITEMS */}
        <div className="flex gap-2" onPointerDown={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
          <button onClick={triggerFileInput} className="text-xs py-1.5 px-3 cursor-pointer">
            Change Photo
          </button>
        </div>
        <input type="file" ref={fileInputRef} onChange={handleImageChange} accept="image/*" className="hidden" />
      </div>

      {/* NEW: VETERAN LOGO SELECTOR DROPDOWN */}
      <div style={{ padding: '0px 20px 10px 20px' }} onPointerDown={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
        <label className="block text-neutral-400 text-xs mb-1 font-semibold">Veteran Status:</label>
        <select 
          value={veteranLogo ?? ""} 
          onChange={(e) => handleUpdate('veteranLogo', e.target.value === "" ? null : e.target.value)}
          className="bg-neutral-800 text-white text-xs rounded p-1.5 w-full border border-neutral-600 focus:outline-none focus:border-primary-500"
        >
          <option value="">None (Null)</option>
          <option value="vetArmy">Army</option>
          <option value="vetNavy">Navy</option>
        </select>
      </div>

      {/* FIRST EDITABLE TEXT BOX */}
      <div style={{ padding: '10px 20px' }} onPointerDown={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
        {isEditing ? (
          <input
            type="text"
            value={text}
            onChange={(e) => handleUpdate('name', e.target.value)}
            onBlur={() => setIsEditing(false)}
            onKeyDown={(e) => e.key === 'Enter' && setIsEditing(false)}
            autoFocus
            className="text-black p-1 rounded w-full"
          />
        ) : (
          <span
            onClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
            style={{
              cursor: 'text',
              display: 'block',
              width: '100%',
              padding: '8px 10px',
              color: 'white',
              backgroundColor: '#262626',
              border: '1px solid #737373',
              borderRadius: '4px',
              minHeight: '38px',
            }}
          >
            {text}
          </span>
        )}
      </div>

      {/* SECOND EDITABLE TEXT BOX */}
      <div style={{ padding: '10px 20px' }} onPointerDown={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
        {isEditingSecond ? (
          <input
            type="text"
            value={secondText}
            onChange={(e) => handleUpdate('title', e.target.value)}
            onBlur={() => setIsEditingSecond(false)}
            onKeyDown={(e) => e.key === 'Enter' && setIsEditingSecond(false)}
            autoFocus
            className="text-black p-1 rounded w-full"
          />
        ) : (
          <span
            onClick={(e) => { e.stopPropagation(); setIsEditingSecond(true); }}
            style={{
              cursor: 'text',
              display: 'block',
              width: '100%',
              padding: '8px 10px',
              color: 'white',
              backgroundColor: '#262626',
              border: '1px solid #737373',
              borderRadius: '4px',
              minHeight: '38px',
            }}
          >
            {secondText}
          </span>
        )}
      </div>

      {/* THIRD EDITABLE BOX: TEXTAREA LINE-BY-LINE ARRAY HANDLING */}
      <div style={{ padding: '10px 20px' }} onPointerDown={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
        {isEditingThird ? (
          <textarea
            defaultValue={thirdTextArray.join('\n')}
            onBlur={(e) => {
              handleThirdTextUpdate(e.target.value);
              setIsEditingThird(false);
            }}
            autoFocus
            className="text-black p-1 rounded w-full h-24 font-sans text-sm resize-none"
          />
        ) : (
          <div
            onClick={(e) => { e.stopPropagation(); setIsEditingThird(true); }}
            className="cursor-pointer border border-dashed border-neutral-500 rounded p-2 text-left bg-neutral-800 text-xs min-h-[40px]"
          >
            <ul className="list-disc pl-4 text-neutral-200">
              {thirdTextArray.map((question, i) => (
                <li key={i}>{question}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

    </div>
  );
}
