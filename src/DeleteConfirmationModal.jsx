export function DeleteConfirmationModal({ onCancel, onConfirm }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="delete-card-confirmation"
      aria-describedby="delete-card-description"
    >
      <div className="w-full max-w-sm rounded-lg border border-neutral-600 bg-neutral-700 p-6 shadow-xl">
        <h2
          id="delete-card-confirmation"
          className="text-lg font-semibold text-white"
        >
          Delete Card?
        </h2>

        <p
          id="delete-card-description"
          className="mt-2 text-sm leading-6 text-neutral-300"
        >
          This permanently removes the card from the current list. This action cannot be undone.
        </p>

        <div className="mt-6 flex justify-end gap-2 border-t border-neutral-600 pt-4">
          <button
            type="button"
            onClick={onCancel}
            className="cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onConfirm}
            className="cursor-pointer border-vega-red text-vega-red hover:bg-vega-red hover:text-white"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
