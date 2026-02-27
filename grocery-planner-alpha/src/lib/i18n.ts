const fr = {
  // ── Metadata & Layout ──
  meta: {
    title: "Planificateur d'Épicerie",
    description: "Planification d'épicerie assistée par IA pour le Québec",
  },

  // ── Navigation ──
  nav: {
    appName: "Planificateur d'Épicerie",
    profile: "Profil",
    signOut: "Déconnexion",
    avatarAlt: "Profil",
  },

  // ── Login Page ──
  login: {
    title: "Planificateur d'Épicerie",
    description: "Connectez-vous à votre compte",
    email: "Courriel",
    password: "Mot de passe",
    signIn: "Se connecter",
    signingIn: "Connexion en cours...",
    error: "Courriel ou mot de passe invalide",
  },

  // ── Home Page ──
  home: {
    heading: "Planificateur d'Épicerie",
    welcome: "Bienvenue,",
  },

  // ── Profile Page ──
  profilePage: {
    heading: "Votre profil",
  },

  // ── Profile Tabs ──
  tabs: {
    account: "Compte",
    preferences: "Préférences",
    notifications: "Notifications",
  },

  // ── Account Tab ──
  account: {
    title: "Informations du compte",
    changePhoto: "Changer la photo",
    remove: "Supprimer",
    firstName: "Prénom",
    firstNamePlaceholder: "Prénom",
    lastName: "Nom",
    lastNamePlaceholder: "Nom",
    email: "Courriel",
    password: "Mot de passe",
    changePassword: "Changer le mot de passe",
    currentPassword: "Mot de passe actuel",
    newPassword: "Nouveau mot de passe",
    newPasswordPlaceholder: "Minimum 8 caractères",
    confirmPassword: "Confirmer le nouveau mot de passe",
    changingPassword: "Modification...",
    updatePassword: "Modifier le mot de passe",
    address: "Adresse",
    streetAddress: "Adresse civique",
    streetAddressPlaceholder: "Commencez à taper votre adresse...",
    city: "Ville",
    cityPlaceholder: "Ville",
    province: "Province",
    postalCode: "Code postal",
    postalCodePlaceholder: "H2X 1Y4",
    saving: "Enregistrement...",
    saveChanges: "Enregistrer les modifications",
    // Toasts
    photoUpdated: "Photo mise à jour",
    photoRemoved: "Photo supprimée",
    failedUploadPhoto: "Échec du téléchargement de la photo",
    failedRemovePhoto: "Échec de la suppression de la photo",
    selectImageFile: "Veuillez sélectionner un fichier image",
    accountUpdated: "Compte mis à jour",
    failedSave: "Échec de l'enregistrement",
    passwordChanged: "Mot de passe modifié",
    failedChangePassword: "Échec de la modification du mot de passe",
    passwordsDontMatch: "Les mots de passe ne correspondent pas",
    passwordMinLength: "Le mot de passe doit contenir au moins 8 caractères",
  },

  // ── Provinces ──
  provinces: {
    AB: "Alberta",
    BC: "Colombie-Britannique",
    MB: "Manitoba",
    NB: "Nouveau-Brunswick",
    NL: "Terre-Neuve-et-Labrador",
    NS: "Nouvelle-Écosse",
    NT: "Territoires du Nord-Ouest",
    NU: "Nunavut",
    ON: "Ontario",
    PE: "Île-du-Prince-Édouard",
    QC: "Québec",
    SK: "Saskatchewan",
    YT: "Yukon",
  },

  // ── Preferences Tab ──
  preferences: {
    cookingTitle: "Préférences de cuisson",
    householdSize: "Taille du foyer",
    mealsPerDay: "Repas par jour",
    cookingTime: "Temps de cuisson préféré",
    cookingQuick: "Rapide (moins de 30 min)",
    cookingModerate: "Modéré (30-60 min)",
    cookingElaborate: "Élaboré (60+ min)",
    budgetTitle: "Préférence budgétaire",
    budgetDescription: "Comment l'IA devrait-elle prioriser votre planification?",
    budgetEconomic: "Économique",
    budgetEconomicDesc: "Axé sur les économies",
    budgetModerate: "Modéré",
    budgetModerateDesc: "Équilibre entre temps et économies",
    budgetDontCare: "Peu importe",
    budgetDontCareDesc: "Axé uniquement sur le temps",
    agentTitle: "Agent d'épicerie",
    agentDescription: "Configurez comment et quand l'assistant IA vous aide",
    shoppingDay: "Jour d'épicerie",
    selectDay: "Choisir un jour",
    howOften: "Fréquence",
    weekly: "Hebdomadaire",
    biweekly: "Aux 2 semaines",
    monthly: "Mensuel",
    agentBehavior: "Comportement de l'agent",
    agentAuto: "Planifier avant l'épicerie",
    agentAutoDesc: "L'agent crée proactivement votre liste avant votre jour d'épicerie",
    agentWait: "Attendre que je parle",
    agentWaitDesc: "L'agent agit seulement quand vous démarrez une conversation",
    agentAsk: "Poser des questions d'abord",
    agentAskDesc: "L'agent demande vos préférences avant de créer un plan",
    saving: "Enregistrement...",
    savePreferences: "Enregistrer les préférences",
    preferencesUpdated: "Préférences mises à jour",
    failedSave: "Échec de l'enregistrement",
    householdSizeError: "La taille du foyer doit être entre 1 et 20",
    mealsPerDayError: "Le nombre de repas doit être entre 1 et 10",
  },

  // ── Days ──
  days: {
    none: "Aucune préférence",
    monday: "Lundi",
    tuesday: "Mardi",
    wednesday: "Mercredi",
    thursday: "Jeudi",
    friday: "Vendredi",
    saturday: "Samedi",
    sunday: "Dimanche",
  },

  // ── Notifications Tab ──
  notifications: {
    title: "Préférences de notification",
    description: "Choisissez comment recevoir les notifications pour vos plans et rappels d'épicerie",
    email: "Notifications par courriel",
    emailDesc: "Recevez vos listes d'épicerie et rappels par courriel",
    sms: "Notifications par SMS",
    smsDesc: "Recevez des messages texte avec vos rappels d'épicerie",
    push: "Notifications push",
    pushDesc: "Recevez des notifications push dans votre navigateur",
    saved: "Préférence de notification enregistrée",
    failedSave: "Échec de la mise à jour de la préférence",
  },

  // ── API Error Messages ──
  api: {
    unauthorized: "Non autorisé",
    userNotFound: "Utilisateur introuvable",
    invalidCookingPref: "Préférence de cuisson invalide",
    householdSizeRange: "La taille du foyer doit être entre 1 et 20",
    mealsPerDayRange: "Le nombre de repas doit être entre 1 et 10",
    invalidBudgetPref: "Préférence budgétaire invalide",
    invalidGroceryDay: "Jour d'épicerie invalide",
    invalidGroceryFreq: "Fréquence d'épicerie invalide",
    invalidAgentMode: "Mode de l'agent invalide",
    booleanRequired: "doit être un booléen",
    avatarRequired: "L'avatar est requis",
    invalidImageFormat: "Format d'image invalide",
    imageTooLarge: "Image trop grande (max 500 Ko)",
    passwordsRequired: "Le mot de passe actuel et le nouveau sont requis",
    passwordMinLength: "Le nouveau mot de passe doit contenir au moins 8 caractères",
    passwordIncorrect: "Le mot de passe actuel est incorrect",
    passwordUpdated: "Mot de passe mis à jour avec succès",
    addressNotConfigured: "L'autocomplétion d'adresse n'est pas configurée",
    addressFetchFailed: "Échec de la recherche de suggestions d'adresse",
  },
} as const;

// Type-safe dot-notation key lookup
type NestedKeys<T, Prefix extends string = ""> = T extends Record<string, unknown>
  ? {
      [K in keyof T & string]: T[K] extends Record<string, unknown>
        ? NestedKeys<T[K], `${Prefix}${K}.`>
        : `${Prefix}${K}`;
    }[keyof T & string]
  : never;

type TranslationKey = NestedKeys<typeof fr>;

export function t(key: TranslationKey): string {
  const parts = key.split(".");
  let result: unknown = fr;
  for (const part of parts) {
    if (result && typeof result === "object" && part in result) {
      result = (result as Record<string, unknown>)[part];
    } else {
      console.warn(`[i18n] Missing translation: ${key}`);
      return key;
    }
  }
  return result as string;
}
