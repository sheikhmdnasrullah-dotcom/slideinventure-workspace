import { ThemeProvider } from "@/components/theme-provider";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="day"
      enableSystem={false}
      disableTransitionOnChange
      value={{ day: "light", night: "dark" }}
    >
      {children}
    </ThemeProvider>
  );
}