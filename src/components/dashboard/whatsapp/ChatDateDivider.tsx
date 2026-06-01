"use client";

type Props = {
  label: string;
};

export function ChatDateDivider({ label }: Props) {
  return (
    <div className="my-4 flex justify-center">
      <span className="rounded-lg bg-[#182229] px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-zinc-400 shadow-sm">
        {label}
      </span>
    </div>
  );
}
