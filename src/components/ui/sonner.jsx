import * as React from "react";
import { Toaster as BaseToaster } from "./toaster";
import { toast } from "./use-toast";

function Toaster(props) {
  return <BaseToaster {...props} />;
}

export { Toaster, toast };
