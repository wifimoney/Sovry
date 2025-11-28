"use client";

import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { BottomBar } from "./BottomBar";

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-zinc-950 flex">
      <Sidebar />
      <main className="flex-1 ml-16 pb-10">
        {children}
      </main>
      <BottomBar />
    </div>
  );
}

