import { CompareForm } from "@/components/CompareForm";
import { SiteHeader } from "@/components/SiteHeader";

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main className="min-h-[calc(100vh-56px)] bg-[var(--bg)] text-[var(--text)]">
        <CompareForm />
      </main>
    </>
  );
}
