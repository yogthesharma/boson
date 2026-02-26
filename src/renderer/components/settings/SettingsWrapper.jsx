export function SettingsWrapper({ children }) {
  return (
    <div className="h-full min-h-0 overflow-auto">
      <div className="mx-auto w-full max-w-4xl px-6 py-6 pt-12">
        {children}
      </div>
    </div>
  );
}
