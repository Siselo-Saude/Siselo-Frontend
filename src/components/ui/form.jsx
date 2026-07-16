import * as React from "react";
import { cn, useStableId } from "../../lib/utils";
import { Label } from "./label";

const Form = React.forwardRef(({ className, ...props }, ref) => (
  <form ref={ref} className={cn("grid gap-4", className)} {...props} />
));
Form.displayName = "Form";

const FormFieldContext = React.createContext({});

function FormField({ name, children }) {
  return <FormFieldContext.Provider value={{ name }}>{children}</FormFieldContext.Provider>;
}

function useFormField() {
  const context = React.useContext(FormFieldContext);
  const id = useStableId(context.name || "form-item");
  return {
    id,
    name: context.name,
    formItemId: `${id}-item`,
    formDescriptionId: `${id}-description`,
    formMessageId: `${id}-message`,
  };
}

const FormItem = React.forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("space-y-2", className)} {...props} />
));
FormItem.displayName = "FormItem";

const FormLabel = React.forwardRef(({ className, ...props }, ref) => {
  const { formItemId } = useFormField();
  return <Label ref={ref} htmlFor={formItemId} className={className} {...props} />;
});
FormLabel.displayName = "FormLabel";

const FormControl = React.forwardRef(({ children, ...props }, ref) => {
  const { formItemId, formDescriptionId, formMessageId } = useFormField();
  if (!React.isValidElement(children)) return children;
  return React.cloneElement(children, {
    ref,
    id: formItemId,
    "aria-describedby": `${formDescriptionId} ${formMessageId}`,
    ...props,
  });
});
FormControl.displayName = "FormControl";

const FormDescription = React.forwardRef(({ className, ...props }, ref) => {
  const { formDescriptionId } = useFormField();
  return <p ref={ref} id={formDescriptionId} className={cn("text-sm text-muted-foreground", className)} {...props} />;
});
FormDescription.displayName = "FormDescription";

const FormMessage = React.forwardRef(({ className, children, ...props }, ref) => {
  const { formMessageId } = useFormField();
  if (!children) return null;
  return <p ref={ref} id={formMessageId} className={cn("text-sm font-medium text-destructive", className)} {...props}>{children}</p>;
});
FormMessage.displayName = "FormMessage";

export { Form, FormField, FormItem, FormLabel, FormControl, FormDescription, FormMessage, useFormField };
