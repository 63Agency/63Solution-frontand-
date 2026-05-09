"use client";

import { Toaster } from "sonner";

export function AppToaster() {
  return (
    <Toaster
      className="toaster-bw"
      theme="dark"
      position="top-right"
      closeButton
      richColors
      toastOptions={{
        className: "font-medium",
        classNames: {
          toast:
            "!border !border-zinc-700 !bg-black !text-white !shadow-xl !rounded-lg",
          title: "!text-white",
          description: "!text-zinc-300",
          success:
            "!border-emerald-700/70 !bg-black !text-white [&_[data-icon]]:!text-emerald-400",
          error: "!border-red-700/70 !bg-black !text-white [&_[data-icon]]:!text-red-400",
          info: "!border-zinc-700 !bg-black !text-white [&_[data-icon]]:!text-white",
          warning:
            "!border-amber-700/70 !bg-black !text-white [&_[data-icon]]:!text-amber-400",
          closeButton: "!border-zinc-700 !bg-zinc-900 !text-zinc-300 hover:!bg-zinc-800",
        },
      }}
    />
  );
}
