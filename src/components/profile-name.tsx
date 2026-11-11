"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { NicknameForm, useSession } from "./session";

export function ProfileName({ name }: { name: string }) {
  const router = useRouter();
  const { saveName } = useSession();
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <div className="w-full max-w-sm">
        <NicknameForm
          initial={name}
          cta="Save"
          onSubmit={async (n) => {
            await saveName(n);
            setEditing(false);
            router.refresh();
          }}
        />
      </div>
    );
  }
  return (
    <div>
      <p className="text-sm text-muted">Playing as</p>
      <h1 className="font-display text-4xl font-black md:text-5xl">{name}</h1>
      <button className="mt-1 text-sm text-cool underline-offset-2 hover:underline" onClick={() => setEditing(true)}>
        Change nickname
      </button>
    </div>
  );
}
