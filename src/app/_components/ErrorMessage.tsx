type ErrorMessageProps = {
  message: string;
  title?: string;
  className?: string;
};

export function ErrorMessage({ message, title = "Something went wrong", className = "" }: ErrorMessageProps) {
  return (
    <div
      role="alert"
      className={`rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200 ${className}`}
    >
      <div className="font-medium">{title}</div>
      <div className="mt-0.5">{message}</div>
    </div>
  );
}
