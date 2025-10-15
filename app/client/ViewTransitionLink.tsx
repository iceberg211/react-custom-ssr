import type { MouseEvent } from "react";
import { useCallback } from "react";
import {
  Link,
  type LinkProps,
} from "react-router-dom";
import useViewTransitionNavigate from "./useViewTransitionNavigate";

type ViewTransitionLinkProps = LinkProps & {
  viewTransitionName?: string;
};

const shouldIgnoreClick = (event: MouseEvent<HTMLAnchorElement>) =>
  event.defaultPrevented ||
  event.button !== 0 ||
  event.metaKey ||
  event.altKey ||
  event.ctrlKey ||
  event.shiftKey;

const ViewTransitionLink = ({
  onClick,
  to,
  replace,
  state,
  preventScrollReset,
  relative,
  viewTransitionName,
  ...rest
}: ViewTransitionLinkProps) => {
  const navigateWithTransition = useViewTransitionNavigate();

  const handleClick = useCallback(
    (event: MouseEvent<HTMLAnchorElement>) => {
      onClick?.(event);

      if (shouldIgnoreClick(event)) {
        return;
      }

      event.preventDefault();

      if (viewTransitionName && event.currentTarget) {
        event.currentTarget.style.setProperty(
          "view-transition-name",
          viewTransitionName
        );
      }

      navigateWithTransition(to, {
        replace,
        state,
        preventScrollReset,
        relative,
      });
    },
    [
      navigateWithTransition,
      onClick,
      preventScrollReset,
      relative,
      replace,
      state,
      to,
      viewTransitionName,
    ]
  );

  return (
    <Link
      {...rest}
      to={to}
      replace={replace}
      state={state}
      preventScrollReset={preventScrollReset}
      relative={relative}
      onClick={handleClick}
    />
  );
};

export default ViewTransitionLink;
