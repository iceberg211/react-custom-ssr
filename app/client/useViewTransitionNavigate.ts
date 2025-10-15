import { startTransition, useCallback } from "react";
import type { NavigateOptions, To } from "react-router-dom";
import { useNavigate } from "react-router-dom";

type ViewTransitionNavigate = (to: To, options?: NavigateOptions) => void;

declare global {
  interface Document {
    startViewTransition?: (callback: () => void) => ViewTransition;
  }

  interface ViewTransition {
    finished: Promise<void>;
    ready: Promise<void>;
    updateCallbackDone: Promise<void>;
  }
}

const useViewTransitionNavigate = (): ViewTransitionNavigate => {
  const navigate = useNavigate();

  return useCallback<ViewTransitionNavigate>(
    (to, options) => {
      const executeNavigate = () => {
        startTransition(() => {
          navigate(to, options);
        });
      };

      if (
        typeof document !== "undefined" &&
        typeof document.startViewTransition === "function"
      ) {
        try {
          const transition = document.startViewTransition(executeNavigate);
          transition.finished.catch(() => {
            // 忽略取消或失败的转场 Promise
          });
          return;
        } catch (error) {
          console.warn("视图转场执行失败，回退到普通导航。", error);
        }
      }

      executeNavigate();
    },
    [navigate]
  );
};

export default useViewTransitionNavigate;
