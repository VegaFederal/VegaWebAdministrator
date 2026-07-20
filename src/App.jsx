import { useState } from 'react';
import { Column } from './Column.jsx';
import { DndContext } from '@dnd-kit/core';
import React, { useRef } from 'react';
import savedTasks from './cards-data.json';

const COLUMNS = [
  { id: '1', title: '1' },
  { id: '2', title: '2' },
  { id: '3', title: '3' },
  { id: '4', title: '4' },
];

export default function App() {
  const [tasks, setTasks] = useState(savedTasks);
  const fileInputRef = useRef(null);
  // Keeps track of the active file reference for seamless saving
  const [fileHandle, setFileHandle] = useState(null);

  function addTaskToFirstColumn() {
    const newTask = { 
      id: String(Date.now()), 
      status: '1', 
      image: "", 
      text: "Name", 
      secondText: "Title", 
      thirdText: "Questions" 
    };
    setTasks(prevTasks => [...prevTasks, newTask]);
  }

  function deleteTask(taskId) {
    setTasks(prevTasks => prevTasks.filter(task => task.id !== taskId));
  }

  function updateTask(taskId, updatedTask) {
    setTasks(prevTasks => prevTasks.map(task => (task.id === taskId ? updatedTask : task)) );
  }

  function handleDragEnd(event) {
    const { active, over } = event;
    if (!over) return;
    const taskId = active.id;
    const newStatus = over.id;
    setTasks(prevTasks => prevTasks.map((task) => task.id === taskId ? { ...task, status: newStatus } : task ));
  }

  // CLEANUP UTIL: Formats active tasks neatly for JSON writing
  const getCleanExportData = () => {
    return tasks.map((task) => ({
      id: task.id,
      status: task.status,
      image: task.image ?? "",
      text: task.text ?? "Name",
      secondText: task.secondText ?? "Title",
      thirdText: task.thirdText ?? "Questions",
    }));
  };

  // CORE UPDATE: Saves directly to the system JSON file
  const handleSaveAllCards = async () => {
    const freshData = JSON.stringify(getCleanExportData(), null, 2);

    // If the browser supports native file picking & saving
    if ('showSaveFilePicker' in window) {
      try {
        let currentHandle = fileHandle;
        
        // If we don't have a linked file context yet, prompt user to select/replace their json file
        if (!currentHandle) {
          const options = {
            suggestedName: 'cards-data.json',
            types: [{
              description: 'JSON Files',
              accept: { 'application/json': ['.json'] },
            }],
          };
          currentHandle = await window.showSaveFilePicker(options);
          setFileHandle(currentHandle);
        }

        // Overwrite the selected local file directly
        const writable = await currentHandle.createWritable();
        await writable.write(freshData);
        await writable.close();
        alert("Changes saved directly to your JSON file successfully!");
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error("Direct save failed, using fallback anchor:", err);
          runClassicDownloadFallback(freshData);
        }
      }
    } else {
      // Standard browser fallback download behavior
      runClassicDownloadFallback(freshData);
    }
  };

  const runClassicDownloadFallback = (jsonDataText) => {
    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(jsonDataText)}`;
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', jsonString);
    downloadAnchor.setAttribute('download', 'cards-data.json');
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Synchronize dynamic JSON uploads and remember its system handle
  const handleUploadJson = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsedData = JSON.parse(event.target.result);
        if (Array.isArray(parsedData)) {
          setTasks(parsedData.map(t => ({ ...t, status: t.status ?? '1' })));
          // Reset file handle on manual non-API upload streams
          setFileHandle(null); 
        } else {
          alert("Invalid file structure.");
        }
      } catch (error) {
        alert("Error parsing JSON data.");
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="p-4">
      <div className="flex gap-4 mb-4 items-center">
        <button onClick={addTaskToFirstColumn} className="bg-neutral-800 hover:bg-neutral-700 text-white font-bold py-2 px-4 rounded shadow transition-colors cursor-pointer">
          + Add Task
        </button>
        
        <button onClick={handleSaveAllCards} className="bg-green-600 hover:bg-green-500 text-white font-bold py-2 px-4 rounded shadow transition-colors cursor-pointer">
          Save All Cards Data
        </button>

        

        <input type="file" ref={fileInputRef} onChange={handleUploadJson} accept=".json" className="hidden" />
      </div>

      <div className="flex gap-8">
        <DndContext onDragEnd={handleDragEnd}>
          {COLUMNS.map((column) => (
            <Column 
              key={column.id} 
              column={column} 
              tasks={tasks.filter((task) => task.status === column.id)} 
              onDeleteTask={deleteTask} 
              onUpdateTask={updateTask} 
            />
          ))}
        </DndContext>
      </div>
    </div>
  );
}
