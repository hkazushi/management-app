"use client";

import { useEffect, useState } from "react";
import { CHEER_EVENT } from "@/lib/cheer";
import { Manul } from "./Manul";
import { Meerkat } from "./Meerkat";

// 追加・保存のあとに、2匹が跳ねて一言出す。2秒ほどで消える。
export function Cheer() {
  const [msg, setMsg] = useState<{ text: string; key: number } | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const onCheer = (e: Event) => {
      setMsg({ text: (e as CustomEvent<string>).detail, key: Date.now() });
      clearTimeout(timer);
      timer = setTimeout(() => setMsg(null), 2400);
    };
    window.addEventListener(CHEER_EVENT, onCheer);
    return () => {
      window.removeEventListener(CHEER_EVENT, onCheer);
      clearTimeout(timer);
    };
  }, []);

  if (!msg) return null;
  return (
    <div
      key={msg.key}
      role="status"
      className="pop-in pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+92px)] z-30 flex justify-center px-4"
    >
      <div className="flex items-end gap-1">
        <Manul className="mascot-hop h-14 w-auto" />
        <p className="mb-3 rounded-2xl rounded-bl-sm border border-sun bg-primary-deep px-4 py-2 text-sm font-bold text-[#FAF4E4] shadow-hard-lg">
          {msg.text}
        </p>
        <Meerkat className="mascot-hop h-20 w-auto [animation-delay:0.12s]" />
      </div>
    </div>
  );
}
