import "./globals.css";
import { AuthProvider } from "../contexts/AuthContext";
import AppShell from "../components/AppShell";

export const metadata = {
  title: "KINGS ARENA - Esports Tournament Platform",
  description: "A modern esports tournament platform for competitive gaming communities. Organize tournaments, fixtures, rankings, and more for Dream League Soccer, eFootball, FC Mobile, and Call of Duty.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <AppShell>{children}</AppShell>
        </AuthProvider>
      </body>
    </html>
  );
}
