import { useDraggable } from '@dnd-kit/core';
import defaultImage from '../src/assets/add_Photo.png'; // Fallback if no custom image is picked
import React, { useState, useRef } from 'react';

export function TaskCard({ task, onDelete, onUpdateTask }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: task.id,
  });

  const fileInputRef = useRef(null);

  // UI editing toggles
  const [isEditing, setIsEditing] = useState(false);
  const [isEditingSecond, setIsEditingSecond] = useState(false);
  const [isEditingThird, setIsEditingThird] = useState(false);

  // Field fallbacks
  const text = task.text ?? "Name";
  const secondText = task.secondText ?? "Title";
  const thirdText = task.thirdText ?? "Questions";
  const cardImage = (task.image && task.image !== "") ? task.image : defaultImage;

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined;

  const handleUpdate = (key, value) => {
    onUpdateTask(task.id, { ...task, [key]: value });
  };

  // Convert uploaded file into a base64 Data URL to save in state
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
    e.stopPropagation(); // Prevents triggering dnd-kit drag mechanics
    fileInputRef.current.click();
  };

  // Triggers a browser file download of the card data as a JSON file
  const handleSaveToJson = (e) => {
    e.stopPropagation(); // Stops drag events

    const exportData = {
      id: task.id,
      image: cardImage,
      text: text,
      secondText: secondText,
      thirdText: thirdText,
    };

    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
      JSON.stringify(exportData, null, 2)
    )}`;
    
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', jsonString);
    downloadAnchor.setAttribute('download', `task-card-${task.id}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      className="relative rounded-lg bg-neutral-700 p-4 shadow-sm hover:shadow-md transition-shadow"
      style={style}
    >
      {/* DELETE BUTTON */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete(task.id);
        }}
        className="absolute top-2 right-2 text-neutral-400 hover:text-red-500 font-bold px-2 py-0.5 rounded transition-colors text-sm z-10"
        title="Delete task"
      >
        ✕
      </button>

      {/* DRAG HANDLE & IMAGE CONTAINER */}
      <div {...listeners} className="cursor-grab flex flex-col items-center mb-4">
        <div className="rounded-md overflow-hidden border border-neutral-600 mb-2">
          <img
            src={cardImage}
            alt="Card graphic"
            className="w-[200px] h-[200px] object-cover pointer-events-none"
          />
        </div>

        {/* BUTTON BAR FOR ACTION ITEMS */}
        <div className="flex gap-2" onPointerDown={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
          {/* CHANGE PHOTO BUTTON */}
          <button
            onClick={triggerFileInput}
            className="bg-neutral-600 hover:bg-neutral-500 text-white text-xs font-semibold py-1.5 px-3 rounded transition-colors cursor-pointer"
          >
            Change Photo
          </button>

        </div>

        {/* Hidden File Input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleImageChange}
          accept="image/*"
          className="hidden"
        />
      </div>

      {/* FIRST EDITABLE TEXT BOX */}
      <div style={{ padding: '20px' }} onPointerDown={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
        {isEditing ? (
          <input
            type="text"
            value={text}
            onChange={(e) => handleUpdate('text', e.target.value)}
            onBlur={() => setIsEditing(false)}
            onKeyDown={(e) => e.key === 'Enter' && setIsEditing(false)}
            autoFocus
            className="text-black p-1 rounded w-full"
          />
        ) : (
          <span
            onClick={(e) => {
              e.stopPropagation();
              setIsEditing(true);
            }}
            style={{ cursor: 'pointer', borderBottom: '1px dashed #333', color: 'white' }}
          >
            {text}
          </span>
        )}
      </div>

      {/* SECOND EDITABLE TEXT BOX */}
      <div style={{ padding: '20px' }} onPointerDown={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
        {isEditingSecond ? (
          <input
            type="text"
            value={secondText}
            onChange={(e) => handleUpdate('secondText', e.target.value)}
            onBlur={() => setIsEditingSecond(false)}
            onKeyDown={(e) => e.key === 'Enter' && setIsEditingSecond(false)}
            autoFocus
            className="text-black p-1 rounded w-full"
          />
        ) : (
          <span
            onClick={(e) => {
              e.stopPropagation();
              setIsEditingSecond(true);
            }}
            style={{ cursor: 'pointer', borderBottom: '1px dashed #333', color: 'white' }}
          >
            {secondText}
          </span>
        )}
      </div>

      {/* THIRD EDITABLE TEXT BOX */}
      <div style={{ padding: '20px' }} onPointerDown={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
        {isEditingThird ? (
          <input
            type="text"
            value={thirdText}
            onChange={(e) => handleUpdate('thirdText', e.target.value)}
            onBlur={() => setIsEditingThird(false)}
            onKeyDown={(e) => e.key === 'Enter' && setIsEditingThird(false)}
            autoFocus
            className="text-black p-1 rounded w-full"
          />
        ) : (
          <span
            onClick={(e) => {
              e.stopPropagation();
              setIsEditingThird(true);
            }}
            style={{ cursor: 'pointer', borderBottom: '1px dashed #333', color: 'white' }}
          >
            {thirdText}
          </span>
        )}
      </div>
    </div>
  );
}
