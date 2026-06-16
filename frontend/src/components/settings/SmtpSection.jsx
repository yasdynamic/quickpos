import { useEffect, useState } from "react";
import { Mail, Send, CheckCircle2, AlertTriangle, X, Plus, AtSign } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useSettings } from "@/context/SettingsContext";

const PRESETS = [
  { name: "Gmail", host: "smtp.gmail.com", port: 587, use_tls: true },
  { name: "Outlook 365", host: "smtp.office365.com", port: 587, use_tls: true },
  { name: "OVH", host: "ssl0.ovh.net", port: 465, use_tls: true },
  { name: "Mailgun", host: "smtp.mailgun.org", port: 587, use_tls: true },
  { name: "SendGrid", host: "smtp.sendgrid.net", port: 587, use_tls: true },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SmtpSection() {
  const { settings, save, reload } = useSettings();
  const [form, setForm] = useState(settings.smtp);
  const [recipients, setRecipients] = useState(settings.report_recipients || []);
  const [recipientInput, setRecipientInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [savingRecipients, setSavingRecipients] = useState(false);
  const [testTo, setTestTo] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  useEffect(() => {
    setForm(settings.smtp);
    setRecipients(settings.report_recipients || []);
  }, [settings]);

  const addRecipient = () => {
    const raw = recipientInput.trim().toLowerCase();
    if (!raw) return;
    // accept comma-separated batch
    const parts = raw.split(/[,;\s]+/).filter(Boolean);
    const next = [...recipients];
    let added = 0;
    for (const p of parts) {
      if (!EMAIL_RE.test(p)) {
        toast.error(`Adresse invalide : ${p}`);
        continue;
      }
      if (next.includes(p)) continue;
      next.push(p);
      added++;
    }
    if (added > 0) setRecipients(next);
    setRecipientInput("");
  };

  const removeRecipient = (email) => {
    setRecipients(recipients.filter((r) => r !== email));
  };

  const saveRecipients = async () => {
    setSavingRecipients(true);
    try {
      await save({ report_recipients: recipients });
      toast.success("Destinataires enregistrés");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Erreur");
    } finally {
      setSavingRecipients(false);
    }
  };

  const submit = async () => {
    setSaving(true);
    try {
      await save({ smtp: form });
      toast.success("Configuration SMTP enregistrée");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Erreur");
    } finally {
      setSaving(false);
    }
  };

  const runTest = async () => {
    if (!testTo) {
      toast.error("Saisissez une adresse destinataire");
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      await save({ smtp: form });
      const res = await api.post("/settings/smtp/test", { to: testTo });
      setTestResult(res.data);
      if (res.data.status === "sent") {
        toast.success(`Email de test envoyé à ${testTo}`);
      } else {
        toast.error(res.data.error || "Erreur");
      }
      reload();
    } catch (err) {
      setTestResult({ status: "error", error: err?.response?.data?.detail });
      toast.error(err?.response?.data?.detail || "Erreur");
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Recipients section */}
      <section className="rounded-md border border-[#E5E7EB] bg-white p-6 max-w-3xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[#10B981] text-white">
            <AtSign className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider font-semibold text-slate-500">
              Diffusion
            </p>
            <h2 className="text-xl font-bold">Destinataires des rapports</h2>
          </div>
        </div>

        <p className="mb-4 text-sm text-[#4B5563]">
          Tous les rapports (Z, journalier, mensuel) sont envoyés automatiquement aux
          adresses listées ici. Vous pouvez en ajouter autant que nécessaire (gérant,
          comptable, propriétaire…).
        </p>

        <div className="flex gap-2 mb-3">
          <input
            data-testid="recipient-input"
            type="text"
            value={recipientInput}
            onChange={(e) => setRecipientInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === "," || e.key === " ") {
                e.preventDefault();
                addRecipient();
              }
            }}
            placeholder="email@example.com (Entrée ou virgule pour ajouter)"
            className="flex-1 rounded-md border border-[#E5E7EB] px-4 py-2.5 outline-none focus:border-[#002FA7]"
          />
          <button
            data-testid="add-recipient-btn"
            type="button"
            onClick={addRecipient}
            className="flex items-center gap-1 rounded-md bg-[#002FA7] px-4 py-2.5 text-sm font-bold uppercase tracking-wider text-white hover:bg-[#002277] active:scale-95"
          >
            <Plus className="h-4 w-4" />
            Ajouter
          </button>
        </div>

        {recipients.length === 0 ? (
          <p className="text-sm text-slate-400 italic mb-4">
            Aucun destinataire — les rapports ne seront pas envoyés automatiquement.
          </p>
        ) : (
          <ul className="flex flex-wrap gap-2 mb-4" data-testid="recipients-list">
            {recipients.map((email) => (
              <li
                key={email}
                className="group flex items-center gap-2 rounded-full border border-[#E5E7EB] bg-[#FAFAFA] pl-3 pr-1 py-1.5 text-sm"
              >
                <AtSign className="h-3.5 w-3.5 text-slate-400" />
                <span className="font-mono">{email}</span>
                <button
                  data-testid={`remove-recipient-${email}`}
                  onClick={() => removeRecipient(email)}
                  className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-red-50 text-slate-400 hover:text-[#FF2A2A]"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <button
          data-testid="save-recipients"
          onClick={saveRecipients}
          disabled={savingRecipients}
          className="h-12 w-full sm:w-auto sm:px-8 rounded-md bg-[#10B981] text-sm font-bold uppercase tracking-wider text-white hover:bg-emerald-600 active:scale-95 disabled:opacity-50"
        >
          {savingRecipients ? "Enregistrement…" : "Enregistrer les destinataires"}
        </button>
      </section>

      {/* SMTP config section */}
      <section className="rounded-md border border-[#E5E7EB] bg-white p-6 max-w-3xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[#002FA7] text-white">
            <Mail className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider font-semibold text-slate-500">
              Transport email
            </p>
            <h2 className="text-xl font-bold">Configuration SMTP</h2>
          </div>
        </div>

        <p className="mb-4 text-sm text-[#4B5563]">
          Si activé, ce serveur sera utilisé en priorité pour envoyer les rapports.
          Sinon QuickPOS utilise Resend (si configurée).
        </p>

        <p className="mb-2 text-xs uppercase tracking-wider font-semibold text-slate-500">
          Préréglages
        </p>
        <div className="flex flex-wrap gap-2 mb-6">
          {PRESETS.map((p) => (
            <button
              key={p.name}
              data-testid={`smtp-preset-${p.name}`}
              onClick={() => setForm({ ...form, host: p.host, port: p.port, use_tls: p.use_tls })}
              className="rounded-md border border-[#E5E7EB] bg-white px-3 py-1.5 text-xs font-semibold hover:bg-[#FAFAFA] active:scale-95"
            >
              {p.name}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block sm:col-span-2">
            <span className="text-xs uppercase tracking-wider font-semibold text-slate-500">
              Serveur (host)
            </span>
            <input
              data-testid="smtp-host"
              value={form.host}
              onChange={(e) => setForm({ ...form, host: e.target.value })}
              placeholder="smtp.example.com"
              className="mt-1 w-full rounded-md border border-[#E5E7EB] px-4 py-2.5 font-mono outline-none focus:border-[#002FA7]"
            />
          </label>
          <label className="block">
            <span className="text-xs uppercase tracking-wider font-semibold text-slate-500">
              Port
            </span>
            <input
              data-testid="smtp-port"
              type="number"
              value={form.port}
              onChange={(e) => setForm({ ...form, port: Number(e.target.value) || 587 })}
              className="mt-1 w-full rounded-md border border-[#E5E7EB] px-4 py-2.5 font-mono outline-none focus:border-[#002FA7]"
            />
          </label>
          <label className="flex items-center gap-2 mt-6">
            <input
              type="checkbox"
              data-testid="smtp-tls"
              checked={form.use_tls}
              onChange={(e) => setForm({ ...form, use_tls: e.target.checked })}
              className="h-4 w-4"
            />
            <span className="text-sm">Utiliser TLS / SSL</span>
          </label>
          <label className="block">
            <span className="text-xs uppercase tracking-wider font-semibold text-slate-500">
              Utilisateur
            </span>
            <input
              data-testid="smtp-username"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              placeholder="ex: user@gmail.com"
              className="mt-1 w-full rounded-md border border-[#E5E7EB] px-4 py-2.5 outline-none focus:border-[#002FA7]"
            />
          </label>
          <label className="block">
            <span className="text-xs uppercase tracking-wider font-semibold text-slate-500">
              Mot de passe
            </span>
            <input
              data-testid="smtp-password"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder={form.password === "********" ? "(non modifié)" : "Mot de passe ou app password"}
              className="mt-1 w-full rounded-md border border-[#E5E7EB] px-4 py-2.5 font-mono outline-none focus:border-[#002FA7]"
            />
          </label>
          <label className="block">
            <span className="text-xs uppercase tracking-wider font-semibold text-slate-500">
              Expéditeur (from)
            </span>
            <input
              data-testid="smtp-from-email"
              type="email"
              value={form.from_email}
              onChange={(e) => setForm({ ...form, from_email: e.target.value })}
              placeholder="ex: caisse@restaurant.fr"
              className="mt-1 w-full rounded-md border border-[#E5E7EB] px-4 py-2.5 outline-none focus:border-[#002FA7]"
            />
          </label>
          <label className="block">
            <span className="text-xs uppercase tracking-wider font-semibold text-slate-500">
              Nom expéditeur
            </span>
            <input
              data-testid="smtp-from-name"
              value={form.from_name}
              onChange={(e) => setForm({ ...form, from_name: e.target.value })}
              className="mt-1 w-full rounded-md border border-[#E5E7EB] px-4 py-2.5 outline-none focus:border-[#002FA7]"
            />
          </label>
          <label className="flex items-center gap-2 sm:col-span-2 rounded-md border-2 border-[#E5E7EB] bg-[#FAFAFA] px-4 py-3 mt-2">
            <input
              type="checkbox"
              data-testid="smtp-enabled"
              checked={form.enabled}
              onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
              className="h-5 w-5"
            />
            <span className="text-sm font-semibold">
              Activer SMTP pour l&apos;envoi des rapports
            </span>
          </label>
        </div>

        <button
          data-testid="save-smtp"
          onClick={submit}
          disabled={saving}
          className="mt-6 h-14 w-full rounded-md bg-[#002FA7] text-base font-bold uppercase tracking-wider text-white hover:bg-[#002277] active:scale-[0.98] disabled:opacity-50"
        >
          {saving ? "Enregistrement…" : "Enregistrer SMTP"}
        </button>

        <div className="mt-6 rounded-md border border-[#E5E7EB] bg-[#FAFAFA] p-4">
          <p className="text-xs uppercase tracking-wider font-semibold text-slate-500 mb-2">
            Tester la configuration
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              data-testid="smtp-test-to"
              type="email"
              value={testTo}
              onChange={(e) => setTestTo(e.target.value)}
              placeholder="adresse@example.com"
              className="flex-1 rounded-md border border-[#E5E7EB] bg-white px-4 py-2.5 outline-none focus:border-[#002FA7]"
            />
            <button
              data-testid="smtp-test-btn"
              onClick={runTest}
              disabled={testing}
              className="flex items-center justify-center gap-2 rounded-md bg-[#0A0A0A] px-5 py-2.5 text-sm font-bold uppercase tracking-wider text-white hover:bg-black active:scale-95 disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              {testing ? "Envoi…" : "Envoyer test"}
            </button>
          </div>
          {testResult && (
            <div
              className={`mt-3 flex items-start gap-2 rounded-md p-3 text-sm ${
                testResult.status === "sent"
                  ? "bg-emerald-50 text-emerald-900"
                  : "bg-red-50 text-red-900"
              }`}
              data-testid="smtp-test-result"
            >
              {testResult.status === "sent" ? (
                <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
              ) : (
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              )}
              <p>
                {testResult.status === "sent"
                  ? "Email envoyé avec succès."
                  : `Échec : ${testResult.error}`}
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
