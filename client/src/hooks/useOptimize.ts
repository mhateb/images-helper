import { useMutation } from '@tanstack/react-query';
import { optimizeImage } from '../api/optimize';
import type { OptimizeParams, OptimizeResult } from '../types';

export function useOptimize() {
  return useMutation<OptimizeResult, Error, OptimizeParams>({
    mutationFn: optimizeImage,
  });
}
