"use client";

import { motion } from "motion/react";

import { EASE_OUT } from "@/components/motion";

/** A template re-mounts on every navigation, which gives each page its entrance. */
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: EASE_OUT }}
    >
      {children}
    </motion.div>
  );
}
