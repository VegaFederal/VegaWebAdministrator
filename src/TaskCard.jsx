import { useDraggable } from '@dnd-kit/core';
import ryan from '../src/assets/Ryan.png';
import React, { useState } from 'react';

export function TaskCard({ task }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: task.id,
  });

  const [text, setText] = useState("Click me to edit!");
  const [isEditing, setIsEditing] = useState(false);

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined;

  return (
    <div 
      ref={setNodeRef}
      {...attributes} 
      className="rounded-lg bg-neutral-700 p-4 shadow-sm hover:shadow-md" 
      style={style}
    >
      {/* DRAG HANDLE: Only this area triggers dragging now */}
      <div 
        {...listeners} 
        className="cursor-grab flex justify-center mb-[40px]"
      >
        <img src={ryan} alt='' className='w-[200px] h-[200px] pointer-events-none' />
      </div>

      {/* EDITABLE TEXT BOX AREA */}
      <div 
        style={{ padding: '20px' }} 
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {isEditing ? (
          <input 
            type="text" 
            value={text} 
            onChange={(e) => setText(e.target.value)} 
            onBlur={() => setIsEditing(false)} 
            onKeyDown={(e) => e.key === 'Enter' && setIsEditing(false)} 
            autoFocus 
            className="text-black p-1 rounded"
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
    </div>
  );
}
