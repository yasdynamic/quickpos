import { useState } from "react";
import { CircleDollarSign, Users, Mail, Printer, ShieldCheck } from "lucide-react";
import CurrencySection from "@/components/settings/CurrencySection";
import UsersSection from "@/components/settings/UsersSection";
import SmtpSection from "@/components/settings/SmtpSection";
import PrintSection from "@/components/settings/PrintSection";
import NF525Section from "@/components/settings/NF525Section";

const TABS = [
  { id: "currency", label: "Devise", icon: CircleDollarSign },
  { id: "users", label: "Utilisateurs", icon: Users },
  { id: "smtp", label: "Email SMTP", icon: Mail },
  { id: "print", label: "Impression", icon: Printer },
  { id: "nf525", label: "NF525 & Fidélité", icon: ShieldCheck },
];

export default function SettingsPage() {
  const [active, setActive] = useState("currency");

  return (
    <div className="p-8">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-[0.1em] font-semibold text-slate-500">
          Configuration
        </p>
        <h1 className="text-4xl font-bold tracking-tight">Paramètres</h1>
      </header>

      <div className="flex gap-2 mb-6 border-b border-[#E5E7EB]" data-testid="settings-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            data-testid={`settings-tab-${t.id}`}
            onClick={() => setActive(t.id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold uppercase tracking-wider border-b-2 transition-colors ${
              active === t.id
                ? "border-[#002FA7] text-[#002FA7]"
                : "border-transparent text-slate-500 hover:text-[#0A0A0A]"
            }`}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      {active === "currency" && <CurrencySection />}
      {active === "users" && <UsersSection />}
      {active === "smtp" && <SmtpSection />}
      {active === "print" && <PrintSection />}
      {active === "nf525" && <NF525Section />}
    </div>
  );
}
