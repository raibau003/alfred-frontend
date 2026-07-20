"use client";

interface Action {
  label: string;
  message: string;
}

interface Props {
  actions: Action[];
  onAction: (message: string) => void;
}

export function ActionButtons({ actions, onAction }: Props) {
  if (!actions || actions.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {actions.map((action, i) => (
        <button
          key={i}
          onClick={() => onAction(action.message)}
          className="flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs text-blue-700 hover:bg-blue-100 transition-colors"
        >
          {action.label}
        </button>
      ))}
    </div>
  );
}
