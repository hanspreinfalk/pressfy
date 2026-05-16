export const AuthLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="min-h-screen min-w-screen flex flex-col h-full items-center justify-center">
      {children}
    </div>
  );
};
