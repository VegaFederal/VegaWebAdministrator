import { useState, useEffect } from 'react';
import { TaskCard } from './TaskCard.jsx';
import { CreateCardModal } from './CreateCardModal.jsx';
import { DeleteConfirmationModal } from './DeleteConfirmationModal.jsx';
import { DndContext, closestCenter } from '@dnd-kit/core';
import { SortableContext, arrayMove, rectSortingStrategy } from '@dnd-kit/sortable';
import React, { useRef } from 'react';

const API_URL = import.meta.env.VITE_API_URL;

// Maps a DynamoDB team-member record onto the board's card shape
function memberToTask(member) {
  return {
    id: String(member.id),
    image: member.image ?? "",
    name: member.name ?? "Name",
    title: member.title ?? "Title",
    details: Array.isArray(member.details) ? member.details : (member.details ? [member.details] : ["Questions"]),
    veteranLogo: member.veteranLogo ?? null,
    memberOrder: member.memberOrder ?? 0,
  };
}

export default function App() {
  const [tasks, setTasks] = useState([]);
  const [currentTasks, setCurrentTasks] = useState([]);
  const [isSavingAll, setIsSavingAll] = useState(false);
  const [showCreateCardModal, setShowCreateModal] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [formError, setFormError] = useState('');
  const [focusedTaskId, setFocusedTaskId] = useState(null);

  const emptyDraft = {
      id: "",
      image: "",
      name: "",
      title: "",
      details: ["Questions"],
      veteranLogo: null,
      memberOrder: "",
  };
  const [draft, setDraft] = useState(emptyDraft);

  const orders = [...tasks]
    .sort((a, b) => a.memberOrder - b.memberOrder)
    .map(task => ({
      id: task.id,
      memberOrder: task.memberOrder,
    }));

  const currentOrders = [...currentTasks]
    .sort((a, b) => a.memberOrder - b.memberOrder)
    .map(task => ({
      id: task.id,
      memberOrder: task.memberOrder,
    }));

  const hasUnsavedCardChanges = tasks.some(task => task.isDirty === true || task.isNew);
  const hasUnsavedCardOrder =
    orders.length !== currentOrders.length ||
    orders.some((order, index) => order.id !== currentOrders[index]?.id);
  const allTasksHaveRequiredFields = tasks.every(hasRequiredFields);
  const unsavedChanges = hasUnsavedCardChanges || hasUnsavedCardOrder;

  useEffect(() => {
    if (!API_URL) {
      setLoadError("VITE_API_URL is not configured.");
      setIsLoading(false);
      return;
    }

    fetch(API_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`API returned ${res.status}`);
        return res.json();
      })
      .then((members) => {setTasks(members.map(memberToTask)); setCurrentTasks(members.map(memberToTask));})
      .catch((err) => setLoadError(err.message))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    if (!unsavedChanges) return;

    const handleBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [unsavedChanges]);

  function addTask(card) {
    setTasks(prevTasks => [...prevTasks, card]);
    setFocusedTaskId(card.id);
  }

  function hasRequiredFields(card){

    if (!card || typeof card !== "object"){
      return false;
    }

    const requiredValues = [
      card.name,
      card.title,
      card.image
    ];

    return requiredValues.every(
      value =>
        typeof value === "string" &&
        value.trim().length > 0
    );
  }

  function addDraft(event){

    event.preventDefault();

    if (!hasRequiredFields(draft)) {
      setFormError("Image, name, and title are required");
      return;
    }
    // Find the highest existing ID and increment it by 1
    const nextId = tasks.length > 0 ? Math.max(...tasks.map(task => Number(task.id) || 0)) + 1 : 1;
    const nextOrder = tasks.length > 0 ? Math.max(...tasks.map(task => task.memberOrder ?? 0)) + 1 : 1;

    const newTask = {
      ...draft,
      id: String(nextId),
      memberOrder: nextOrder,
      isNew: true,
    };

    addTask(newTask);
    setFormError('');
    closeCardModal();
  }

  function openCardModal() {
    setDraft(emptyDraft);
    setFormError('');
    setShowCreateModal(true);
  }

  function closeCardModal() {
    setShowCreateModal(false);
  }

  function updateDraft(key, value) {
    setDraft(previousDraft => ({
      ...previousDraft,
      [key]: value,
    }));
  }

  function promptDeleteTask(taskId){
    setTaskToDelete(taskId);
    setShowDeleteConfirmation(true);
  }

  function closeDeleteConfirmation() {
    setShowDeleteConfirmation(false);
    setTaskToDelete(null);
  }

  async function deleteTask() {
    if (taskToDelete === null) return;

    const task = tasks.find(t => t.id === taskToDelete);
    if (!task) return;

    if (!task.isNew) {
      const response = await fetch(`${API_URL}/${taskToDelete}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }
    }

    setTasks(prevTasks => prevTasks.filter(t => t.id !== taskToDelete));
    setCurrentTasks(prevTasks => prevTasks.filter(t => t.id !== taskToDelete));
    closeDeleteConfirmation();
  }

  function tasksAreEqual(task, originalTask) {
    return (
      task.name === originalTask.name &&
      task.title === originalTask.title &&
      task.image === originalTask.image &&
      task.veteranLogo === originalTask.veteranLogo &&
      JSON.stringify(task.details) === JSON.stringify(originalTask.details)
    );
  }

  function updateTask(taskId, updatedTask) {
    const originalTask =  currentTasks.find(task => task.id === taskId)

    const isDirty = originalTask ? !tasksAreEqual(updatedTask, originalTask) : false;

    setTasks(prevTasks => prevTasks.map(task => (task.id === taskId ? { ...updatedTask, isDirty } : task)) );
  }

  async function createTaskRequest(task) {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        memberOrder: task.memberOrder,
        name: task.name,
        title: task.title,
        details: task.details,
        veteranLogo: task.veteranLogo,
        image: task.image,
      }),
    });

    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }

    const savedMember = await response.json();
    return memberToTask(savedMember);
  }

  async function updateTaskRequest(task, originalTask) {
    const payload = {
      memberOrder: task.memberOrder,
      name: task.name,
      title: task.title,
      details: task.details,
      veteranLogo: task.veteranLogo,
    };

    if (task.image !== originalTask?.image) {
      payload.image = task.image;
    }

    const response = await fetch(`${API_URL}/${task.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }

    const savedMember = await response.json();
    return memberToTask(savedMember);
  }

  async function saveCardOrder(taskList) {
    const orderUpdates = taskList.map(task => ({
      id: task.id,
      memberOrder: task.memberOrder,
    }));

    const response = await fetch(`${API_URL}/order`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ orders: orderUpdates }),
    });

    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }

    return response.json();
  }

  // Publishes a locally-created card to the live database + S3 via POST
  async function saveTask(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (!task || !hasRequiredFields(task)) return;

    const savedTask = await createTaskRequest(task);
    setTasks(prevTasks => prevTasks.map(t => (t.id === taskId ? savedTask : t)));
    setCurrentTasks(prevTasks => [...prevTasks, savedTask]);
    return savedTask;
  }

  async function saveUpdatedTask(taskId) {
    const task = tasks.find(t => t.id === taskId);
    const originalTask = currentTasks.find(t => t.id === taskId);
    if (!task) return;
    if (!hasRequiredFields(task)) {
      throw new Error('Name, title, and image are required');
    }

    const savedTask = await updateTaskRequest(task, originalTask);
    setTasks(prevTasks => prevTasks.map(t => (t.id === taskId ? savedTask : t)));
    setCurrentTasks(prevTasks => prevTasks.map(t => (t.id === taskId ? savedTask : t)));
    return savedTask;
  }

  // Reorders tasks by drag position and renumbers memberOrder to match
  function handleDragEnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setTasks(prevTasks => {
      const sorted = [...prevTasks].sort((a, b) => a.memberOrder - b.memberOrder);
      const oldIndex = sorted.findIndex(task => task.id === active.id);
      const newIndex = sorted.findIndex(task => task.id === over.id);
      const reordered = arrayMove(sorted, oldIndex, newIndex);
      return reordered.map((task, index) => ({ ...task, memberOrder: index + 1 }));
    });
  }

  async function handleSaveAllCards() {
    let workingTasks = [...tasks];
    let workingCurrentTasks = [...currentTasks];
    const shouldSaveOrder = hasUnsavedCardOrder;

    setIsSavingAll(true);

    try {
      const newTasks = workingTasks.filter(task => task.isNew);
      for (const task of newTasks) {
        const savedTask = await createTaskRequest(task);
        workingTasks = workingTasks.map(currentTask =>
          currentTask.id === task.id ? savedTask : currentTask
        );
        workingCurrentTasks = [...workingCurrentTasks, savedTask];
      }

      const updatedTasks = workingTasks.filter(task => !task.isNew && task.isDirty);
      for (const task of updatedTasks) {
        const originalTask = workingCurrentTasks.find(currentTask => currentTask.id === task.id);
        const savedTask = await updateTaskRequest(task, originalTask);
        workingTasks = workingTasks.map(currentTask =>
          currentTask.id === task.id ? savedTask : currentTask
        );
        workingCurrentTasks = workingCurrentTasks.map(currentTask =>
          currentTask.id === task.id ? savedTask : currentTask
        );
      }

      if (shouldSaveOrder) {
        await saveCardOrder(workingTasks);
      }

      setTasks(workingTasks);
      setCurrentTasks(workingTasks);
    } catch (error) {
      setTasks(workingTasks);
      setCurrentTasks(workingCurrentTasks);
      alert(`Failed to save all changes: ${error.message}`);
    } finally {
      setIsSavingAll(false);
    }
  }

  if (isLoading) {
    return <div className="p-4 text-white">Loading team members…</div>;
  }

  if (loadError) {
    return <div className="p-4 text-red-400">Failed to load team members: {loadError}</div>;
  }

  const sortedTasks = [...tasks].sort((a, b) => a.memberOrder - b.memberOrder);

  return (
    <div className="p-4">
      <header className="sticky top-4 z-40 mb-4 rounded-lg border border-neutral-700 bg-black/80 p-3 shadow-lg backdrop-blur">
        <div className="flex items-center gap-4">
          <button onClick={openCardModal} className="cursor-pointer">
            + Add Card
          </button>
          <button
            onClick={handleSaveAllCards}
            disabled={isSavingAll || !unsavedChanges || !allTasksHaveRequiredFields}
            className="cursor-pointer"
          >
            {isSavingAll ? 'Saving All…' : 'Save All'}
          </button>
          {hasUnsavedCardOrder && (
            <label className="block text-lg font-bold text-yellow-400 bg-yellow-950 border border-yellow-500 rounded-md px-3 py-2">
              Unsaved Card Order
            </label>
          )}
          {hasUnsavedCardChanges && (
            <label className="block text-lg font-bold text-red-500 bg-red-950 border border-red-500 rounded-md px-3 py-2">
              Unsaved Card Changes
            </label>
          )}
          {!allTasksHaveRequiredFields && (
            <label className="block text-lg font-bold text-red-500 bg-red-950 border border-red-500 rounded-md px-3 py-2">
              Cards Missing Required Fields
            </label>
          )}
        </div>
      </header>
      <div>
        {showCreateCardModal && (
          <CreateCardModal
            draft={draft}
            onUpdateDraft={updateDraft}
            onCancel={closeCardModal}
            error={formError}
            onSave={addDraft}
          />
        )}
        {showDeleteConfirmation && (
          <DeleteConfirmationModal
            onCancel={closeDeleteConfirmation}
            onConfirm={deleteTask}
          />
        )}
      </div>

      <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={sortedTasks.map(task => task.id)} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {sortedTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onDelete={promptDeleteTask}
                onUpdateTask={updateTask}
                shouldFocus={task.id === focusedTaskId}
                onSave={saveTask}
                onSaveUpdate={saveUpdatedTask}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
