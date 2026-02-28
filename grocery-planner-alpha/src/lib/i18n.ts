type Locale = "fr" | "en";

const fr = {
  // ── Metadata & Layout ──
  meta: {
    title: "Foodmi",
    description: "Planification d'épicerie assistée par IA pour le Québec",
  },

  // ── Navigation ──
  nav: {
    appName: "Foodmi",
    profile: "Profil",
    signOut: "Déconnexion",
    avatarAlt: "Profil",
  },

  // ── Login Page ──
  login: {
    title: "Foodmi",
    description: "Connectez-vous à votre compte",
    email: "Courriel",
    password: "Mot de passe",
    signIn: "Se connecter",
    signingIn: "Connexion en cours...",
    error: "Courriel ou mot de passe invalide",
  },

  // ── Home Page ──
  home: {
    heading: "Foodmi",
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
    languageTitle: "Langue",
    languageDescription: "Choisissez la langue de l'application",
    langFr: "Français",
    langFrDesc: "Interface en français (Canada)",
    langEn: "English",
    langEnDesc: "Interface in English (Canada)",
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

const en = {
  meta: {
    title: "Foodmi",
    description: "AI-powered grocery planning for Quebec",
  },
  nav: {
    appName: "Foodmi",
    profile: "Profile",
    signOut: "Sign Out",
    avatarAlt: "Profile",
  },
  login: {
    title: "Foodmi",
    description: "Sign in to your account",
    email: "Email",
    password: "Password",
    signIn: "Sign In",
    signingIn: "Signing in...",
    error: "Invalid email or password",
  },
  home: {
    heading: "Foodmi",
    welcome: "Welcome,",
  },
  profilePage: {
    heading: "Your Profile",
  },
  tabs: {
    account: "Account",
    preferences: "Preferences",
    notifications: "Notifications",
  },
  account: {
    title: "Account Information",
    changePhoto: "Change Photo",
    remove: "Remove",
    firstName: "First Name",
    firstNamePlaceholder: "First name",
    lastName: "Last Name",
    lastNamePlaceholder: "Last name",
    email: "Email",
    password: "Password",
    changePassword: "Change Password",
    currentPassword: "Current Password",
    newPassword: "New Password",
    newPasswordPlaceholder: "Minimum 8 characters",
    confirmPassword: "Confirm New Password",
    changingPassword: "Changing...",
    updatePassword: "Update Password",
    address: "Address",
    streetAddress: "Street Address",
    streetAddressPlaceholder: "Start typing your address...",
    city: "City",
    cityPlaceholder: "City",
    province: "Province",
    postalCode: "Postal Code",
    postalCodePlaceholder: "H2X 1Y4",
    saving: "Saving...",
    saveChanges: "Save Changes",
    photoUpdated: "Photo updated",
    photoRemoved: "Photo removed",
    failedUploadPhoto: "Failed to upload photo",
    failedRemovePhoto: "Failed to remove photo",
    selectImageFile: "Please select an image file",
    accountUpdated: "Account updated",
    failedSave: "Failed to save",
    passwordChanged: "Password changed",
    failedChangePassword: "Failed to change password",
    passwordsDontMatch: "Passwords don't match",
    passwordMinLength: "Password must be at least 8 characters",
  },
  provinces: {
    AB: "Alberta",
    BC: "British Columbia",
    MB: "Manitoba",
    NB: "New Brunswick",
    NL: "Newfoundland and Labrador",
    NS: "Nova Scotia",
    NT: "Northwest Territories",
    NU: "Nunavut",
    ON: "Ontario",
    PE: "Prince Edward Island",
    QC: "Quebec",
    SK: "Saskatchewan",
    YT: "Yukon",
  },
  preferences: {
    languageTitle: "Language",
    languageDescription: "Choose the application language",
    langFr: "Français",
    langFrDesc: "Interface en français (Canada)",
    langEn: "English",
    langEnDesc: "Interface in English (Canada)",
    cookingTitle: "Cooking Preferences",
    householdSize: "Household Size",
    mealsPerDay: "Meals Per Day",
    cookingTime: "Cooking Time Preference",
    cookingQuick: "Quick (under 30 min)",
    cookingModerate: "Moderate (30-60 min)",
    cookingElaborate: "Elaborate (60+ min)",
    budgetTitle: "Budget Preference",
    budgetDescription: "How should the AI prioritize your grocery planning?",
    budgetEconomic: "Economic",
    budgetEconomicDesc: "Focused on savings",
    budgetModerate: "Moderate",
    budgetModerateDesc: "Balance of time and savings",
    budgetDontCare: "Don't care",
    budgetDontCareDesc: "Focused only on time",
    agentTitle: "Grocery Agent",
    agentDescription: "Configure how and when the AI assistant helps you",
    shoppingDay: "Shopping Day",
    selectDay: "Select a day",
    howOften: "How Often",
    weekly: "Weekly",
    biweekly: "Every 2 Weeks",
    monthly: "Monthly",
    agentBehavior: "Agent Behavior",
    agentAuto: "Plan before grocery",
    agentAutoDesc: "Agent proactively creates your grocery list before your shopping day",
    agentWait: "Wait for me to chat",
    agentWaitDesc: "Agent only acts when you start a conversation",
    agentAsk: "Ask questions first",
    agentAskDesc: "Agent asks your preferences before creating a plan",
    saving: "Saving...",
    savePreferences: "Save Preferences",
    preferencesUpdated: "Preferences updated",
    failedSave: "Failed to save",
    householdSizeError: "Household size must be between 1 and 20",
    mealsPerDayError: "Meals per day must be between 1 and 10",
  },
  days: {
    none: "No preference",
    monday: "Monday",
    tuesday: "Tuesday",
    wednesday: "Wednesday",
    thursday: "Thursday",
    friday: "Friday",
    saturday: "Saturday",
    sunday: "Sunday",
  },
  notifications: {
    title: "Notification Preferences",
    description: "Choose how you want to be notified about grocery plans and reminders",
    email: "Email Notifications",
    emailDesc: "Receive grocery lists and reminders via email",
    sms: "SMS Notifications",
    smsDesc: "Get text messages with shopping reminders",
    push: "Push Notifications",
    pushDesc: "Receive browser push notifications for updates",
    saved: "Notification preference saved",
    failedSave: "Failed to update notification preference",
  },
  api: {
    unauthorized: "Unauthorized",
    userNotFound: "User not found",
    invalidCookingPref: "Invalid cooking time preference",
    householdSizeRange: "Household size must be between 1 and 20",
    mealsPerDayRange: "Meals per day must be between 1 and 10",
    invalidBudgetPref: "Invalid budget preference",
    invalidGroceryDay: "Invalid grocery day",
    invalidGroceryFreq: "Invalid grocery frequency",
    invalidAgentMode: "Invalid agent mode",
    booleanRequired: "must be a boolean",
    avatarRequired: "Avatar is required",
    invalidImageFormat: "Invalid image format",
    imageTooLarge: "Image too large (max 500KB)",
    passwordsRequired: "Current password and new password are required",
    passwordMinLength: "New password must be at least 8 characters",
    passwordIncorrect: "Current password is incorrect",
    passwordUpdated: "Password updated successfully",
    addressNotConfigured: "Address autocomplete not configured",
    addressFetchFailed: "Failed to fetch address suggestions",
  },
};

// Recursive type that converts literal string types to `string`
type DeepStrings<T> = {
  [K in keyof T]: T[K] extends string ? string : DeepStrings<T[K]>;
};

type Dictionary = DeepStrings<typeof fr>;

const dictionaries: Record<Locale, Dictionary> = { fr, en };

// ── Locale helpers ──

export function getLocale(): Locale {
  if (typeof document !== "undefined") {
    const match = document.cookie.match(/(?:^|; )locale=(fr|en)/);
    if (match) return match[1] as Locale;
  }
  return "fr"; // default
}

export function setLocale(locale: Locale): void {
  document.cookie = `locale=${locale}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
  window.location.reload();
}

// ── Type-safe dot-notation key lookup ──

type NestedKeys<T, Prefix extends string = ""> = T extends Record<string, unknown>
  ? {
      [K in keyof T & string]: T[K] extends Record<string, unknown>
        ? NestedKeys<T[K], `${Prefix}${K}.`>
        : `${Prefix}${K}`;
    }[keyof T & string]
  : never;

type TranslationKey = NestedKeys<typeof fr>;

export function t(key: TranslationKey): string {
  const locale = getLocale();
  const dict = dictionaries[locale];
  const parts = key.split(".");
  let result: unknown = dict;
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
