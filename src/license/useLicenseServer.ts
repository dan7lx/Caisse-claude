import { useCallback, useEffect, useState } from 'react';
import { AppState as RNAppState } from 'react-native';

import { LICENSE_SERVER } from '../config';
import { setLicense } from '../store/actions';
import { useStore } from '../store/StoreProvider';
import { applyRedeem, type BillingInfo, FALLBACK_BILLING, licenseApi, syncFromServer } from './server';

/** Coordonnées de paiement et prix à jour (serveur), avec repli sur les valeurs intégrées. */
export function useBilling(): BillingInfo {
  const [billing, setBilling] = useState<BillingInfo>(FALLBACK_BILLING);
  useEffect(() => {
    if (!LICENSE_SERVER) return;
    let alive = true;
    licenseApi
      .billing(LICENSE_SERVER)
      .then((b) => {
        if (alive && b) setBilling(b);
      })
      .catch(() => {
        // hors ligne : on garde les valeurs intégrées
      });
    return () => {
      alive = false;
    };
  }, []);
  return billing;
}

/** Active une clé sur le serveur et met la licence à jour. Retourne un message d'erreur ou null. */
export function useRedeemKey() {
  const { state, dispatch, updateDevice } = useStore();
  return useCallback(
    async (key: string): Promise<{ error: string } | { plan: 'mensuel' | 'vie'; validUntil: number | null }> => {
      if (!LICENSE_SERVER) return { error: 'Serveur de licences non configuré. Contactez le support.' };
      try {
        const r = await licenseApi.redeem(LICENSE_SERVER, state.license.id, key);
        dispatch(setLicense(applyRedeem(state.license, r)));
        updateDevice({ pendingPayment: null });
        return { plan: r.plan, validUntil: r.valid_until };
      } catch (e) {
        return { error: e instanceof Error ? e.message : 'Activation impossible.' };
      }
    },
    [state.license, dispatch, updateDevice],
  );
}

const CHECK_EVERY_MS = 30 * 60 * 1000;

/**
 * Contrôle régulier de la licence auprès du serveur (au démarrage, toutes les 30 min et au retour dans
 * l'application) : révocation, renouvellement ou passage à vie décidés par le créateur s'appliquent.
 * Hors ligne, la licence enregistrée sur l'appareil continue de s'appliquer.
 */
export function useLicenseServerSync() {
  const { state, dispatch } = useStore();
  const license = state.license;
  useEffect(() => {
    if (!LICENSE_SERVER) return;
    const server = LICENSE_SERVER;
    let alive = true;
    const run = () => {
      licenseApi
        .check(server, license.id)
        .then((r) => {
          const next = alive ? syncFromServer(license, r) : null;
          if (next) dispatch(setLicense(next));
        })
        .catch(() => {
          // hors ligne : rien à faire
        });
    };
    run();
    const timer = setInterval(run, CHECK_EVERY_MS);
    const sub = RNAppState.addEventListener('change', (st) => {
      if (st === 'active') run();
    });
    return () => {
      alive = false;
      clearInterval(timer);
      sub.remove();
    };
  }, [license, dispatch]);
}
