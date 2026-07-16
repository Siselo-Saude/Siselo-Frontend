import * as React from "react";
import { useToast } from "./use-toast";
import { Toast, ToastClose, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from "./toast";

function Toaster() {
  const { toasts, dismiss } = useToast();

  return (
    <ToastProvider>
      <ToastViewport>
        {toasts.map(({ id, title, description, action, variant }) => (
          <Toast key={id} variant={variant}>
            <div className="grid gap-1">
              {title ? <ToastTitle>{title}</ToastTitle> : null}
              {description ? <ToastDescription>{description}</ToastDescription> : null}
            </div>
            {action}
            <ToastClose onClick={() => dismiss(id)} />
          </Toast>
        ))}
      </ToastViewport>
    </ToastProvider>
  );
}

export { Toaster };
