import { useState } from 'react';
import { Column } from './Column.jsx';
import { DndContext } from '@dnd-kit/core';
import React from 'react';

const COLUMNS = [
  { id: '1', title: '1' },
  { id: '2', title: '2' },
  { id: '3', title: '3' },
  { id: '4', title: '4' },
];

const INITIAL_TASKS = [
  { id: '1', status: '1' },
  { id: '2', status: '1' },
  { id: '3', status: '2' },
  { id: '4', status: '2' },
  { id: '5', status: '3' },
  { id: '6', status: '3' },
  { id: '7', status: '4' },
  { id: '8', status: '4' },
];

export default function App() {
  const [tasks, setTasks] = useState(INITIAL_TASKS);

  function handleDragEnd(event) {
    const { active, over } = event;
    if (!over) return;

    const taskId = active.id;
    const newStatus = over.id;

    setTasks(prevTasks => 
      prevTasks.map((task) =>
        task.id === taskId
          ? { ...task, status: newStatus }
          : task
      )
    );
  }

  return (
    <div className="p-4">
      <div className="flex gap-8">
        <DndContext onDragEnd={handleDragEnd}>
          {COLUMNS.map((column) => {
            return (
              <Column
                key={column.id}
                column={column}
                tasks={tasks.filter((task) => task.status === column.id)}
              />
            );
          })}
        </DndContext>
      </div>
    </div>
  );
}
