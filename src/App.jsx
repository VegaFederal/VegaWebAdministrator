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

  function addTaskToFirstColumn() {
    const newTask = {
      id: String(Date.now()),
      status: '1',
    };
    setTasks(prevTasks => [...prevTasks, newTask]);
  }

  // Deletion logic: Filter out the card with the matching ID
  function deleteTask(taskId) {
    setTasks(prevTasks => prevTasks.filter(task => task.id !== taskId));
  }

  function handleDragEnd(event) {
    const { active, over } = event;
    if (!over) return;

    const taskId = active.id;
    const newStatus = over.id;

    setTasks(prevTasks =>
      prevTasks.map((task) =>
        task.id === taskId ? { ...task, status: newStatus } : task
      )
    );
  }

  return (
    <div className="p-4">
      <div className="mb-4">
        <button
          onClick={addTaskToFirstColumn}
          className="bg-grayscale-800 text-white font-bold py-2 px-4 rounded shadow"
        >
          + Add Task
        </button>
      </div>

      <div className="flex gap-8">
        <DndContext onDragEnd={handleDragEnd}>
          {COLUMNS.map((column) => {
            return (
              <Column
                key={column.id}
                column={column}
                tasks={tasks.filter((task) => task.status === column.id)}
                onDeleteTask={deleteTask} // Pass handler to the Column
              />
            );
          })}
        </DndContext>
      </div>
    </div>
  );
}
