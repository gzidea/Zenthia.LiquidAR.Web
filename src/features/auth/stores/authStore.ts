import { create } from 'zustand';
import {
  saveSessionContext,
  clearSessionContext,
} from '../services/sessionContext';
import {
  clearSessionTokens,
  storeSessionTokens,
  type SessionTokens,
} from '../services/sessionTokens';
import type { AnonymousReason, AuthSession, LoginSession } from '../types/auth';
import type { SessionTiming } from '../services/sessionClock';

interface AuthState {
  session: AuthSession;
  revision: number;
  initialize: () => void;
  accept: (
    user: LoginSession,
    tokens?: SessionTokens,
    timing?: SessionTiming,
  ) => void;
  renew: (
    user: LoginSession,
    tokens: SessionTokens,
    timing?: SessionTiming,
  ) => void;
  passwordChanged: () => void;
  clear: (reason: AnonymousReason) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  session: { status: 'initializing' },
  revision: 0,
  // Called after restoration has completed or when there is no saved UI context.
  initialize: () =>
    set((state) =>
      state.session.status === 'initializing'
        ? { session: { status: 'anonymous', reason: 'initial' } }
        : state,
    ),
  accept: (user, tokens, timing) => {
    storeSessionTokens(tokens, timing);
    saveSessionContext(user);
    return set((state) => ({
      revision: state.revision + 1,
      session: {
        status: user.requiresPasswordChange
          ? 'password-required'
          : 'authenticated',
        user,
      },
    }));
  },
  // Same identity: preserve the mounted routes, query client and form drafts.
  renew: (user, tokens, timing) => {
    storeSessionTokens(tokens, timing);
    saveSessionContext(user);
    set({
      session: {
        status: user.requiresPasswordChange
          ? 'password-required'
          : 'authenticated',
        user,
      },
    });
  },
  passwordChanged: () =>
    set((state) => {
      if (!('user' in state.session)) return state;
      saveSessionContext({
        ...state.session.user,
        requiresPasswordChange: false,
      });
      return {
        revision: state.revision + 1,
        session: {
          status: 'authenticated',
          user: { ...state.session.user, requiresPasswordChange: false },
        },
      };
    }),
  clear: (reason) => {
    clearSessionTokens();
    clearSessionContext();
    return set((state) => ({
      revision: state.revision + 1,
      session: { status: 'anonymous', reason },
    }));
  },
}));
