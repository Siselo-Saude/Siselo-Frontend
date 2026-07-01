import * as React from "react";

const listeners = [];
let memoryState = { toasts: [] };
let count = 0;

function emit(nextState) {
  memoryState = nextState;
  listeners.forEach((listener) => listener(memoryState));
}

function toast({ title, description, variant = "default", duration = 4000, ...props }) {
  const id = String(++count);
  const nextToast = { id, title, description, variant, ...props };
  emit({ toasts: [nextToast, ...memoryState.toasts] });

  if (duration !== Infinity) {
    setTimeout(() => dismissToast(id), duration);
  }

  return {
    id,
    dismiss: () => dismissToast(id),
    update: (updates) => updateToast(id, updates),
  };
}

function dismissToast(id) {
  emit({ toasts: memoryState.toasts.filter((toastItem) => toastItem.id !== id) });
}

function updateToast(id, updates) {
  emit({
    toasts: memoryState.toasts.map((toastItem) =>
      toastItem.id === id ? { ...toastItem, ...updates } : toastItem,
    ),
  });
}

function useToast() {
  const [state, setState] = React.useState(memoryState);

  React.useEffect(() => {
    listeners.push(setState);
    return () => {
      const index = listeners.indexOf(setState);
      if (index > -1) listeners.splice(index, 1);
    };
  }, []);

  return {
    ...state,
    toast,
    dismiss: dismissToast,
  };
}

export { useToast, toast };
