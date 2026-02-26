// /src/hooks/useIntervalTasks.ts
// (comment) full path: src/hooks/useIntervalTasks.ts

import { useEffect, useRef, useCallback } from "react";

export type IntervalTask = {
  id: string;
  fn: () => void | Promise<void>;
};

export const useIntervalTasks = (time: number = 60_000) => {
  const tasksRef = useRef<IntervalTask[]>([]);

  const addTask = useCallback((id: string, fn: IntervalTask["fn"]) => {
    tasksRef.current = [
      ...tasksRef.current.filter((t) => t.id !== id), // evita duplicados
      { id, fn },
    ];
  }, []);

  const removeTask = useCallback((id: string) => {
    tasksRef.current = tasksRef.current.filter((t) => t.id !== id);
  }, []);

  const clearTasks = useCallback(() => {
    tasksRef.current = [];
  }, []);

  const runTasks = useCallback(async () => {
    // ejecuta en orden
    for (const task of tasksRef.current) {
      try {
        await task.fn();
      } catch (err) {
        console.log(`[useIntervalTasks] Task "${task.id}" failed:`, err);
      }
    }
  }, []);

  useEffect(() => {
    if (!time || time <= 0) return;

    const id = setInterval(() => {
      runTasks();
    }, time);

    return () => clearInterval(id);
  }, [time, runTasks]);

  return {
    addTask,
    removeTask,
    clearTasks,
    runTasks, // útil si quieres correr manualmente
  };
};
