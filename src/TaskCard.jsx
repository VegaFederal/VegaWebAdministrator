import { useDraggable } from '@dnd-kit/core';
import ryan from '../src/assets/Ryan.png';
import React, { useState } from 'react';

export function TaskCard({ task }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: task.id,
  });

  // State for the FIRST editable text box
  const [text, setText] = useState("Name");
  const [isEditing, setIsEditing] = useState(false);

  // State for the SECOND editable text box
  const [secondText, setSecondText] = useState("Title");
  const [isEditingSecond, setIsEditingSecond] = useState(false);

  // State for the THIRD editable text box
  const [thirdText, setThirdText] = useState("Questions");
  const [isEditingThird, setIsEditingThird] = useState(false);

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
      <div {...listeners} className="cursor-grab flex justify-center mb-[40px]" >
        <img src={ryan} alt='' className='w-[200px] h-[200px] pointer-events-none' />
      </div>

      {/* FIRST EDITABLE TEXT BOX AREA */}
      <div style={{ padding: '20px' }} onPointerDown={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()} >
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

      {/* SECOND EDITABLE TEXT BOX AREA */}
      <div style={{ padding: '20px' }} onPointerDown={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()} >
        {isEditingSecond ? (
          <input
            type="text"
            value={secondText}
            onChange={(e) => setSecondText(e.target.value)}
            onBlur={() => setIsEditingSecond(false)}
            onKeyDown={(e) => e.key === 'Enter' && setIsEditingSecond(false)}
            autoFocus
            className="text-black p-1 rounded"
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

      {/* THIRD EDITABLE TEXT BOX AREA */}
      <div style={{ padding: '20px' }} onPointerDown={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()} >
        {isEditingThird ? (
          <input
            type="text"
            value={thirdText}
            onChange={(e) => setThirdText(e.target.value)}
            onBlur={() => setIsEditingThird(false)}
            onKeyDown={(e) => e.key === 'Enter' && setIsEditingThird(false)}
            autoFocus
            className="text-black p-1 rounded"
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
