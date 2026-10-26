"use client";

import { useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

const options = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

// The saved theme is only known in the browser; false during the server render
const subscribe = () => () => {};
function useIsClient() {
  return useSyncExternalStore(subscribe, () => true, () => false);
}

export function ThemePicker() {
  const { theme, setTheme } = useTheme();
  const isClient = useIsClient();

  return (
    <ToggleGroup
      type="single"
      variant="outline"
      size="lg"
      value={isClient ? theme : undefined}
      // Ignore clicks on the already-selected option, which would clear the value
      onValueChange={(value) => value && setTheme(value)}
      aria-label="Theme"
    >
      {options.map(({ value, label, icon: Icon }) => (
        <ToggleGroupItem key={value} value={value} className="px-4">
          <Icon /> {label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
