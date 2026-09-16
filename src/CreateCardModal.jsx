
import { useRef } from 'react';
import defaultImage from './assets/add_Photo.png';

export function CreateCardModal({
  draft,
  error,
  onTextChange,
  onImageChange,
  onCancel,
  onSave,
}) {
  const fileInputRef = useRef(null);
  const cardImage = draft.image || defaultImage;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-card-heading"
    >
      <form
        onSubmit={onSave}
        className="relative w-full max-w-sm rounded-lg bg-neutral-700 p-4 shadow-xl"
      >
        <button
          type="button"
          onClick={onCancel}
          className="absolute right-2 top-2 z-10 border-0 p-1 text-sm text-neutral-400 transition-colors hover:text-vega-red"
          aria-label="Close create card dialog"
        >
          ✕
        </button>

        <h2 id="create-card-heading" className="mb-4 text-center text-lg font-semibold text-white">
          Create Card
        </h2>

        <div className="mb-4 flex flex-col items-center">
          <div className="mb-2 overflow-hidden rounded-md border border-neutral-600">
            <img
              src={cardImage}
              alt="New card preview"
              className="h-[200px] w-[200px] object-cover"
            />
          </div>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="cursor-pointer px-3 py-1.5 text-xs"
          >
            Choose Photo
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={onImageChange}
            className="hidden"
            required
          />
        </div>

        <label className="block px-5 py-2.5 text-xs font-semibold text-neutral-300">
          Veteran Status
          <select 
            value={draft.veteranLogo ?? ''}
            onChange={onTextChange}
            className="mt-1 w-full rounded-md border-2 border-grayscale-700 bg-grayscale-700 px-2 py-1 text-white shadow-lg outline-none"
            >
            <option value="">None (Null)</option>
            <option value="vetArmy">Army</option>
            <option value="vetNavy">Navy</option>
          </select> 
        </label>

        <label className="block px-5 py-2.5 text-xs font-semibold text-neutral-300">
          Name
          <input
            name="name"
            type="text"
            value={draft.name ?? ''}
            onChange={onTextChange}
            placeholder="Name"
            className="mt-1 w-full"
            required
          />
        </label>

        <label className="block px-5 py-2.5 text-xs font-semibold text-neutral-300">
          Title
          <input
            name="title"
            type="text"
            value={draft.title ?? ''}
            onChange={onTextChange}
            placeholder="Title"
            className="mt-1 w-full"
            required
          />
        </label>

        <label className="block px-5 py-2.5 text-xs font-semibold text-neutral-300">
          Question Answers
          <textarea
            defaultValue={draft.details ?? ''}
            onChange={onTextChange}
            rows={3}
            className="mt-1 min-h-[5.25rem] w-full resize-y rounded-md border-2 border-grayscale-700 bg-grayscale-700 px-2 py-2 font-sans text-sm font-normal text-white shadow-lg outline-none"
          />
        </label>

        {error && (
          <p className="px-5 py-2 text-sm text-red-400" role="alert">
            {error}
          </p>
        )}

        <div className="mt-4 flex justify-end gap-2 border-t border-neutral-600 pt-4">
          <button type="button" onClick={onCancel} className="cursor-pointer">
            Cancel
          </button>

          <button type="submit" className="cursor-pointer">
            Save Card
          </button>
        </div>
      </form>
    </div>
  );
}
