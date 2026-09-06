import i18n from "i18next";
import { initReactI18next } from "react-i18next";

i18n.use(initReactI18next).init({
  fallbackLng: "en",
  resources: {
    en: {
      translation: {
        appName: "Personare",
        documentation: "Documentation",
        madeBy: "Made by Personare",
        navCalendar: "Calendar",
        navPrograms: "Programs",
        titleHomePage: "Home Page",
        titleSecondPage: "Second Page",
      },
    },
    "pt-BR": {
      translation: {
        appName: "Personare",
        documentation: "Documentação",
        madeBy: "Feito por Personare",
        navCalendar: "Calendário",
        navPrograms: "Programas",
        titleHomePage: "Página Inicial",
        titleSecondPage: "Segunda Página",
      },
    },
  },
});
