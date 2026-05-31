export type AdminProfile = {
  id: string;
  email: string;
  role: string;
  prenom: string;
  nom: string;
  telephone: string;
  ville: string;
};

export type UpdateAdminProfilePayload = {
  prenom: string;
  nom: string;
  telephone: string;
  ville: string;
};

export type ChangePasswordPayload = {
  currentPassword: string;
  newPassword: string;
};

export type TeamUserRole = "admin" | "admin_whatsapp";

/** Rôles assignables à la création depuis Paramètres. */
export type AssignableTeamUserRole = "admin_whatsapp" | "admin";

export type TeamUser = {
  id: string;
  prenom: string;
  nom: string;
  email: string;
  telephone: string;
  ville: string;
  role: TeamUserRole;
  createdAt: string;
};

export type CreateTeamUserPayload = {
  prenom: string;
  nom: string;
  email: string;
  telephone: string;
  ville: string;
  password: string;
  role: AssignableTeamUserRole;
};
