import * as React from "react";
import { cn } from "../../lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import ModuleCard from "./ModuleCard";
import PatientSearch from "./PatientSearch";
import SpecialtyCard from "./SpecialtyCard";

const DEFAULT_PATIENTS = [
  {
    id: "1",
    full_name: "Fernanda da Costa Silva",
    cpf: "059.486.571-91",
    team_ref: "Ametista",
    status: "ativo",
    ubs_ref: "UBS Central",
  },
  {
    id: "2",
    full_name: "Carlos Henrique Martins",
    cpf: "132.882.010-44",
    team_ref: "Safira",
    status: "ativo",
    ubs_ref: "UBS 02",
  },
];

const DEFAULT_MODULES = [
  { key: "users", label: "Usuarios", description: "Dados cadastrais e situacao assistencial", count: 1, status: "ativo" },
  { key: "careplans", label: "Plano de Cuidado", description: "Metas, dificuldades e recomendacoes", count: 0, status: "pendente" },
  { key: "encounters", label: "Atendimentos", description: "Historico multiprofissional", count: 2, status: "ok" },
  { key: "transitions", label: "Transicao do Cuidado", description: "Fluxo CADH, UBS e especialidades", count: 1, status: "ok" },
];

const DEFAULT_SPECIALTIES = [
  { key: "tecnico", label: "Tecnico de Enfermagem", description: "Triagem e sinais vitais" },
  { key: "enfermagem", label: "Enfermagem", description: "Acompanhamento clinico" },
  { key: "endocrinologia", label: "Endocrinologia", description: "Diabetes e metabolismo" },
  { key: "cardiologia", label: "Cardiologia", description: "Hipertensao e risco cardiovascular" },
  { key: "nutricao", label: "Nutricao", description: "Plano alimentar" },
  { key: "psicologia", label: "Psicologia", description: "Saude mental" },
  { key: "fisioterapia", label: "Fisioterapia", description: "Funcionalidade e exercicios" },
  { key: "farmacia", label: "Farmacia Clinica", description: "Uso seguro de medicamentos" },
  { key: "social", label: "Servico Social", description: "Rede de apoio" },
  { key: "oftalmologia", label: "Oftalmologia", description: "Rastreamento ocular" },
];

function DetailPanel({ patient, activeModule, activeSpecialty }) {
  if (!patient) {
    return (
      <div className="grid min-h-[180px] place-items-center rounded-lg border border-dashed bg-slate-50 p-6 text-center">
        <div>
          <strong className="block text-sm text-slate-900">Nenhum usuario selecionado</strong>
          <p className="mt-1 text-sm text-slate-500">A busca libera os modulos, especialidades e a area de resumo.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-4 rounded-lg border bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-teal-700">Contexto conectado</p>
          <h3 className="mt-1 text-lg font-black text-slate-900">{patient.full_name}</h3>
          <p className="text-sm text-slate-500">CPF {patient.cpf || "-"} | Equipe {patient.team_ref || "Sem equipe"}</p>
        </div>
        <Badge variant="outline">{activeModule?.label || "Usuarios"}</Badge>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg bg-blue-50 p-3">
          <span className="text-xs font-bold text-blue-700">Modulo ativo</span>
          <strong className="block text-sm text-slate-900">{activeModule?.label || "Usuarios"}</strong>
        </div>
        <div className="rounded-lg bg-teal-50 p-3">
          <span className="text-xs font-bold text-teal-700">Especialidade</span>
          <strong className="block text-sm text-slate-900">{activeSpecialty?.label || "Selecione uma especialidade"}</strong>
        </div>
        <div className="rounded-lg bg-emerald-50 p-3">
          <span className="text-xs font-bold text-emerald-700">Status</span>
          <strong className="block text-sm text-slate-900">{patient.status || "ativo"}</strong>
        </div>
      </div>
    </div>
  );
}

export default function CarePanel({
  patients = DEFAULT_PATIENTS,
  modules = DEFAULT_MODULES,
  specialties = DEFAULT_SPECIALTIES,
  initialPatientId,
  onPatientChange,
  onModuleChange,
  onSpecialtyChange,
  className,
}) {
  const initialPatient = patients.find((patient) => String(patient.id) === String(initialPatientId)) || null;
  const [selectedPatient, setSelectedPatient] = React.useState(initialPatient);
  const [activeModuleKey, setActiveModuleKey] = React.useState(modules[0]?.key || "users");
  const [activeSpecialtyKey, setActiveSpecialtyKey] = React.useState("");

  const activeModule = modules.find((module) => module.key === activeModuleKey) || modules[0];
  const activeSpecialty = specialties.find((specialty) => specialty.key === activeSpecialtyKey) || null;
  const unlocked = Boolean(selectedPatient);

  const selectPatient = (patient) => {
    setSelectedPatient(patient);
    onPatientChange?.(patient);
  };

  const clearPatient = () => {
    setSelectedPatient(null);
    setActiveModuleKey(modules[0]?.key || "users");
    setActiveSpecialtyKey("");
    onPatientChange?.(null);
  };

  const selectModule = (module) => {
    if (!unlocked && module.key !== "users") return;
    setActiveModuleKey(module.key);
    onModuleChange?.(module, selectedPatient);
  };

  const selectSpecialty = (specialty) => {
    if (!unlocked) return;
    setActiveSpecialtyKey(specialty.key);
    onSpecialtyChange?.(specialty, selectedPatient);
  };

  return (
    <section className={cn("grid gap-5", className)}>
      <Card className="overflow-hidden border-slate-200 bg-white/95 shadow-sm">
        <CardHeader className="border-b bg-[#0d5592] text-white">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-200">CADH</p>
              <CardTitle className="mt-1 text-2xl font-black">Gestao do Cuidado</CardTitle>
            </div>
            <Badge variant="outline" className="border-white/30 bg-white/10 text-white">
              {unlocked ? "Paciente selecionado" : "Aguardando busca"}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="grid gap-5 p-5 lg:grid-cols-[340px_1fr]">
          <PatientSearch
            patients={patients}
            selectedPatient={selectedPatient}
            onSelect={selectPatient}
            onClear={clearPatient}
          />

          <div className="grid gap-5">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {modules.map((module) => (
                <ModuleCard
                  key={module.key}
                  moduleKey={module.key}
                  label={module.label}
                  description={module.description}
                  count={module.count}
                  status={module.status}
                  active={activeModuleKey === module.key}
                  disabled={!unlocked && module.key !== "users"}
                  onClick={() => selectModule(module)}
                />
              ))}
            </div>

            <DetailPanel patient={selectedPatient} activeModule={activeModule} activeSpecialty={activeSpecialty} />
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200 bg-white/95 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-black text-slate-900">Especialidades CADH</CardTitle>
              <p className="mt-1 text-sm text-slate-500">As especialidades usam o paciente selecionado no painel acima.</p>
            </div>
            <Badge variant={unlocked ? "success" : "secondary"}>{unlocked ? "Liberadas" : "Bloqueadas"}</Badge>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {specialties.map((specialty) => (
            <SpecialtyCard
              key={specialty.key}
              specialtyKey={specialty.key}
              label={specialty.label}
              description={specialty.description}
              locked={!unlocked}
              selected={activeSpecialtyKey === specialty.key}
              onClick={() => selectSpecialty(specialty)}
            />
          ))}
        </CardContent>
      </Card>
    </section>
  );
}
