import { useCallback, useEffect, useRef } from "react";

export type IntervalTask = {
  id: string;
  fn: () => void | Promise<void>;
};

export const useIntervalTasks = (time = 60_000) => {
  const tasksRef = useRef<IntervalTask[]>([]);

  const addTask = useCallback((id: string, fn: IntervalTask["fn"]) => {
    tasksRef.current = [
      ...tasksRef.current.filter((task) => task.id !== id),
      { id, fn },
    ];
  }, []);

  const removeTask = useCallback((id: string) => {
    tasksRef.current = tasksRef.current.filter((task) => task.id !== id);
  }, []);

  const clearTasks = useCallback(() => {
    tasksRef.current = [];
  }, []);

  const runTasks = useCallback(async () => {
    for (const task of tasksRef.current) {
      try {
        await task.fn();
      } catch (error) {
        console.log(`[useIntervalTasks] Task "${task.id}" failed:`, error);
      }
    }
  }, []);

  useEffect(() => {
    if (!time || time <= 0) return;

    const id = window.setInterval(() => {
      runTasks();
    }, time);

    return () => window.clearInterval(id);
  }, [time, runTasks]);

  return {
    addTask,
    removeTask,
    clearTasks,
    runTasks,
  };
};
