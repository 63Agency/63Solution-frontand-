"use client";

type Props = {
  label: string;
};

export function ChatDateDivider({ label }: Props) {
  return (
    <div className="my-3 flex justify-center">
      <span
        className="rounded-[7.5px] px-3 py-1.5 text-[12.5px] font-medium capitalize shadow-sm"
        style={{
          backgroundColor: "#182229",
          color: "#8696a0",
        }}
      >
        {label}
      </span>
    </div>
  );
}
