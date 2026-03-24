import { useTheme } from "../../theme-provider";
import { Button } from "../../ui/button";
import { IconSun, IconMoon } from "@tabler/icons-react";

export const ThemeToggler = () => {
  const { theme, setTheme } = useTheme();

  return (
    <Button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      variant="ghost"
      size={"icon-xs"}
    >
      {theme === "dark" ? <IconMoon size={18} /> : <IconSun size={18} />}
    </Button>
  );
};
