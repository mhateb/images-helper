import { useCallback, useEffect, useRef, useState } from 'react';
import type { UploadSource } from '../components/Dropzone';
import { takeHandoffFiles } from '../utils/imageHandoff';
import { trackGoal, YM_GOALS } from '../analytics/ym';
import {
  createId,
  loadDimensions,
  MAX_FILES,
  mimeSummary,
  revokeResults,
  type ImageItem,
} from '../pages/home/imageItem';
import type { OptimizeResult } from '../types';

export function useImageQueue() {
  const [items, setItems] = useState<ImageItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [queueNotice, setQueueNotice] = useState<string | null>(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const active = items.find((item) => item.id === activeId) ?? items[0] ?? null;

  const updateItem = useCallback((id: string, patch: Partial<ImageItem>) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }, []);

  const replaceResults = useCallback(
    (id: string, results: OptimizeResult[], error: string | null) => {
      setItems((prev) =>
        prev.map((entry) => {
          if (entry.id !== id) return entry;
          revokeResults(entry.results);
          return { ...entry, results, error };
        }),
      );
    },
    [],
  );

  const addFiles = useCallback(
    async (files: File[], source: UploadSource = 'picker') => {
      if (files.length === 0) return;

      const remaining = MAX_FILES - itemsRef.current.length;
      if (remaining <= 0) {
        setQueueNotice(
          `Не больше ${MAX_FILES} файлов за раз. Удалите лишние или очистите очередь.`,
        );
        trackGoal(YM_GOALS.queueLimit, {
          files_count: files.length,
          queue_size: itemsRef.current.length,
          source,
        });
        return;
      }

      const accepted = files.slice(0, remaining);
      if (accepted.length < files.length) {
        setQueueNotice(
          `Добавлено ${accepted.length} из ${files.length}: лимит ${MAX_FILES} файлов за раз.`,
        );
        trackGoal(YM_GOALS.queueLimit, {
          files_count: files.length,
          accepted_count: accepted.length,
          queue_size: itemsRef.current.length,
          source,
        });
      } else {
        setQueueNotice(null);
      }

      const created: ImageItem[] = accepted.map((file) => ({
        id: createId(),
        file,
        imageUrl: URL.createObjectURL(file),
        dimensions: null,
        crop: undefined,
        results: [],
        error: null,
      }));

      setItems((prev) => [...prev, ...created]);
      setActiveId((prev) => prev ?? created[0].id);

      trackGoal(YM_GOALS.fileUpload, {
        files_count: accepted.length,
        source,
        mime_types: mimeSummary(accepted),
      });

      for (const item of created) {
        try {
          const dimensions = await loadDimensions(item.imageUrl);
          updateItem(item.id, { dimensions });
        } catch {
          updateItem(item.id, { error: 'Не удалось прочитать изображение.' });
        }
      }
    },
    [updateItem],
  );

  useEffect(() => {
    const handed = takeHandoffFiles();
    if (!handed || handed.length === 0) return;
    void addFiles(handed, 'analyze');
  }, [addFiles]);

  useEffect(() => {
    return () => {
      for (const item of itemsRef.current) {
        URL.revokeObjectURL(item.imageUrl);
        revokeResults(item.results);
      }
    };
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target) {
        URL.revokeObjectURL(target.imageUrl);
        revokeResults(target.results);
      }
      const next = prev.filter((item) => item.id !== id);
      setActiveId((current) => {
        if (current !== id) return current;
        return next[0]?.id ?? null;
      });
      return next;
    });
    setQueueNotice(null);
  }, []);

  const reset = useCallback(() => {
    setItems((prev) => {
      for (const item of prev) {
        URL.revokeObjectURL(item.imageUrl);
        revokeResults(item.results);
      }
      return [];
    });
    setActiveId(null);
    setQueueNotice(null);
  }, []);

  return {
    items,
    active,
    activeId,
    setActiveId,
    queueNotice,
    addFiles,
    updateItem,
    replaceResults,
    removeItem,
    reset,
  };
}
