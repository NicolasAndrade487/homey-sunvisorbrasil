// Login via Google foi desativado neste portal por política de acesso.
// O acesso permitido é apenas via e-mail corporativo + confirmação + aprovação manual.

import type { OAuthProvider } from "@lovable.dev/cloud-auth-js";

type SignInOptions = {
  redirect_uri?: string;
  extraParams?: Record<string, string>;
};

export const lovable = {
  auth: {
    signInWithOAuth: async (_provider: OAuthProvider, _opts?: SignInOptions) => {
      return {
        redirected: false,
        error: new Error("Login com Google desativado. Use seu e-mail corporativo da SVB."),
      };
    },
  },
};
