import { router } from "expo-router";
import {
  endTutorialDemo,
  startBirthdayTutorial,
  type BirthdayTutorialIds,
} from "./api";
import type { Tutorial, TutorialContext, TutorialStep } from "./types";

export const birthdayTutorial: Tutorial = {
  id: "birthday",
  title: "Organisation d'un anniversaire",
  subtitle: "Découvre Planyzer en 1 minute via un événement de démo.",

  setup: async (): Promise<TutorialContext> => {
    const ids: BirthdayTutorialIds = await startBirthdayTutorial();
    return {
      eventId: ids.event_id,
      teamsToolId: ids.teams_tool_id,
      aperoTeamId: ids.apero_team_id,
      proposalsToolId: ids.proposals_tool_id,
      comptoirProposalId: ids.comptoir_proposal_id,
      moneyToolId: ids.money_tool_id,
      cakeExpenseId: ids.cake_expense_id,
      sophieUserId: ids.sophie_user_id,
    };
  },

  teardown: async (ctx) => {
    if (ctx.eventId) await endTutorialDemo(ctx.eventId);
  },

  buildSteps: (ctx): TutorialStep[] => {
    const e = ctx.eventId;
    return [
      // 1
      {
        title: "🎂 Bienvenue",
        body:
          "Tu vas organiser l'anniversaire de Léa. Quelques amis sont conviés, "
          + "il faut choisir le lieu, prévoir l'apéro et partager les frais. "
          + "Suis le guide.",
        durationMs: 7000,
        route: "/",
      },
      // 2 — highlight the create button
      {
        title: "Crée ton event",
        body:
          "Tout part d'ici. Le bouton + en bas à droite ouvre le formulaire "
          + "de création. On en crée un ensemble.",
        highlightID: "event-create-fab",
        route: "/",
        durationMs: 6000,
      },
      // 3 — open the creation form, spotlight the title field
      {
        title: "Remplis les infos",
        body:
          "Commence par le titre — le seul champ obligatoire. Tu peux aussi "
          + "ajouter une description, un lieu et des dates.",
        action: { kind: "open-new-event" },
        highlightID: "new-event-title",
        route: "/",
        durationMs: 8000,
      },
      // 4 — spotlight the submit button (modal stays open)
      {
        title: "Et tu valides",
        body:
          "Un clic sur « Créer » et ton event est prêt. C'est tout ce qu'il "
          + "faut pour démarrer.",
        action: { kind: "open-new-event" },
        highlightID: "new-event-submit",
        durationMs: 6000,
      },
      // 5 — back to home, the event now appears
      {
        title: "Et le voilà dans ta home",
        body:
          "Une fois validé, ton event apparaît ici. C'est le hub où tout "
          + "va se passer : participants, outils, dépenses.",
        highlightID: `event-card-${e}`,
        route: "/",
        durationMs: 6000,
      },
      // 6
      {
        title: "On entre dans l'event",
        body:
          "Voici tes participants : Léa, Marc et Sophie. Tu peux en ajouter à tout "
          + "moment depuis la pastille des avatars.",
        highlightID: "event-participants-stack",
        route: `/events/${e}`,
        durationMs: 6000,
      },
      // 7
      {
        title: "Le bouton 'ajouter un outil'",
        body:
          "Un event est vide par défaut. Pour ajouter Argent, Sondage, Planning… "
          + "tu cliques ici. J'en ai déjà placé trois pour toi.",
        highlightID: "event-add-tool-button",
        route: `/events/${e}`,
        durationMs: 6000,
      },
      // 8
      {
        title: "L'outil Équipes",
        body:
          "Idéal pour répartir les responsabilités : apéro, déco, vaisselle, "
          + "équipes de tournoi… On y va.",
        highlightID: `tool-card-${ctx.teamsToolId}`,
        route: `/events/${e}`,
        durationMs: 6000,
      },
      // 9
      {
        title: "Deux équipes pré-créées",
        body:
          "L'équipe Apéro (toi + Léa) et l'équipe Déco (Marc + Sophie). "
          + "Tape sur une équipe pour ouvrir son détail.",
        highlightID: `team-card-${ctx.aperoTeamId}`,
        route: `/events/${e}/tools/${ctx.teamsToolId}`,
        durationMs: 6000,
      },
      // 10 — open Apéro edit modal
      {
        title: "Voici l'équipe Apéro",
        body:
          "Une équipe a un nom, une couleur et des membres. C'est ce que tu "
          + "vois ici, modifiable en un clic.",
        action: { kind: "open-edit-team", teamId: ctx.aperoTeamId },
        durationMs: 7000,
      },
      // 11 — modal stays open
      {
        title: "Limite et responsable",
        body:
          "Tu peux limiter le nombre de membres (utile pour un tournoi) et "
          + "désigner un responsable. Une fois fait, les membres peuvent "
          + "rejoindre eux-mêmes depuis la carte.",
        action: { kind: "open-edit-team", teamId: ctx.aperoTeamId },
        durationMs: 8000,
      },
      // 12 — Sondage
      {
        title: "L'outil Sondage",
        body:
          "Plusieurs idées de lieu ? Lance un sondage. J'ai proposé trois "
          + "bars : Le Comptoir, Chez Marc, et La Terrasse. Chacun vote.",
        highlightID: `proposal-card-${ctx.comptoirProposalId}`,
        route: `/events/${e}/tools/${ctx.proposalsToolId}`,
        durationMs: 7000,
      },
      // 13 — Money expenses
      {
        title: "L'outil Argent",
        body:
          "Les dépenses du groupe se notent ici. J'en ai ajouté deux : "
          + "le gâteau et les bouteilles.",
        highlightID: `expense-card-${ctx.cakeExpenseId}`,
        route: `/events/${e}/tools/${ctx.moneyToolId}`,
        action: { kind: "set-money-tab", tab: "expenses" },
        durationMs: 6000,
      },
      // 14 — open Cake expense modal
      {
        title: "Détail d'une dépense",
        body:
          "Qui a payé, combien, et comment on partage : équitablement, en parts "
          + "ou en montants fixes. Tu choisis.",
        action: { kind: "open-edit-expense", expenseId: ctx.cakeExpenseId },
        durationMs: 8000,
      },
      // 15 — switch to breakdown tab
      {
        title: "La répartition",
        body:
          "L'onglet Répartition résume les soldes de chacun et propose les "
          + "remboursements à effectuer pour clore l'event.",
        action: { kind: "set-money-tab", tab: "breakdown" },
        durationMs: 7000,
      },
      // 16 — RIB button highlight
      {
        title: "Le RIB du créancier en un clic",
        body:
          "Pour faire le virement à Sophie, clique sur 'Voir RIB' : tu auras "
          + "son IBAN ou son téléphone (Wero, Lyf…) sans courir après sur "
          + "WhatsApp.",
        highlightID: `rib-button-${ctx.sophieUserId}`,
        durationMs: 8000,
      },
      // 17
      {
        title: "À toi de jouer 🎉",
        body:
          "Voilà ! Tu peux relancer ce tuto depuis ton profil. D'autres "
          + "scénarios arrivent (mariage, weekend ski…). Bons events !",
        durationMs: 7000,
      },
    ];
  },
};

export function navigateToStepRoute(step: TutorialStep): void {
  if (step.route) {
    try {
      router.push(step.route as never);
    } catch {
      // ignore navigation errors during teardown
    }
  }
}
