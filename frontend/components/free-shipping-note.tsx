"use client";

import { useEffect, useState } from "react";
import { Truck } from "lucide-react";
import { api } from "@/lib/api";
import type { StoreConfig } from "@/lib/types";
import { cn } from "@/lib/utils";

export function FreeShippingNote({ withIcon = false, className }: { withIcon?: boolean; className?: string }) {
  const [threshold, setThreshold] = useState("75");

  useEffect(() => {
    let alive = true;
    api
      .get<StoreConfig>("/store/config/")
      .then((config) => {
        if (alive && config.free_shipping_threshold) {
          setThreshold(String(Number(config.free_shipping_threshold)));
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      {withIcon && <Truck size={15} />} Free shipping over ${threshold}
    </span>
  );
}
