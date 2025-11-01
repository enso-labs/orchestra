import { useCallback } from "react";
import { useNavigate } from "react-router-dom";

/**
 * Hook to handle click navigation (internal/app and new tab logic).
 * Usage: const handleLinkClick = useLinkClick("/path");
 */
const useLinkClick = (url: string) => {
  const navigate = useNavigate();

  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLButtonElement | HTMLAnchorElement>) => {
      if (event.ctrlKey || event.metaKey) {
        // Open in new tab if Ctrl or Cmd key pressed
        window.open(url, "_blank", "noopener,noreferrer");
      } else {
        // Normal navigation within app
        navigate(url);
      }
    },
    [navigate, url],
  );

  return handleClick;
};

export default useLinkClick;
