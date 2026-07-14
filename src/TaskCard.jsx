import { useDraggable } from '@dnd-kit/core';
import ryan from '../src/assets/Ryan.png';
import React, { useState } from 'react';

export function TaskCard({ task, onDelete, onUpdateTask }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: task.id,
  });

  // Toggle states can stay local since they are just for UI mode
  const [isEditing, setIsEditing] = useState(false);
  const [isEditingSecond, setIsEditingSecond] = useState(false);
  const [isEditingThird, setIsEditingThird] = useState(false);

  // Fallback to default strings if they don't exist on the task object yet
  const text = task.text ?? "Name";
  const secondText = task.secondText ?? "Title";
  const thirdText = task.thirdText ?? "Questions";

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined;

  // Helper to push text updates to the parent state
  const handleUpdate = (key, value) => {
    onUpdateTask(task.id, { ...task, [key]: value });
  };

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      className="relative rounded-lg bg-neutral-700 p-4 shadow-sm hover:shadow-md"
      style={style}
    >
      {/* DELETE BUTTON */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete(task.id);
        }}
        className="absolute top-2 right-2 text-neutral-400 hover:text-red-500 font-bold px-2 py-0.5 rounded transition-colors text-sm"
        title="Delete task"
      >
        ✕
      </button>

      {/* DRAG HANDLE */}
      <div {...listeners} className="cursor-grab flex justify-center mb-[40px]">
        <img src={ryan} alt='' className='w-[200px] h-[200px] pointer-events-none' />
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
            onClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
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
            onClick={(e) => { e.stopPropagation(); setIsEditingSecond(true); }}
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
            onClick={(e) => { e.stopPropagation(); setIsEditingThird(true); }}
            style={{ cursor: 'pointer', borderBottom: '1px dashed #333', color: 'white' }}
          >
            {thirdText}
          </span>
        )}
      </div>
    </div>
  );
}
