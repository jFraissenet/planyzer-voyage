export interface OAuthProvider {
  /** Nom affiché sur le bouton */
  label: string;
  /** Lance le flux OAuth et retourne le résultat */
  signIn: () => Promise<void>;
}
