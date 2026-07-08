import React from 'react';
import { TaskCard } from './TaskCard.jsx'; // Adjust path if needed
import { useDroppable } from '@dnd-kit/core';

export function Column({ column, tasks, onDeleteTask }) {
  const { setNodeRef } = useDroppable({
    id: column.id,
  });

  return (
    <div ref={setNodeRef} className="bg-neutral-800 p-4 rounded-lg w-72 min-h-[500px]">
      <h2 className="text-white font-bold mb-4">Column {column.title}</h2>
      <div className="flex flex-col gap-4">
        {tasks.map((task) => (
          <TaskCard 
            key={task.id} 
            task={task} 
            onDelete={onDeleteTask} // Pass handler to the TaskCard
          />
        ))}
      </div>
    </div>
  );
}
