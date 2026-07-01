import * as React from "react";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function onlyDigits(value) {
  return String(value || "").replace(/\D+/g, "");
}

function matchesPatient(patient, query) {
  const text = normalize(query);
  const digits = onlyDigits(query);
  if (!text && !digits) return true;

  return (
    normalize(patient.full_name).includes(text) ||
    normalize(patient.team_ref).includes(text) ||
    onlyDigits(patient.cpf).includes(digits)
  );
}

export default function PatientSearch({
  patients = [],
  selectedPatient,
  onSelect,
  onClear,
  placeholder = "Buscar por nome ou CPF",
  className,
}) {
  const [query, setQuery] = React.useState("");
  const filteredPatients = React.useMemo(
    () => patients.filter((patient) => matchesPatient(patient, query)).slice(0, 8),
    [patients, query],
  );

  React.useEffect(() => {
    if (selectedPatient?.full_name) {
      setQuery(selectedPatient.full_name);
    }
  }, [selectedPatient?.full_name]);

  return (
    <section className={cn("grid gap-3 rounded-lg border bg-white p-4 shadow-sm", className)}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-black text-slate-900">Buscar usuario</h2>
          <p className="text-xs text-slate-500">Selecione um usuario para liberar os modulos CADH.</p>
        </div>
        {selectedPatient ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setQuery("");
              onClear?.();
            }}
          >
            Limpar
          </Button>
        ) : null}
      </div>

      <Input
        value={query}
        placeholder={placeholder}
        autoComplete="off"
        aria-label="Buscar usuario por nome ou CPF"
        onChange={(event) => setQuery(event.target.value)}
      />

      {selectedPatient ? (
        <article className="rounded-lg border border-teal-200 bg-teal-50 p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <strong className="block text-sm text-slate-900">{selectedPatient.full_name}</strong>
              <span className="text-xs text-slate-600">CPF: {selectedPatient.cpf || "-"}</span>
            </div>
            <Badge variant="success">{selectedPatient.status || "ativo"}</Badge>
          </div>
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-600">
            <span>Equipe: {selectedPatient.team_ref || "Sem equipe"}</span>
            {selectedPatient.ubs_ref ? <span>UBS: {selectedPatient.ubs_ref}</span> : null}
          </div>
        </article>
      ) : (
        <div className="grid gap-2">
          {query && filteredPatients.length === 0 ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">Nenhum usuario encontrado.</p>
          ) : null}

          {(query ? filteredPatients : patients.slice(0, 4)).map((patient) => (
            <button
              key={patient.id || patient.cpf}
              type="button"
              onClick={() => onSelect?.(patient)}
              className="rounded-lg border px-3 py-2 text-left transition-colors hover:border-teal-300 hover:bg-teal-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
            >
              <strong className="block text-sm text-slate-900">{patient.full_name}</strong>
              <span className="text-xs text-slate-500">CPF: {patient.cpf || "-"} | Equipe: {patient.team_ref || "Sem equipe"}</span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
