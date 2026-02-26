import { useState } from "react";
import {
  IconChevronDown,
  IconCheck,
  IconMoon,
  IconSun,
  IconDeviceDesktop,
} from "@tabler/icons-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

function SettingsRow({ label, description, children, id }) {
  return (
    <div className="flex flex-row items-center gap-6 py-3">
      <div className="min-w-0 flex-1">
        <label htmlFor={id} className="text-sm font-medium text-foreground">
          {label}
        </label>
        {description && (
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export function SettingsField({
  field,
  value,
  onChange,
  sectionValues,
  onSectionChange,
}) {
  const { key, label, type, description, options, min, max } = field;
  const id = `setting-${key}`;

  if (type === "boolean") {
    return (
      <SettingsRow label={label} description={description} id={id}>
        <ToggleSwitch checked={!!value} onChange={(v) => onChange(v)} />
      </SettingsRow>
    );
  }

  if (type === "checkbox") {
    return (
      <SettingsRow label={label} description={description} id={id}>
        <Checkbox
          id={id}
          checked={value === true}
          onCheckedChange={(checked) => onChange(checked === true)}
        />
      </SettingsRow>
    );
  }

  if (type === "enum") {
    const selected =
      (options || []).find((o) => o.value === value) || options?.[0];
    return (
      <SettingsRow label={label} description={description} id={id}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex min-w-[12rem] items-center justify-between gap-2 rounded-md bg-background px-3 py-2 text-sm text-foreground hover:bg-muted/50"
            >
              <span className="truncate">{selected?.label ?? value}</span>
              <IconChevronDown
                size={16}
                className="shrink-0 text-muted-foreground"
              />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="min-w-[var(--radix-dropdown-menu-trigger-width)]"
          >
            {(options || []).map((opt) => (
              <DropdownMenuItem
                key={opt.value}
                onClick={() => onChange(opt.value)}
                className="flex items-center justify-between gap-2"
              >
                {opt.label}
                {value === opt.value && (
                  <IconCheck size={14} className="text-primary" />
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </SettingsRow>
    );
  }

  if (type === "segmented") {
    return (
      <SettingsRow label={label} description={description} id={id}>
        <div className="flex rounded-md bg-muted/30 p-0.5">
          {(options || []).map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={cn(
                "rounded-md px-3 py-2 text-sm transition-colors",
                value === opt.value
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </SettingsRow>
    );
  }

  if (type === "theme") {
    const themeOptions = options || [
      { value: "light", label: "Light" },
      { value: "dark", label: "Dark" },
      { value: "system", label: "System" },
    ];
    const icons = { light: IconSun, dark: IconMoon, system: IconDeviceDesktop };
    return (
      <SettingsRow label={label} description={description} id={id}>
        <div className="flex rounded-md bg-muted/30 p-0.5">
          {themeOptions.map((opt) => {
            const Icon = icons[opt.value];
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onChange(opt.value)}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-2 text-sm transition-colors",
                  value === opt.value
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {Icon && <Icon size={16} stroke={1.5} />}
                {opt.label}
              </button>
            );
          })}
        </div>
      </SettingsRow>
    );
  }

  if (type === "font" && sectionValues && onSectionChange) {
    const sizeKey = field.sizeKey;
    const familyKey = field.familyKey;
    const size = sectionValues[sizeKey] ?? 13;
    const family = sectionValues[familyKey] ?? "";
    return (
      <SettingsRow label={label} description={description} id={id}>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={min ?? 10}
            max={max ?? 24}
            value={size}
            onChange={(e) => {
              const n = parseInt(e.target.value, 10);
              if (!Number.isNaN(n)) onSectionChange({ [sizeKey]: n });
            }}
            className="w-14 rounded-md bg-background px-2 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
          />
          <span className="text-sm text-muted-foreground">px</span>
          <input
            type="text"
            value={family}
            onChange={(e) => onSectionChange({ [familyKey]: e.target.value })}
            className="min-w-[200px] flex-1 rounded-md bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring sm:min-w-[240px]"
          />
        </div>
      </SettingsRow>
    );
  }

  if (type === "number") {
    return (
      <SettingsRow label={label} description={description} id={id}>
        <input
          id={id}
          type="number"
          min={min ?? 0}
          max={max ?? 100}
          value={value ?? ""}
          onChange={(e) => {
            const n = parseInt(e.target.value, 10);
            if (!Number.isNaN(n)) onChange(n);
          }}
          className="w-24 rounded-md bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
        />
      </SettingsRow>
    );
  }

  if (type === "string") {
    return (
      <SettingsRow label={label} description={description} id={id}>
        <input
          id={id}
          type="text"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className="min-w-[200px] rounded-md bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring sm:min-w-[240px]"
        />
      </SettingsRow>
    );
  }

  return null;
}
