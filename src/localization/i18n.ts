import i18n from "i18next";
import { initReactI18next } from "react-i18next";

i18n.use(initReactI18next).init({
  fallbackLng: "en",
  resources: {
    en: {
      translation: {
        appName: "Personare",
        cancelAction: "Cancel",
        confirmDeleteAction: "Delete",
        createProgramAction: "New program",
        createProgramTitle: "New program",
        deleteProgramAction: "Delete program",
        deleteProgramConfirmDescription:
          'This will delete "{{name}}". Its modules will stop appearing, but nothing is permanently removed.',
        deleteProgramConfirmTitle: "Delete this program?",
        documentation: "Documentation",
        editProgramAction: "Edit program",
        editProgramTitle: "Edit program",
        madeBy: "Made by Personare",
        modulesPlaceholder: "Modules for program {{programId}} coming soon",
        navCalendar: "Calendar",
        navPrograms: "Programs",
        programNameLabel: "Name",
        programsPageTitle: "Programs",
        programsTableEmptyMessage: "No programs found.",
        saveAction: "Save",
        titleHomePage: "Home Page",
        titleSecondPage: "Second Page",
        viewModulesAction: "View modules",
      },
    },
    "pt-BR": {
      translation: {
        appName: "Personare",
        cancelAction: "Cancelar",
        confirmDeleteAction: "Excluir",
        createProgramAction: "Novo programa",
        createProgramTitle: "Novo programa",
        deleteProgramAction: "Excluir programa",
        deleteProgramConfirmDescription:
          'Isso vai excluir "{{name}}". Seus módulos deixam de aparecer, mas nada é removido permanentemente.',
        deleteProgramConfirmTitle: "Excluir este programa?",
        documentation: "Documentação",
        editProgramAction: "Editar programa",
        editProgramTitle: "Editar programa",
        madeBy: "Feito por Personare",
        modulesPlaceholder: "Módulos do programa {{programId}} em breve",
        navCalendar: "Calendário",
        navPrograms: "Programas",
        programNameLabel: "Nome",
        programsPageTitle: "Programas",
        programsTableEmptyMessage: "Nenhum programa encontrado.",
        saveAction: "Salvar",
        titleHomePage: "Página Inicial",
        titleSecondPage: "Segunda Página",
        viewModulesAction: "Ver módulos",
      },
    },
  },
});
